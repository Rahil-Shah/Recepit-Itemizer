import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers/test-server.mjs";
import { openApp } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
test.after(() => server.close());

async function seeded() {
  const user = await server.signUp();
  const saved = await user.post("/api/receipts", {
    storeName: "Chipotle",
    category: "Dining",
    total: 11,
    people: [],
    assignments: [],
    lines: [{ clientId: "a", label: "Burrito", amount: 11, ignored: false }]
  });
  const ui = await openApp(server, { as: user });
  ui.click("#tabHistory");
  await ui.waitFor(() => ui.$("#historyList .history-card"), { message: "the card" });
  return { user, ui, receipt: saved.body };
}

const shareButton = (ui) => [...ui.$$("#historyList .history-actions button")].find((b) => b.textContent === "Share");
const tokenFrom = (url) => new URL(url).pathname.split("/").pop();
const visitor = () => server.client();

test("share: pick how long, create the link, and a stranger can open it", async () => {
  const { ui, user, receipt } = await seeded();
  ui.click(shareButton(ui));
  assert.ok(!ui.$("#shareModal").classList.contains("hidden"));
  assert.match(ui.text("#shareTitle"), /Chipotle/);
  assert.equal(ui.$("#shareCanEdit").checked, false);

  // Nothing sensible to work with: said here, and nothing created.
  ui.type("#shareDurationAmount", "");
  ui.click("#shareCreateButton");
  assert.match(ui.text("#shareStatus"), /whole number/);
  ui.type("#shareDurationAmount", "1.5");
  ui.click("#shareCreateButton");
  assert.match(ui.text("#shareStatus"), /whole number/);

  // Past the limit: the server's sentence.
  ui.type("#shareDurationAmount", "31");
  ui.click("#shareCreateButton");
  await ui.waitFor(() => /30 days/.test(ui.text("#shareStatus")), { message: "the refusal" });
  assert.ok(ui.$("#shareResult").classList.contains("hidden"));

  ui.type("#shareDurationAmount", "2");
  ui.$("#shareDurationUnit").value = "hours";
  const before = Date.now();
  ui.click("#shareCreateButton");
  await ui.waitFor(() => ui.$("#shareLinkInput").value, { message: "the link" });
  assert.equal(ui.text("#shareStatus"), "");
  assert.ok(!ui.$("#shareResult").classList.contains("hidden"));

  const url = ui.$("#shareLinkInput").value;
  assert.ok(url.startsWith(`${server.baseUrl}/r/`));
  const read = await visitor().get(`/api/shared-receipts/${tokenFrom(url)}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.storeName, "Chipotle");
  assert.equal(read.body.canEdit, false);
  const lasts = Date.parse(read.body.expiresAt) - before;
  assert.ok(lasts > 1.9 * 3_600_000 && lasts < 2.1 * 3_600_000, `lasts ${lasts}`);

  // It shows up as active, without its secret.
  await ui.waitFor(() => ui.$$("#shareActiveList .share-active-row").length === 1, { message: "the active list" });
  assert.ok(!ui.$("#shareActive").classList.contains("hidden"));
  assert.match(ui.text("#shareActiveList"), /Expires/);
  assert.ok(!ui.text("#shareActiveList").includes(tokenFrom(url)));
  assert.equal((await user.get(`/api/receipts/${receipt.id}/shares`)).body.length, 1);
  assert.deepEqual(ui.errors, []);
});

test("share: the edit toggle is off by default, on when asked, and can be flipped later", async () => {
  const { ui } = await seeded();
  ui.click(shareButton(ui));
  ui.$("#shareCanEdit").checked = true;
  ui.click("#shareCreateButton");
  await ui.waitFor(() => ui.$("#shareLinkInput").value, { message: "the link" });
  const api = `/api/shared-receipts/${tokenFrom(ui.$("#shareLinkInput").value)}`;
  assert.equal((await visitor().get(api)).body.canEdit, true);

  await ui.waitFor(() => ui.$("#shareActiveList input"), { message: "the active list" });
  const toggle = ui.$("#shareActiveList input");
  assert.equal(toggle.checked, true);
  toggle.checked = false;
  toggle.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  await ui.waitFor(async () => (await visitor().get(api)).body.canEdit === false, { message: "editing to go off" });
  await ui.waitFor(() => !toggle.disabled, { message: "the toggle" });
  assert.equal(toggle.checked, false);
  assert.deepEqual(ui.errors, []);
});

test("share: a failed toggle shows what is really in force", async () => {
  const { ui, receipt, user } = await seeded();
  const link = await user.post(`/api/receipts/${receipt.id}/shares`, { expiresInMinutes: 60 });
  ui.click(shareButton(ui));
  await ui.waitFor(() => ui.$("#shareActiveList input"), { message: "the active list" });

  await user.delete(`/api/receipts/${receipt.id}/shares/${link.body.id}`);
  const toggle = ui.$("#shareActiveList input");
  toggle.checked = true;
  toggle.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  await ui.waitFor(() => /Link not found/.test(ui.text("#shareStatus")), { message: "the refusal" });
  assert.equal(toggle.checked, false);
});

test("share: stop sharing kills the link, and reopening the dialog starts clean", async () => {
  const { ui } = await seeded();
  ui.click(shareButton(ui));
  ui.click("#shareCreateButton");
  await ui.waitFor(() => ui.$("#shareLinkInput").value, { message: "the link" });
  const api = `/api/shared-receipts/${tokenFrom(ui.$("#shareLinkInput").value)}`;
  await ui.waitFor(() => ui.$("#shareActiveList .btn-danger"), { message: "the active list" });

  ui.click("#shareActiveList .btn-danger");
  await ui.waitFor(() => ui.$("#shareActive").classList.contains("hidden"), { message: "the link to go" });
  assert.equal((await visitor().get(api)).status, 404);

  ui.click("#shareCloseButton");
  assert.ok(ui.$("#shareModal").classList.contains("hidden"));
  ui.click(shareButton(ui));
  assert.ok(ui.$("#shareResult").classList.contains("hidden"));
  assert.equal(ui.$("#shareLinkInput").value, "");

  // Escape and the backdrop close it too.
  ui.key(ui.document, "Escape");
  assert.ok(ui.$("#shareModal").classList.contains("hidden"));
  ui.click(shareButton(ui));
  ui.click("#shareModal");
  assert.ok(ui.$("#shareModal").classList.contains("hidden"));
  assert.deepEqual(ui.errors, []);
});

test("share: copy goes to the clipboard, and says so when it can't", async () => {
  const { ui } = await seeded();
  ui.click(shareButton(ui));
  ui.click("#shareCreateButton");
  await ui.waitFor(() => ui.$("#shareLinkInput").value, { message: "the link" });

  const copied = [];
  Object.defineProperty(ui.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text) => copied.push(text) }
  });
  ui.click("#shareCopyButton");
  await ui.waitFor(() => ui.text("#shareCopyButton") === "Copied", { message: "the copy" });
  assert.deepEqual(copied, [ui.$("#shareLinkInput").value]);

  Object.defineProperty(ui.window.navigator, "clipboard", { configurable: true, value: undefined });
  ui.click("#shareCopyButton");
  await ui.waitFor(() => /Couldn't copy/.test(ui.text("#shareStatus")), { message: "the fallback" });
});
