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

test("a pending purchase that posts keeps its receipt, food flag and rent entry", async () => {
  const admin = await server.admin();
  for (const connection of (await admin.get("/api/plaid/connections")).body) {
    await admin.delete(`/api/plaid/connections/${connection.id}`);
  }
  await admin.post("/api/plaid/exchange", {
    publicToken: "pub-pending",
    metadata: { institution: { name: "Amex", institution_id: "ins_pending" } }
  });

  plaid.pages.push({
    added: [txn("p1", { pending: true, amount: 30 }), txn("p2", { pending: true, amount: 900 })],
    modified: [],
    removed: [],
    next_cursor: "p-c1",
    has_more: false
  });
  await admin.post("/api/plaid/sync");
  const pendingRows = (await admin.get("/api/transactions")).body;
  const p1 = pendingRows.find((t) => t.description === "Shop p1");
  const p2 = pendingRows.find((t) => t.description === "Shop p2");

  const receipt = (
    await admin.post("/api/receipts", {
      category: "Dining",
      lines: [{ clientId: "a", label: "Dinner", amount: 30, ignored: false }],
      people: [],
      assignments: []
    })
  ).body;
  assert.equal((await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: p1.id })).status, 200);
  await admin.patch(`/api/bank-transactions/${p1.id}/food`, { isFood: true });
  const rent = await admin.post("/api/rent-entries", { year: 2026, month: 6, amount: 900, bankTransactionId: p2.id });
  assert.equal(rent.status, 201);

  // Both post. The removal of p2's pending copy arrives a page before its
  // posted copy, which must not matter.
  plaid.pages.push(
    {
      added: [txn("q1", { pending_transaction_id: "p1", amount: 36, name: "Shop p1 posted" })],
      modified: [],
      removed: [{ transaction_id: "p1" }, { transaction_id: "p2" }],
      next_cursor: "p-c2",
      has_more: true
    },
    {
      added: [txn("q2", { pending_transaction_id: "p2", amount: 900 })],
      modified: [],
      removed: [],
      next_cursor: "p-c3",
      has_more: false
    }
  );
  assert.equal((await admin.post("/api/plaid/sync")).body.imported, 2);

  const posted = (await admin.get("/api/transactions")).body;
  assert.equal(posted.length, 2);
  const q1 = posted.find((t) => t.id === p1.id);
  assert.equal(q1.description, "Shop p1 posted");
  // The tip lands when a charge posts; the new amount is taken.
  assert.equal(q1.amount, -36);
  assert.equal(q1.linkedReceiptId, receipt.id);
  assert.equal(q1.isFood, true);
  assert.ok(posted.some((t) => t.id === p2.id));
  const rentRow = await server.prisma.rentEntry.findUnique({ where: { id: rent.body.id } });
  assert.equal(rentRow.bankTransactionId, p2.id);
  assert.equal(await server.prisma.bankTransaction.count({ where: { plaidTxnId: { in: ["p1", "p2"] } } }), 0);

  // A transaction that really went away is still removed.
  plaid.pages.push({ added: [], modified: [], removed: [{ transaction_id: "q2" }], next_cursor: "p-c4", has_more: false });
  await admin.post("/api/plaid/sync");
  assert.deepEqual((await admin.get("/api/transactions")).body.map((t) => t.id), [p1.id]);
});

test("a linked receipt moves only when asked, and its food lines replace the transaction's flag", async () => {
  const admin = await server.admin();
  plaid.pages.push({
    added: [txn("m1", { amount: 50 }), txn("m2", { amount: 60 })],
    modified: [],
    removed: [],
    next_cursor: "m-c1",
    has_more: false
  });
  await admin.post("/api/plaid/sync");
  const rows = (await admin.get("/api/transactions")).body;
  const m1 = rows.find((t) => t.description === "Shop m1");
  const m2 = rows.find((t) => t.description === "Shop m2");

  const receipt = (
    await admin.post("/api/receipts", {
      category: "Groceries",
      lines: [
        { clientId: "a", label: "Apples", amount: 8, ignored: false, isFood: true },
        { clientId: "b", label: "Soap", amount: 42, ignored: false }
      ],
      people: [],
      assignments: []
    })
  ).body;
  await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: m1.id });

  const refused = await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: m2.id });
  assert.equal(refused.status, 409);
  const moved = await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: m2.id, move: true });
  assert.equal(moved.status, 200);
  const after = (await admin.get("/api/transactions")).body;
  assert.equal(after.find((t) => t.id === m1.id).linkedReceiptId, null);
  assert.equal(after.find((t) => t.id === m2.id).linkedReceiptId, receipt.id);
  // Linking it again where it already is stays a plain success.
  assert.equal((await admin.patch(`/api/receipts/${receipt.id}/link-transaction`, { bankTransactionId: m2.id })).status, 200);

  // Flagged as food on its own, m2 would add $60; its receipt's food lines
  // count instead, so only the apples do.
  await admin.patch(`/api/bank-transactions/${m2.id}/food`, { isFood: true });
  await admin.patch(`/api/bank-transactions/${m1.id}/food`, { isFood: true });
  const food = (await admin.get("/api/receipts/food-summary")).body;
  const ids = food.foodTransactions.map((t) => t.transactionId);
  assert.ok(!ids.includes(m2.id));
  assert.ok(ids.includes(m1.id));
  const group = food.foodReceipts.find((g) => g.receiptId === receipt.id);
  assert.equal(group.total, 8);
});
