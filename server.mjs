import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and start Postgres (npm run db:up).");
  process.exit(1);
}

// Prisma 7 connects through a driver adapter; swap DATABASE_URL to scale to managed Postgres.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = Number(process.env.PORT) || 4173;

app.use(express.json({ limit: "2mb" }));

// --- API -------------------------------------------------------------------

// Public Gemini config so the frontend never has to fetch the raw .env file.
app.get("/api/gemini-config", (_req, res) => {
  res.json({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_MODEL: process.env.GEMINI_MODEL || ""
  });
});

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

function serializeReceipt(receipt) {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    category: receipt.category,
    subtotal: toNumber(receipt.subtotal),
    tax: toNumber(receipt.tax),
    total: toNumber(receipt.total),
    createdAt: receipt.createdAt,
    people: receipt.people.map((person) => ({ id: person.id, name: person.name })),
    lines: receipt.lines.map((line) => ({
      label: line.label,
      amount: toNumber(line.amount),
      assignments: line.assignments.map((assignment) => ({
        personName: assignment.person?.name ?? "",
        mode: assignment.mode,
        value: toNumber(assignment.value)
      }))
    }))
  };
}

const receiptInclude = {
  people: true,
  lines: {
    orderBy: { sortOrder: "asc" },
    include: { assignments: { include: { person: true } } }
  }
};

app.post("/api/receipts", async (req, res) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return res.status(400).json({ error: "At least one receipt line is required." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          storeName: body.storeName ?? null,
          category: body.category ?? "Other",
          subtotal: body.subtotal ?? null,
          tax: body.tax ?? null,
          total: body.total ?? null
        }
      });

      const personByClient = new Map();
      for (const person of body.people ?? []) {
        const created = await tx.person.create({
          data: { receiptId: receipt.id, name: person.name }
        });
        personByClient.set(person.clientId, created.id);
      }

      const lineByClient = new Map();
      let sortOrder = 0;
      for (const line of body.lines) {
        const created = await tx.receiptLine.create({
          data: {
            receiptId: receipt.id,
            label: line.label,
            amount: line.amount ?? 0,
            ignored: Boolean(line.ignored),
            sortOrder: sortOrder++
          }
        });
        lineByClient.set(line.clientId, created.id);
      }

      const assignmentData = (body.assignments ?? [])
        .map((assignment) => ({
          lineId: lineByClient.get(assignment.lineClientId),
          personId: personByClient.get(assignment.personClientId),
          mode: assignment.mode ?? "equal",
          value: assignment.value ?? 0
        }))
        .filter((assignment) => assignment.lineId && assignment.personId);

      if (assignmentData.length > 0) {
        await tx.lineAssignment.createMany({ data: assignmentData });
      }

      return tx.receipt.findUnique({ where: { id: receipt.id }, include: receiptInclude });
    });

    res.status(201).json(serializeReceipt(result));
  } catch (error) {
    console.error("Failed to save receipt:", error);
    res.status(500).json({ error: "Failed to save receipt." });
  }
});

app.get("/api/receipts", async (_req, res) => {
  try {
    const receipts = await prisma.receipt.findMany({
      orderBy: { createdAt: "desc" },
      include: receiptInclude
    });
    res.json(receipts.map(serializeReceipt));
  } catch (error) {
    console.error("Failed to list receipts:", error);
    res.status(500).json({ error: "Failed to load receipts." });
  }
});

// --- Static frontend -------------------------------------------------------

// Never expose source, config, or dependency files over HTTP.
const BLOCKED = [
  /^\/src\//,
  /^\/server\.mjs$/,
  /^\/package(-lock)?\.json$/,
  /^\/tsconfig\.json$/,
  /^\/prisma(\/|\.config\.ts$)/,
  /^\/node_modules\//,
  /^\/docker-compose\.yml$/
];

app.use((req, res, next) => {
  if (BLOCKED.some((pattern) => pattern.test(req.path))) {
    return res.status(404).end();
  }
  next();
});

// dotfiles: "ignore" makes .env (and other dotfiles) return 404.
app.use(express.static(__dirname, { dotfiles: "ignore", index: "index.html" }));

app.listen(PORT, () => {
  console.log(`Receipt Ring running at http://localhost:${PORT}`);
});
