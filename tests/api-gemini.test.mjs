import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stubGemini, createFakePlaid } from "./helpers/test-server.mjs";

const server = await startTestServer({}, { plaid: createFakePlaid() });
test.after(() => server.close());

const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
const VALID_KEY = "AIza" + "x".repeat(35);

// Answers each Gemini call with whatever the test queued, in order.
let replies = [];
const seen = [];
const restore = stubGemini((body, url) => {
  seen.push({ body, url });
  const next = replies.shift();
  if (typeof next === "function") return next(body, url);
  return next ?? "{}";
});
test.after(() => restore());

test("config reports the shared key to admins only, and a personal key once saved", async () => {
  const user = await server.signUp();
  const before = await user.get("/api/gemini-config");
  assert.equal(before.body.hasServerKey, false);
  assert.equal(before.body.hasUserKey, false);

  assert.equal((await user.put("/api/gemini-key", { apiKey: "nope" })).status, 400);
  assert.equal((await user.put("/api/gemini-key", { apiKey: VALID_KEY })).body.hasUserKey, true);
  assert.equal((await user.get("/api/gemini-config")).body.hasUserKey, true);
  const stored = await server.prisma.user.findUnique({ where: { id: user.user.id } });
  assert.ok(stored.geminiKeyCiphertext && !stored.geminiKeyCiphertext.includes(VALID_KEY));

  const cleared = await user.delete("/api/gemini-key");
  assert.deepEqual(cleared.body, { hasUserKey: false, hasServerKey: false });

  const admin = await server.admin();
  assert.equal((await admin.get("/api/gemini-config")).body.hasServerKey, true);
});

test("parse: no key, bad input, then a reconciled receipt", async () => {
  const user = await server.signUp();
  const noKey = await user.post("/api/gemini/parse", { imageBase64: JPEG_BASE64, mimeType: "image/jpeg" });
  assert.equal(noKey.status, 503);

  const admin = await server.admin();
  assert.equal((await admin.post("/api/gemini/parse", {})).status, 400);
  assert.equal((await admin.post("/api/gemini/parse", { imageBase64: "x", mimeType: "image/gif" })).status, 400);
  assert.equal((await admin.post("/api/gemini/parse", { imageBase64: "x", mimeType: "image/jpeg", model: "../evil" })).status, 400);

  replies.push(
    JSON.stringify({
      storeName: "Costco",
      subtotal: 9,
      tax: 1,
      total: 10,
      items: [
        { name: "MILK", price: 4, discount: 1, itemCode: "12345" },
        { name: "EGGS", price: 5, discount: 0, itemCode: "x1" }
      ]
    })
  );
  const parsed = await admin.post("/api/v1/gemini/parse", { imageBase64: JPEG_BASE64, mimeType: "image/jpeg" });
  assert.equal(parsed.status, 200, JSON.stringify(parsed.body));
  assert.equal(parsed.body.storeName, "Costco");
  assert.equal(parsed.body.items[0].itemCode, "12345");
  assert.equal(parsed.body.items[1].itemCode, null);
  // The key travels in a header, never in the URL.
  assert.ok(!seen.at(-1).url.includes("key="));

  replies.push(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }));
  assert.equal((await admin.post("/api/gemini/parse", { imageBase64: JPEG_BASE64, mimeType: "image/jpeg" })).status, 502);

  replies.push("this is not json");
  assert.equal((await admin.post("/api/gemini/parse", { imageBase64: JPEG_BASE64, mimeType: "image/jpeg" })).status, 502);
});

test("a saved key that can no longer be decrypted asks to be re-entered", async () => {
  const user = await server.signUp();
  await server.prisma.user.update({
    where: { id: user.user.id },
    data: { geminiKeyCiphertext: "AAAA", geminiKeyIv: "AAAAAAAAAAAAAAAA", geminiKeyAuthTag: "AAAAAAAAAAAAAAAAAAAAAA==" }
  });
  const response = await user.post("/api/gemini/parse", { imageBase64: JPEG_BASE64, mimeType: "image/jpeg" });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /re-enter/);
});

test("identify: grounded first, ungrounded when search is unavailable", async () => {
  const admin = await server.admin();
  assert.equal((await admin.post("/api/items/identify", { items: [] })).status, 400);

  replies.push(
    JSON.stringify({
      items: [
        { id: "l1", name: "Great Value Milk", confidence: 0.97, reasoning: "SKU lookup", alternatives: [] },
        { id: "ghost", name: "Not asked about", confidence: 1 }
      ]
    })
  );
  const grounded = await admin.post("/api/items/identify", {
    storeName: "Walmart",
    items: [{ id: "l1", label: "GV MLK", itemCode: "007874", amount: 3.5, hint: "Great Value Milk" }]
  });
  assert.equal(grounded.status, 200);
  assert.equal(grounded.body.grounded, true);
  assert.deepEqual(grounded.body.items.map((item) => item.id), ["l1"]);
  assert.equal(grounded.body.items[0].confidence, 0.97);
  assert.ok(seen.at(-1).body.tools, "the first call is grounded");

  replies.push(new Response("{}", { status: 429 }), JSON.stringify({ items: [{ id: "l1", name: "Milk", confidence: 0.99 }] }));
  const fallback = await admin.post("/api/items/identify", { items: [{ id: "l1", label: "MLK" }] });
  assert.equal(fallback.body.grounded, false);
  assert.equal(fallback.body.items[0].confidence, 0.85, "an ungrounded answer is capped");

  replies.push(new Response("{}", { status: 500 }));
  assert.equal((await admin.post("/api/items/identify", { items: [{ id: "l1", label: "MLK" }] })).status, 502);

  replies.push("no json here");
  assert.equal((await admin.post("/api/items/identify", { items: [{ id: "l1", label: "MLK" }] })).status, 502);
});

test("item aliases: confirm, count up, list, forget", async () => {
  const user = await server.signUp();
  assert.equal((await user.put("/api/item-aliases", { lookupKey: "" })).status, 400);
  const first = await user.put("/api/item-aliases", { lookupKey: "gv mlk", storeKey: "Walmart", resolvedName: "Milk", brand: "GV", size: "1 gal" });
  assert.equal(first.body.timesConfirmed, 1);
  assert.equal(first.body.storeKey, "walmart");
  const second = await user.put("/api/item-aliases", { lookupKey: "gv mlk", storeKey: "walmart", resolvedName: "Milk" });
  assert.equal(second.body.timesConfirmed, 2);
  const renamed = await user.put("/api/item-aliases", { lookupKey: "gv mlk", storeKey: "walmart", resolvedName: "Whole Milk" });
  assert.equal(renamed.body.timesConfirmed, 1);

  assert.equal((await user.get("/api/item-aliases")).body.aliases.length, 1);
  assert.equal((await user.delete("/api/item-aliases")).status, 400);
  assert.equal((await user.delete("/api/item-aliases?lookupKey=gv%20mlk&storeKey=Walmart")).body.deleted, 1);
  assert.equal((await user.get("/api/item-aliases")).body.aliases.length, 0);
});

test("categorize: files the month's receipts and transactions and stores the result", async () => {
  const admin = await server.admin();
  const receipt = (
    await admin.post("/api/receipts", {
      storeName: "Target",
      category: "Groceries",
      total: 30,
      lines: [{ clientId: "a", label: "Towels", amount: 30, ignored: false }],
      people: [],
      assignments: []
    })
  ).body;
  const connection = await server.prisma.bankConnection.create({
    data: { userId: admin.user.id, encryptedToken: "x", tokenIv: "x", tokenAuthTag: "x", accounts: { create: { plaidAccountId: "cat-acc" } } },
    include: { accounts: true }
  });
  const spend = await server.prisma.bankTransaction.create({
    data: { accountId: connection.accounts[0].id, plaidTxnId: "cat-1", date: new Date("2026-09-03"), description: "Delta", amount: -300 }
  });
  const income = await server.prisma.bankTransaction.create({
    data: { accountId: connection.accounts[0].id, plaidTxnId: "cat-2", date: new Date("2026-09-04"), description: "Payroll", amount: 900 }
  });

  assert.equal((await admin.post("/api/budget/categorize", { month: "2026-9", receiptIds: [receipt.id] })).status, 400);

  replies.push((body) => {
    const prompt = body.contents[0].parts[0].text;
    assert.match(prompt, /Target/);
    assert.match(prompt, /Delta/);
    assert.doesNotMatch(prompt, /Payroll/, "money coming in is not spending");
    return JSON.stringify({ items: [{ id: "r1", category: "shopping" }, { id: "t1", category: "Travel" }] });
  });
  const sorted = await admin.post("/api/budget/categorize", {
    month: "2026-09",
    receiptIds: [receipt.id],
    transactionIds: [spend.id, income.id]
  });
  assert.equal(sorted.status, 200, JSON.stringify(sorted.body));
  assert.equal(sorted.body.updated, 2);
  assert.equal(sorted.body.receipts[receipt.id], "Shopping");
  assert.equal(sorted.body.transactions[spend.id], "Travel");
  assert.equal((await server.prisma.receipt.findUnique({ where: { id: receipt.id } })).budgetCategory, "Shopping");
  assert.equal((await admin.get("/api/transactions")).body.find((t) => t.id === spend.id).budgetCategory, "Travel");

  replies.push(new Response("{}", { status: 400 }));
  assert.equal((await admin.post("/api/budget/categorize", { month: "2026-09", receiptIds: [receipt.id] })).status, 400);
  replies.push("garbage");
  assert.equal((await admin.post("/api/budget/categorize", { month: "2026-09", receiptIds: [receipt.id] })).status, 502);
});

test("categorize: a regular account's transaction ids are ignored, and an empty month is a no-op", async () => {
  const user = await server.signUp();
  await user.put("/api/gemini-key", { apiKey: VALID_KEY });
  const nothing = await user.post("/api/budget/categorize", { month: "2026-09", receiptIds: ["not-mine"], transactionIds: ["also-not"] });
  assert.equal(nothing.status, 200);
  assert.equal(nothing.body.updated, 0);
});
