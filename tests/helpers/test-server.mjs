// Runs the real Express app (server/app.mjs) against a real Postgres for the
// route tests -- PGlite, Postgres compiled to WebAssembly, in this process --
// with every migration in prisma/migrations applied. Nothing to install or
// start: `npm test` brings its own database.
//
// Migrating from scratch takes a few seconds, so the migrated data directory
// is cached under tests/dist, keyed by a hash of the migration files, and each
// test file starts from a copy of it.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = path.join(root, "prisma", "migrations");
const cacheDir = path.join(root, "tests", "dist");

export const ADMIN_EMAIL = "admin@test.dev";

// The environment the app reads at request time. Set before the app module is
// imported, and kept stable for the life of the test process.
export function configureTestEnv(overrides = {}) {
  const defaults = {
    NODE_ENV: "test",
    TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    AUTH_SESSION_SECRET: crypto.randomBytes(32).toString("base64"),
    ADMIN_EMAILS: ADMIN_EMAIL,
    ALLOW_PUBLIC_SIGNUP: "true",
    ALLOWED_LOGIN_EMAILS: "",
    GEMINI_API_KEY: "test-server-gemini-key-0000000000000",
    PLAID_CLIENT_ID: "",
    PLAID_SECRET: "",
    CORS_ORIGINS: "https://ui.example.test"
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    if (overrides[key] !== undefined || process.env[key] === undefined) process.env[key] = value;
  }
}

function migrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => fs.statSync(path.join(migrationsDir, name)).isDirectory())
    .sort()
    .map((name) => path.join(migrationsDir, name, "migration.sql"));
}

async function migratedDatabase() {
  const files = migrationFiles();
  const hash = crypto.createHash("sha256");
  for (const file of files) hash.update(fs.readFileSync(file));
  const snapshot = path.join(cacheDir, `pglite-${hash.digest("hex").slice(0, 16)}.tar.gz`);

  if (fs.existsSync(snapshot)) {
    return PGlite.create({ loadDataDir: new Blob([fs.readFileSync(snapshot)]) });
  }

  const db = await PGlite.create();
  // Prisma Migrate's own bookkeeping table; one migration enables RLS on it.
  await db.exec(`CREATE TABLE "_prisma_migrations" ("id" TEXT PRIMARY KEY)`);
  for (const file of files) await db.exec(fs.readFileSync(file, "utf8"));

  const dump = await db.dumpDataDir("gzip");
  fs.mkdirSync(cacheDir, { recursive: true });
  // Written under a temporary name and renamed, so two test files racing to
  // build the cache never read a half-written one.
  const temp = `${snapshot}.${process.pid}.tmp`;
  fs.writeFileSync(temp, Buffer.from(await dump.arrayBuffer()));
  fs.renameSync(temp, snapshot);
  return db;
}

/**
 * Outbound calls to Gemini are answered by `handler(body, url)` instead of the
 * network. Everything else (the test client's own requests) goes through.
 */
export function stubGemini(handler) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      const body = JSON.parse(init?.body ?? "{}");
      const result = await handler(body, url);
      if (result instanceof Response) return result;
      const text = typeof result === "string" ? result : JSON.stringify(result);
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return realFetch(input, init);
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

/** A client that keeps its own cookie, like one browser. */
export class TestClient {
  constructor(baseUrl, { token = null, origin = null } = {}) {
    this.baseUrl = baseUrl;
    this.cookie = null;
    this.token = token;
    this.origin = origin;
  }

  async request(method, url, { body, headers = {}, raw = false } = {}) {
    const init = { method, headers: { ...headers }, redirect: "manual" };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    if (this.cookie) init.headers.Cookie = this.cookie;
    if (this.token) init.headers.Authorization = `Bearer ${this.token}`;
    if (this.origin) init.headers.Origin = this.origin;

    const response = await fetch(this.baseUrl + url, init);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = /rr_session=([^;]*)/.exec(setCookie);
      if (match) this.cookie = match[1] ? `rr_session=${match[1]}` : null;
    }
    if (raw) return response;
    const type = response.headers.get("content-type") ?? "";
    const data = type.includes("application/json") ? await response.json() : await response.text();
    return { status: response.status, body: data, headers: response.headers };
  }

  get(url, options) {
    return this.request("GET", url, options);
  }
  post(url, body, options = {}) {
    return this.request("POST", url, { ...options, body });
  }
  put(url, body, options = {}) {
    return this.request("PUT", url, { ...options, body });
  }
  patch(url, body, options = {}) {
    return this.request("PATCH", url, { ...options, body });
  }
  delete(url, body, options = {}) {
    return this.request("DELETE", url, { ...options, body });
  }
}

/**
 * Start the app on a fresh database. Returns the base URL, the Prisma client
 * (for arranging and checking rows directly), helpers to make signed-in
 * clients, and `close()`.
 */
export async function startTestServer(envOverrides = {}, appOptions = {}) {
  configureTestEnv(envOverrides);
  const { createApp } = await import("../../server/app.mjs");

  const db = await migratedDatabase();
  const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await socket.start();
  const dbPort = socket.server?.address()?.port ?? socket.port;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`, max: 1 })
  });

  const app = createApp({ prisma, ...appOptions });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let counter = 0;
  const client = (options) => new TestClient(baseUrl, options);

  /** Register a fresh account and return a client signed in as it. */
  async function signUp({ email, password = "correct horse battery", name = "Tester" } = {}) {
    counter += 1;
    const user = client();
    const address = email ?? `user${counter}-${crypto.randomBytes(3).toString("hex")}@test.dev`;
    const response = await user.post("/api/auth/register", { email: address, password, name });
    if (response.status !== 201) {
      throw new Error(`sign-up failed: ${response.status} ${JSON.stringify(response.body)}`);
    }
    user.user = response.body;
    user.password = password;
    return user;
  }

  /** The admin account, signed in. Created on first use. */
  let adminClient = null;
  async function admin() {
    if (!adminClient) adminClient = await signUp({ email: ADMIN_EMAIL });
    return adminClient;
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
    await prisma.$disconnect();
    await socket.stop();
    await db.close();
  }

  return { baseUrl, prisma, client, signUp, admin, close };
}

/** A tiny but valid JPEG as a data URL, for receipt and rent photos. */
export const JPEG_DATA_URL =
  "data:image/jpeg;base64," +
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]).toString("base64");
