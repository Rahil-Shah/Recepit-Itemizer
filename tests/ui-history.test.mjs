import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL, createFakePlaid } from "./helpers/test-server.mjs";
import { openApp } from "./helpers/ui-harness.mjs";

const server = await startTestServer({}, { plaid: createFakePlaid() });
test.after(() => server.close());

async function seed(user) {
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;
  const save = (body) => user.post("/api/receipts", { people: [], assignments: [], ...body });
  await save({
    storeName: "Trader Joe's",
    category: "Groceries",
    tax: 1,
    total: 13,
    imageDataUrl: JPEG_DATA_URL,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [
      { clientId: "a", label: "GV SHRD MOZZ", amount: 4, ignored: false, isFood: true, identification: { resolvedName: "Shredded Mozzarella", confidence: 0.9, source: "ai", alternatives: [], confirmed: false } },
      { clientId: "b", label: "Paper Towels", amount: 8, ignored: false }
    ],
    assignments: [
      { lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "a", personClientId: sam.id, mode: "equal", value: 0 },
      { lineClientId: "b", personClientId: sam.id, mode: "equal", value: 0 }
    ]
  });
  await save({ storeName: "Chipotle", category: "Dining", total: 11, lines: [{ clientId: "c", label: "Burrito", amount: 11, ignored: false }] });
}

const cards = (ui) => ui.$$("#historyList .history-card");
const card = (ui, store) => cards(ui).find((c) => c.textContent.includes(store));
const action = (element, label) => [...element.querySelectorAll(".history-actions button")].find((b) => b.textContent === label);

test("history: list, search, food flags, edit, delete", async () => {
  const user = await server.signUp({ name: "Rahil" });
  await seed(user);
  const ui = await openApp(server, { as: user });
  ui.click("#tabHistory");
  await ui.waitFor(() => cards(ui).length === 2, { message: "the cards" });
  assert.match(ui.text("#historyOverview"), /All time/);
  assert.match(ui.text("#historyOverview"), /Trader Joe's/);
  assert.ok(card(ui, "Trader Joe's").querySelector(".history-image img"));
  assert.match(card(ui, "Trader Joe's").textContent, /Shredded Mozzarella/);
  // A regular account gets no bank link buttons.
  assert.equal(action(card(ui, "Chipotle"), "Link to transaction"), undefined);

  // Search by store, by an identified name, and by nothing at all.
  ui.type("#historySearch", "chip");
  assert.equal(cards(ui).length, 1);
  ui.type("#historySearch", "mozzarella");
  assert.equal(cards(ui).length, 1);
  ui.type("#historySearch", "nothing like this");
  assert.equal(cards(ui).length, 0);
  assert.ok(!ui.$("#historyNoMatch").classList.contains("hidden"));
  ui.type("#historySearch", "");

  // Flip a line's food flag from the card.
  const towels = [...card(ui, "Trader Joe's").querySelectorAll(".history-line")].find((row) => row.textContent.includes("Paper Towels"));
  ui.click(towels.querySelector(".line-food-check"));
  await ui.waitFor(async () => (await user.get("/api/receipts")).body.find((r) => r.storeName === "Trader Joe's").lines.find((l) => l.label === "Paper Towels").isFood, { message: "the food flag" });

  // A card can be dragged (onto a bank row, for admins).
  const dataTransfer = { data: {}, setData(type, value) { this.data[type] = value; }, effectAllowed: "" };
  const drag = new ui.window.Event("dragstart", { bubbles: true });
  drag.dataTransfer = dataTransfer;
  card(ui, "Chipotle").dispatchEvent(drag);
  assert.ok(dataTransfer.data["text/plain"]);

  // Edit opens it in Split.
  ui.click(action(card(ui, "Trader Joe's"), "Edit in Split"));
  await ui.waitFor(() => ui.document.body.dataset.tab === "receipts", { message: "the Split tab" });
  assert.match(ui.text("#editBannerTitle"), /Trader Joe's/);
  assert.equal(ui.$$("#receiptLinesList .table-row").length, 2);
  assert.match(ui.text("#receiptLinesList"), /Shredded Mozzarella/);

  // Opening another receipt over unsaved changes asks first.
  ui.type("#taxInput", "9");
  ui.click("#tabHistory");
  await ui.waitFor(() => cards(ui).length === 2);
  ui.confirmAnswer = false;
  ui.click(action(card(ui, "Chipotle"), "Edit in Split"));
  assert.match(ui.text("#editBannerTitle"), /Trader Joe's/);
  ui.confirmAnswer = true;

  // Delete: cancelled, then for real -- including the one open in Split.
  ui.confirmAnswer = false;
  ui.click(action(card(ui, "Trader Joe's"), "Delete receipt"));
  assert.equal((await user.get("/api/receipts")).body.length, 2);
  ui.confirmAnswer = true;
  ui.click(action(card(ui, "Trader Joe's"), "Delete receipt"));
  await ui.waitFor(() => cards(ui).length === 1, { message: "the delete" });
  assert.ok(ui.$("#editBanner").classList.contains("hidden"));

  ui.click("#refreshHistoryButton");
  await ui.settle();
  assert.deepEqual(ui.errors, []);
});

test("history for an admin: link a receipt to a transaction and unlink it", async () => {
  const admin = await server.admin();
  await seed(admin);
  const connection = await server.prisma.bankConnection.create({
    data: { userId: admin.user.id, encryptedToken: "x", tokenIv: "x", tokenAuthTag: "x", institutionName: "Chase", accounts: { create: { plaidAccountId: "hist-acc", name: "Checking" } } },
    include: { accounts: true }
  });
  await server.prisma.bankTransaction.create({
    data: { accountId: connection.accounts[0].id, plaidTxnId: "hist-1", date: new Date(), description: "CHIPOTLE 123", amount: -11, category: "FOOD" }
  });

  const ui = await openApp(server, { as: admin });
  ui.click("#tabHistory");
  await ui.waitFor(() => card(ui, "Chipotle"), { message: "the cards" });
  ui.click(action(card(ui, "Chipotle"), "Link to transaction"));
  await ui.waitFor(() => ui.$$("#transactionLinkList .transaction-link-item").length > 0, { message: "the transaction list" });
  ui.click(ui.$$("#transactionLinkList .transaction-link-item").find((item) => item.textContent.includes("CHIPOTLE")));
  await ui.waitFor(() => card(ui, "Chipotle")?.classList.contains("is-linked"), { message: "the link" });
  assert.match(card(ui, "Chipotle").textContent, /CHIPOTLE 123/);

  ui.click(action(card(ui, "Chipotle"), "Unlink transaction"));
  await ui.waitFor(() => !card(ui, "Chipotle")?.classList.contains("is-linked"), { message: "the unlink" });

  ui.click(action(card(ui, "Chipotle"), "Link to transaction"));
  ui.click("#transactionLinkCancelButton");
  assert.ok(ui.$("#transactionLinkModal").classList.contains("hidden"));
  assert.deepEqual(ui.errors, []);
});
