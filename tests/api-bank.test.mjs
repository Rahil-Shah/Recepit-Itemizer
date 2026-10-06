import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, createFakePlaid, plaidError } from "./helpers/test-server.mjs";

const plaid = createFakePlaid();
const server = await startTestServer({}, { plaid });
test.after(() => server.close());

const txn = (id, overrides = {}) => ({
  transaction_id: id,
  account_id: "acc-1",
  date: "2026-09-15",
  name: `Shop ${id}`,
  amount: 12.5,
  personal_finance_category: { primary: "FOOD_AND_DRINK" },
  ...overrides
});

test("the bank side is admin-only", async () => {
  const user = await server.signUp();
  for (const [method, path] of [
    ["get", "/api/plaid/link-token"],
    ["post", "/api/plaid/exchange"],
    ["post", "/api/plaid/sync"],
    ["get", "/api/plaid/connections"],
    ["get", "/api/transactions"]
  ]) {
    assert.equal((await user[method](path)).status, 403, path);
  }
});

test("link token: configured or not", async () => {
  const admin = await server.admin();
  assert.equal((await admin.get("/api/plaid/link-token")).body.linkToken, "link-sandbox-123");
  plaid.configured = false;
  assert.equal((await admin.get("/api/plaid/link-token")).status, 400);
  plaid.configured = true;
  const original = plaid.createLinkToken;
  plaid.createLinkToken = async () => {
    throw new Error("down");
  };
  assert.equal((await admin.get("/api/plaid/link-token")).status, 502);
  plaid.createLinkToken = original;
});

test("exchange, sync, list, flag, link a receipt, log rent, re-link, remove", async () => {
  const admin = await server.admin();
  assert.equal((await admin.post("/api/plaid/exchange", {})).status, 400);

  const linked = await admin.post("/api/plaid/exchange", {
    publicToken: "pub-1",
    metadata: { institution: { name: "Chase", institution_id: "ins_1" } }
  });
  assert.equal(linked.status, 201);
  assert.equal(linked.body.institutionName, "Chase");
  assert.equal(linked.body.accounts, 1);
  assert.equal(linked.body.replaced, false);

  // First page brings two transactions; a second page modifies one, removes
  // the other, and adds one on an account the sync has not seen yet.
  plaid.pages.push(
    { added: [txn("t1"), txn("t2", { amount: -40, name: "Refund" })], modified: [], removed: [], next_cursor: "c1", has_more: true },
    {
      added: [txn("t3", { account_id: "acc-2" })],
      modified: [txn("t1", { amount: 20 })],
      removed: [{ transaction_id: "t2" }],
      next_cursor: "c2",
      has_more: false
    }
  );
  plaid.accounts = [...plaid.accounts, { account_id: "acc-2", name: "Savings", type: "depository" }];
  const synced = await admin.post("/api/plaid/sync");
  assert.equal(synced.status, 200);
  assert.equal(synced.body.imported, 4);
  assert.deepEqual(synced.body.errors, []);

  const transactions = (await admin.get("/api/transactions")).body;
  assert.deepEqual(transactions.map((t) => t.description).sort(), ["Shop t1", "Shop t3"]);
  const t1 = transactions.find((t) => t.description === "Shop t1");
  assert.equal(t1.amount, -20);
  assert.equal(t1.category, "FOOD_AND_DRINK");
  assert.equal(t1.date, "2026-09-15");

  const connections = (await admin.get("/api/plaid/connections")).body;
  assert.equal(connections.length, 1);
  assert.equal(connections[0].transactions, 2);
  assert.equal(connections[0].accounts, 2);

  // Food flag.
  assert.equal((await admin.patch(`/api/bank-transactions/${t1.id}/food`, { isFood: "y" })).status, 400);
  assert.equal((await admin.patch(`/api/bank-transactions/${t1.id}/food`, { isFood: true })).status, 200);
  assert.equal((await admin.patch(`/api/bank-transactions/nope/food`, { isFood: true })).status, 404);
  const food = await admin.get("/api/receipts/food-summary");
  assert.equal(food.body.foodTransactions[0].amount, 20);

  // Link and unlink a receipt.
  const receipt = (
    await admin.post("/api/receipts", {
      category: "Groceries",
      lines: [{ clientId: "a", label: "Thing", amount: 20, ignored: false }],
      people: [],
      assignments: []
    })
  ).body;
  assert.equal((await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, {})).status, 400);
  assert.equal((await admin.patch(`/api/receipts/nope/link-transaction`, { bankTransactionId: t1.id })).status, 404);
  assert.equal((await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: "nope" })).status, 404);
  const link = await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: t1.id });
  assert.equal(link.status, 200);
  assert.equal(link.body.linkedReceiptId, receipt.id);
  const other = (
    await admin.post("/api/receipts", {
      category: "Other",
      lines: [{ clientId: "a", label: "Other", amount: 1, ignored: false }],
      people: [],
      assignments: []
    })
  ).body;
  assert.equal((await admin.patch(`/api/receipts/${other.id}/link-transaction`, { bankTransactionId: t1.id })).status, 400);
  const history = (await admin.get("/api/receipts")).body.find((r) => r.id === receipt.id);
  assert.equal(history.linkedTransaction.id, t1.id);
  assert.equal((await admin.delete(`/api/receipts/${receipt.id}/link-transaction`)).status, 200);
  assert.equal((await admin.delete(`/api/receipts/${receipt.id}/link-transaction`)).status, 404);
  assert.equal((await admin.delete(`/api/receipts/nope/link-transaction`)).status, 404);

  // Rent from a transaction, once.
  const rent = await admin.post("/api/rent-entries", { year: 2026, month: 9, amount: 20, bankTransactionId: t1.id });
  assert.equal(rent.status, 201);
  assert.equal(rent.body.bankTransactionId, t1.id);
  const again = await admin.post("/api/rent-entries", { year: 2026, month: 8, amount: 20, bankTransactionId: t1.id });
  assert.equal(again.status, 400);
  const unknown = await admin.post("/api/rent-entries", { year: 2026, month: 7, amount: 20, bankTransactionId: "nope" });
  assert.equal(unknown.status, 404);

  // Linking the same bank again replaces the old connection.
  const relinked = await admin.post("/api/plaid/exchange", {
    publicToken: "pub-2",
    metadata: { institution: { name: "Chase", institution_id: "ins_1" } }
  });
  assert.equal(relinked.body.replaced, true);
  assert.ok(plaid.calls.some(([name, token]) => name === "removeItem" && token === "access-pub-1"));
  const after = (await admin.get("/api/plaid/connections")).body;
  assert.equal(after.length, 1);

  assert.equal((await admin.delete("/api/plaid/connections/nope")).status, 404);
  assert.equal((await admin.delete(`/api/plaid/connections/${after[0].id}`)).status, 204);
  assert.equal((await admin.get("/api/plaid/connections")).body.length, 0);
});

test("sync reports a bank still preparing, and one that needs reconnecting", async () => {
  const admin = await server.admin();
  await admin.post("/api/plaid/exchange", { publicToken: "pub-3", metadata: { institution: { name: "Ally" } } });
  plaid.pages.push(plaidError("PRODUCT_NOT_READY"));
  const pending = await admin.post("/api/plaid/sync");
  assert.equal(pending.body.pending, true);

  plaid.pages.push(plaidError("ITEM_LOGIN_REQUIRED"));
  const broken = await admin.post("/api/plaid/sync");
  assert.equal(broken.body.errors.length, 1);
  assert.equal(broken.body.errors[0].reconnectRequired, true);

  plaid.pages.push(new Error("timeout"));
  const flaky = await admin.post("/api/plaid/sync");
  assert.equal(flaky.body.errors[0].reconnectRequired, false);
});

test("an exchange that Plaid refuses is a 502", async () => {
  const admin = await server.admin();
  const original = plaid.exchangePublicToken;
  plaid.exchangePublicToken = async () => ({});
  assert.equal((await admin.post("/api/plaid/exchange", { publicToken: "pub-x" })).status, 502);
  plaid.exchangePublicToken = original;
});

test("a stale connection without an institution id is backfilled on the next link", async () => {
  const admin = await server.admin();
  await admin.post("/api/plaid/exchange", { publicToken: "pub-old" });
  const before = await server.prisma.bankConnection.findFirst({ where: { itemId: "item-pub-old" } });
  assert.equal(before.institutionId, null);
  // The backfill finds ins_1 for it, and a link to ins_1 then replaces it.
  const response = await admin.post("/api/plaid/exchange", {
    publicToken: "pub-new",
    metadata: { institution: { name: "Chase", institution_id: "ins_1" } }
  });
  assert.equal(response.body.replaced, true);
  assert.equal(await server.prisma.bankConnection.count({ where: { itemId: "item-pub-old" } }), 0);
});
