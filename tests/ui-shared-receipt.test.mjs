import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startTestServer } from "./helpers/test-server.mjs";
import { openSharedPage } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
test.after(() => server.close());

async function sharedReceipt({ canEdit = false } = {}) {
  const user = await server.signUp({ name: "Rahil" });
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;
  const saved = await user.post("/api/receipts", {
    storeName: "<b>Costco</b>",
    category: "Groceries",
    subtotal: 40,
    tax: 4,
    total: 44,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [
      { clientId: "a", label: "Wine", amount: 30, ignored: false },
      { clientId: "b", label: "Socks", amount: 7, ignored: false },
      { clientId: "c", label: "Gum", amount: 3, ignored: false }
    ],
    assignments: [
      { lineClientId: "a", personClientId: me.id, mode: "percentage", value: 25 },
      { lineClientId: "a", personClientId: sam.id, mode: "percentage", value: 75 },
      { lineClientId: "b", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "b", personClientId: sam.id, mode: "equal", value: 0 }
    ]
  });
  const link = await user.post(`/api/receipts/${saved.body.id}/shares`, { expiresInMinutes: 60, canEdit });
  return { user, receipt: saved.body, link: link.body };
}

test("a share link serves the page to anyone, on any host", async () => {
  const page = await server.client().get("/r/anything");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /html/);
  assert.match(page.body, /src="\/shared\.js"/);
  assert.match(page.body, /name="robots" content="noindex"/);
  // Vercel serves public/ itself, so the same path needs a rewrite there.
  const { rewrites } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(rewrites.some((rule) => rule.source === "/r/:token" && rule.destination === "/shared.html"));
});

test("a stranger sees the items, totals and who owes what, and can filter by person", async () => {
  const { link } = await sharedReceipt();
  const ui = await openSharedPage(server, link.path);

  // Text from the receipt is text, never markup.
  assert.equal(ui.text(".page-title"), "<b>Costco</b>");
  assert.equal(ui.$(".page-title b"), null);
  assert.match(ui.document.title, /Costco/);
  const lines = ui.$(".shared-lines");
  assert.equal(lines.querySelectorAll(".shared-row").length, 3);
  assert.match(lines.textContent, /WineRahil, Sam\$30\.00/);
  assert.match(ui.text(".shared-totals"), /Subtotal\$40\.00.*Tax\$4\.00.*Total\$44\.00/);
  assert.match(ui.text(".shared-expiry"), /This link expires/);

  const split = ui.text(".shared-split");
  assert.match(split, /Who owes what/);
  assert.match(split, /Rahil\$/);
  assert.match(split, /Not assigned to anyone\$3\.00/);

  // No way to change a view-only link.
  assert.equal(ui.$(".shared-edit-button"), null);

  const chip = (name) => ui.$$(".person-chip").find((c) => c.textContent === name);
  ui.click(chip("Sam"));
  assert.ok(lines.classList.contains("hidden"));
  const panel = ui.text(".person-breakdown");
  assert.match(panel, /Split by % · 75%\$22\.50of \$30\.00/);
  assert.match(panel, /Split evenly · 2 people/);
  ui.click(chip("Everyone"));
  assert.ok(!lines.classList.contains("hidden"));
  assert.deepEqual(ui.errors, []);
});

test("a receipt with no split skips the split sections", async () => {
  const user = await server.signUp();
  const saved = await user.post("/api/receipts", {
    storeName: null,
    category: "Dining",
    total: 9,
    people: [],
    assignments: [],
    lines: [{ clientId: "a", label: "Burrito", amount: 9, ignored: false }]
  });
  const link = await user.post(`/api/receipts/${saved.body.id}/shares`, { expiresInMinutes: 5 });
  const ui = await openSharedPage(server, link.body.path);
  assert.equal(ui.text(".page-title"), "Shared receipt");
  assert.equal(ui.$(".person-chips"), null);
  assert.equal(ui.$(".shared-split"), null);
  assert.match(ui.text(".shared-totals"), /Total\$9\.00/);
  assert.doesNotMatch(ui.text(".shared-totals"), /Subtotal|Tax/);
});

test("an expired or made-up link says so", async () => {
  const { link } = await sharedReceipt();
  await server.prisma.receiptShare.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await openSharedPage(server, link.path);
  assert.match(expired.text(".page-title"), /no longer available/);

  const madeUp = await openSharedPage(server, "/r/not-a-real-token");
  assert.match(madeUp.text(".page-title"), /no longer available/);
  assert.equal(madeUp.$(".shared-card"), null);
});

test("with edit access, a stranger can change the items, tax and split, and the owner sees it", async () => {
  const { user, receipt, link } = await sharedReceipt({ canEdit: true });
  const ui = await openSharedPage(server, link.path);
  const inputs = () => ui.$$(".shared-editor-line");
  const line = (index) => inputs()[index];
  const name = (index) => line(index).querySelector('input[type="text"]');
  const price = (index) => line(index).querySelector(".shared-editor-amount");
  const chip = (index, person) => [...line(index).querySelectorAll(".person-chip")].find((c) => c.textContent === person);
  const owned = async () => (await user.get("/api/receipts")).body.find((item) => item.id === receipt.id);

  ui.click(ui.$(".shared-edit-button"));
  assert.equal(inputs().length, 3);

  // A form that cannot be saved says why and sends nothing.
  ui.type(name(0), "  ");
  ui.$(".shared-editor").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.match(ui.text(".shared-editor-error"), /needs a name/);
  ui.type(name(0), "Red wine");
  ui.type(price(0), "");
  ui.$(".shared-editor").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.match(ui.text(".shared-editor-error"), /Enter a price for Red wine/);
  assert.ok(!ui.requests.some((request) => request.startsWith("PUT")));

  // Cancel throws it all away.
  ui.click([...ui.$$(".shared-editor button")].find((b) => b.textContent === "Cancel"));
  assert.match(ui.text(".shared-lines"), /Wine/);
  assert.doesNotMatch(ui.text(".shared-lines"), /Red wine/);

  ui.click(ui.$(".shared-edit-button"));
  ui.type(ui.$('.shared-editor input[aria-label="Store name"]'), "Costco Wholesale");
  ui.type(price(0), "40");

  // Percentages keep their people; adjust one.
  const samPercent = line(0).querySelector('input[aria-label="Sam (%)"]');
  assert.equal(samPercent.value, "75");
  ui.type(samPercent, "50");
  ui.type(line(0).querySelector('input[aria-label="Rahil (%)"]'), "50");

  // Socks go to Sam alone. A switch of mode starts everyone on an even share.
  ui.click(chip(1, "Rahil"));
  const mode = line(1).querySelector(".shared-editor-mode");
  ui.type(mode, "amount");
  assert.equal(line(1).querySelector('input[aria-label="Sam ($)"]').value, "7");

  // Gum goes, bread comes.
  ui.click(line(2).querySelector(".shared-remove-item"));
  ui.click(ui.$(".shared-add-item"));
  ui.type(name(2), "Bread");
  ui.type(price(2), "3.5");
  ui.click(chip(2, "Rahil"));

  ui.type(ui.$('.shared-editor input[aria-label="Tax"]'), "5");
  ui.$(".shared-editor").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => ui.$(".shared-lines"), "the save");

  // Back on the page, from what the server answered.
  assert.equal(ui.text(".page-title"), "Costco Wholesale");
  assert.match(ui.text(".shared-totals"), /Subtotal\$50\.50.*Tax\$5\.00.*Total\$55\.50/);
  assert.match(ui.text(".shared-split"), /Rahil\$25\.83.*Sam\$29\.67/);

  const after = await owned();
  assert.equal(after.storeName, "Costco Wholesale");
  assert.equal(after.total, 55.5);
  // "Red wine" went with the cancelled form.
  assert.deepEqual(after.lines.map((item) => item.label), ["Wine", "Socks", "Bread"]);
  const socks = after.lines.find((item) => item.label === "Socks");
  assert.deepEqual(socks.assignments.map((a) => [a.personName, a.mode, a.value]), [["Sam", "amount", 7]]);
  assert.deepEqual(ui.errors, []);
});

test("a refused save keeps the form and says why", async () => {
  const { user, receipt, link } = await sharedReceipt({ canEdit: true });
  const ui = await openSharedPage(server, link.path);
  ui.click(ui.$(".shared-edit-button"));

  // The owner turns editing off while the form is open.
  await user.patch(`/api/receipts/${receipt.id}/shares/${link.id}`, { canEdit: false });
  ui.$(".shared-editor").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => ui.text(".shared-editor-error"), "the refusal");
  assert.match(ui.text(".shared-editor-error"), /view only/);
  assert.equal(ui.$(".shared-save").disabled, false);
  assert.ok(ui.$(".shared-editor"));
});

test("a receipt with no people can still have its items edited, but no split is offered", async () => {
  const user = await server.signUp();
  const saved = await user.post("/api/receipts", {
    storeName: "Deli",
    category: "Dining",
    total: 9,
    people: [],
    assignments: [],
    lines: [{ clientId: "a", label: "Burrito", amount: 9, ignored: false }]
  });
  const link = await user.post(`/api/receipts/${saved.body.id}/shares`, { expiresInMinutes: 5, canEdit: true });
  const ui = await openSharedPage(server, link.body.path);
  ui.click(ui.$(".shared-edit-button"));
  assert.equal(ui.$(".shared-editor-mode"), null);

  // Removing the only item is refused here rather than at the server.
  ui.click(ui.$(".shared-remove-item"));
  ui.$(".shared-editor").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.match(ui.text(".shared-editor-error"), /at least one item/);
});
