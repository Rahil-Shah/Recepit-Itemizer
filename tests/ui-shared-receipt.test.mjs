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
