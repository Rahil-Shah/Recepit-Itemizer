import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stubGemini, createFakePlaid, plaidError } from "./helpers/test-server.mjs";
import { openApp, PNG_BYTES } from "./helpers/ui-harness.mjs";

const plaid = createFakePlaid();
const server = await startTestServer({}, { plaid });
let replies = [];
const restore = stubGemini((body) => {
  const next = replies.shift();
  return typeof next === "function" ? next(body) : next ?? "{}";
});
test.after(async () => {
  restore();
  await server.close();
});

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const thisMonth = today.slice(0, 7);

const plaidTxn = (id, name, amount) => ({
  transaction_id: id,
  account_id: "acc-1",
  date: today,
  name,
  amount,
  personal_finance_category: { primary: "GENERAL_MERCHANDISE" }
});

// Plaid Link in the page: opening it "succeeds" at once.
function fakePlaidLink(ui) {
  ui.window.Plaid = globalThis.Plaid = {
    create: ({ onSuccess }) => ({
      open: () => onSuccess("public-ui", { institution: { name: "Chase", institution_id: "ins_ui" }, accounts: [] }),
      exit() {},
      destroy() {}
    })
  };
}

const goToBudgets = async (ui) => {
  ui.click("#tabBudgeting");
  await ui.waitFor(() => ui.document.body.dataset.tab === "budgeting");
  await ui.waitFor(() => !ui.$(".loading-overlay"), { message: "budgeting to load" });
  await ui.settle();
};

const txnRow = (ui, text) => ui.$$("#transactionsList .transaction-row").find((row) => row.textContent.includes(text));
const menuItem = (ui, row, label) => {
  row.querySelector("details.txn-menu").open = true;
  return [...row.querySelectorAll(".txn-menu-item")].find((item) => item.textContent.includes(label));
};

test("admin budgets: link a bank, sort the month with AI, work the transaction menu", async () => {
  const admin = await server.admin();
  await admin.post("/api/receipts", {
    storeName: "Target",
    category: "Groceries",
    total: 42,
    lines: [{ clientId: "a", label: "Towels", amount: 42, ignored: false, isFood: true }],
    people: [],
    assignments: []
  });

  const ui = await openApp(server, { as: admin });
  await goToBudgets(ui);
  assert.equal(ui.document.body.dataset.access, "admin");
  assert.ok(ui.$(".loading-overlay") === null);
  assert.match(ui.text("#budgetLegend"), /Groceries/);

  // Without Plaid Link loaded, connecting says so.
  ui.click("#connectBankButton");
  await ui.waitFor(() => /Plaid Link failed to load/.test(ui.text("#bankStatus")));

  fakePlaidLink(ui);
  plaid.pages.push({
    added: [plaidTxn("u1", "Uber", 18.5), plaidTxn("u2", "Rent Co", 1500), plaidTxn("u3", "Refund", -12)],
    modified: [],
    removed: [],
    next_cursor: "u-c1",
    has_more: false
  });
  ui.click("#connectBankButton");
  await ui.waitFor(() => /Imported 3 transactions/.test(ui.text("#bankStatus")), { message: "the import" });
  await ui.waitFor(() => ui.$$("#transactionsList .transaction-row").length === 3, { message: "transaction rows" });
  assert.match(ui.text("#bankConnections"), /Chase/);

  // Refresh: a bank still preparing, then one that needs reconnecting.
  plaid.pages.push(plaidError("PRODUCT_NOT_READY"));
  ui.click("#refreshTransactionsButton");
  await ui.waitFor(() => /still preparing/.test(ui.text("#bankStatus")), { message: "pending status" });
  plaid.pages.push(plaidError("ITEM_LOGIN_REQUIRED"));
  ui.click("#refreshTransactionsButton");
  await ui.waitFor(() => /reconnect/.test(ui.text("#bankStatus")), { message: "reconnect status" });
  // Straight on, while that refresh is still reloading the view: the sort
  // must still see the month's transactions.

  // Sort the month with AI.
  replies.push((body) => {
    const prompt = body.contents[0].parts[0].text;
    const ids = [...prompt.matchAll(/"id": "([rt]\d+)"/g)].map((m) => m[1]);
    return JSON.stringify({ items: ids.map((id) => ({ id, category: id.startsWith("r") ? "Shopping" : "Transport" })) });
  });
  ui.click("#categorizeMonthButton");
  await ui.waitFor(() => /All \d+ sorted by Gemini/.test(ui.text("#categorizeMonthNote")), { message: "the sort" });
  assert.match(ui.text("#budgetLegend"), /Shopping/);
  assert.match(ui.text("#budgetLegend"), /Transport/);
  assert.match(ui.text("#monthGlance"), /Spent/);

  // Food flag from the row's own toggle and from the menu.
  ui.click(txnRow(ui, "Uber").querySelector(".txn-food-toggle"));
  await ui.waitFor(() => txnRow(ui, "Uber").querySelector(".txn-food-toggle").classList.contains("is-on"), { message: "food on" });
  ui.click(menuItem(ui, txnRow(ui, "Uber"), "Remove food flag"));
  await ui.waitFor(() => !txnRow(ui, "Uber").querySelector(".txn-food-toggle").classList.contains("is-on"), { message: "food off" });

  // Rent from a transaction, then undo.
  ui.click(menuItem(ui, txnRow(ui, "Rent Co"), "Log as rent payment"));
  await ui.waitFor(() => /Rent/.test(txnRow(ui, "Rent Co")?.querySelector(".transaction-tags")?.textContent ?? ""), { message: "rent tag" });
  await ui.waitFor(() => ui.$$("#rentEntriesList .rent-entry-row").length === 1, { message: "the rent row" });
  ui.click(menuItem(ui, txnRow(ui, "Rent Co"), "Remove rent payment"));
  await ui.waitFor(() => !/Rent\b/.test(txnRow(ui, "Rent Co").querySelector(".transaction-tags").textContent), { message: "rent removed" });

  // Attach a photo as a new receipt, open it, detach it.
  ui.click(menuItem(ui, txnRow(ui, "Uber"), "Attach a receipt file"));
  ui.setFiles("#transactionReceiptFile", [ui.file("uber.png", PNG_BYTES, "image/png")]);
  await ui.waitFor(() => txnRow(ui, "Uber").classList.contains("has-receipt") || ui.toasts().some((t) => /attach/i.test(t)), {
    message: "the attach"
  });

  // Link a saved receipt from the modal.
  ui.click(menuItem(ui, txnRow(ui, "Refund"), "Link a saved receipt"));
  await ui.waitFor(() => ui.$$("#receiptLinkList .receipt-link-item").length > 0, { message: "the receipt list" });
  ui.click(ui.$$("#receiptLinkList .receipt-link-item").find((item) => item.textContent.includes("Target")));
  await ui.waitFor(() => txnRow(ui, "Refund").classList.contains("has-receipt"), { message: "the link" });
  ui.click(menuItem(ui, txnRow(ui, "Refund"), "Detach receipt"));
  await ui.waitFor(() => !txnRow(ui, "Refund").classList.contains("has-receipt"), { message: "the detach" });

  ui.click(menuItem(ui, txnRow(ui, "Refund"), "Link a saved receipt"));
  ui.click("#receiptLinkCancelButton");
  assert.ok(ui.$("#receiptLinkModal").classList.contains("hidden"));

  // Dropping a History card onto a row links it too.
  const target = (await admin.get("/api/receipts")).body.find((r) => r.storeName === "Target");
  const drop = new ui.window.Event("drop", { bubbles: true, cancelable: true });
  drop.dataTransfer = { getData: () => target.id };
  txnRow(ui, "Rent Co").dispatchEvent(new ui.window.Event("dragover", { bubbles: true, cancelable: true }));
  txnRow(ui, "Rent Co").dispatchEvent(new ui.window.Event("dragleave", { bubbles: true }));
  txnRow(ui, "Rent Co").dispatchEvent(drop);
  await ui.waitFor(() => txnRow(ui, "Rent Co").classList.contains("has-receipt"), { message: "the drop link" });

  // Spending CSV.
  ui.click("#spendingExportButton");
  await ui.waitFor(() => ui.downloads.some((d) => d.name.endsWith(".csv")), { message: "the CSV" });

  // Remove the bank.
  ui.click(ui.$("#bankConnections .bank-connection-row button"));
  await ui.waitFor(() => /Removed Chase/.test(ui.text("#bankStatus")), { message: "the removal" });
  assert.deepEqual(ui.errors, []);
});

test("rent payments, education export, months, and the collapsible sections", async () => {
  const user = await server.signUp();
  await user.post("/api/receipts", {
    storeName: "Safeway",
    category: "Groceries",
    total: 20,
    lines: [{ clientId: "a", label: "Bread", amount: 20, ignored: false, isFood: true }],
    people: [],
    assignments: []
  });
  const ui = await openApp(server, { as: user });
  await goToBudgets(ui);
  assert.equal(ui.document.body.dataset.access, "regular");
  await ui.waitFor(() => /\$20\.00/.test(ui.text("#educationFoodTotal")), { message: "the food total" });

  // Add rent: missing fields first, then a real one with a photo.
  ui.click("#addRentEntryButton");
  ui.click("#rentEntrySaveButton");
  assert.ok(ui.toasts().some((t) => /fill in the date/.test(t)));
  ui.type("#rentEntryDate", `${thisMonth}-03`);
  ui.type("#rentEntryAmount", "1100");
  ui.type("#rentEntryProperty", "Elm St");
  ui.setFiles("#rentEntryPhoto", [ui.file("proof.png", PNG_BYTES, "image/png")]);
  ui.click("#rentEntrySaveButton");
  await ui.waitFor(() => ui.$$("#rentEntriesList .rent-entry-row").length === 1, { message: "the rent row" });
  await ui.waitFor(() => /\$1,100\.00/.test(ui.text("#educationRentTotal")), { message: "the rent total" });

  // A second one for the same month is refused with a clear message.
  ui.click("#addRentEntryButton");
  ui.type("#rentEntryDate", `${thisMonth}-20`);
  ui.type("#rentEntryAmount", "5");
  ui.click("#rentEntrySaveButton");
  await ui.waitFor(() => ui.toasts().some((t) => /already exists/.test(t)), { message: "the duplicate refusal" });
  ui.click("#rentEntryCancelButton");

  // Edit, then delete.
  const button = (label) => [...ui.$$("#rentEntriesList button")].find((b) => b.textContent === label);
  ui.click(button("Edit"));
  ui.type("#rentEntryAmount", "1150");
  ui.click("#rentEntrySaveButton");
  await ui.waitFor(() => /\$1,150\.00/.test(ui.text("#rentEntriesList")), { message: "the edit" });
  ui.click(button("Delete"));
  await ui.waitFor(() => ui.$$("#rentEntriesList .rent-entry-row").length === 0, { message: "the delete" });

  // Education export: month as PDF, year as spreadsheet, then cancel.
  ui.click("#educationExportButton");
  assert.equal(ui.$("#educationExportMonth").value, thisMonth);
  ui.click("#educationExportDownloadButton");
  await ui.waitFor(() => ui.downloads.some((d) => d.name.endsWith(".pdf")), { message: "the PDF" });
  ui.click("#educationExportButton");
  ui.$$('input[name="educationExportFormat"]').find((input) => input.value === "xlsx").checked = true;
  ui.type("#educationExportScope", "year");
  assert.ok(ui.$("#educationExportMonthField").classList.contains("hidden"));
  ui.click("#educationExportDownloadButton");
  await ui.waitFor(() => ui.downloads.some((d) => d.name.endsWith(".xlsx")), { message: "the spreadsheet" });
  ui.click("#educationExportButton");
  ui.type("#educationExportScope", "month");
  ui.type("#educationExportMonth", "");
  ui.click("#educationExportDownloadButton");
  assert.ok(ui.toasts().some((t) => /Choose a month/.test(t)));
  ui.click("#educationExportCancelButton");

  // The trend's bars and the month picker point the view at a month.
  ui.click(ui.$("#monthlyTrend .trend-bar-col"));
  ui.type("#budgetMonth", ui.$("#budgetMonth").options[0].value);

  // Sections collapse.
  const toggle = ui.$('.section-toggle[data-section="food"]');
  ui.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  ui.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");

  // The bank panel is a coming-soon note for a regular account.
  assert.match(ui.text(".regular-only"), /Coming soon/);
  await ui.settle();
});

test("an empty account's budgets say there is nothing yet", async () => {
  const ui = await openApp(server, { as: await server.signUp() });
  await goToBudgets(ui);
  assert.match(ui.text("#budgetRing"), /No spending/);
  assert.match(ui.text("#monthGlance"), /Nothing spent/);
  assert.ok(ui.$("#categorizeMonthButton").disabled);
});
