import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";
import { openApp } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
test.after(() => server.close());

const VALID_KEY = "AIza" + "z".repeat(35);
const submit = (ui, selector) => ui.$(selector).dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));

test("settings: profile, password, sessions, Gemini key, preferences, and back", async () => {
  const user = await server.signUp({ name: "Old Name", password: "first password" });
  const elsewhere = server.client();
  await elsewhere.post("/api/auth/login", { email: user.user.email, password: "first password" });

  const ui = await openApp(server, { as: user });
  ui.click("#tabHistory");
  ui.click("#settingsButton");
  await ui.waitFor(() => !ui.$("#settingsView").classList.contains("hidden"), { message: "settings to open" });
  assert.equal(ui.text("#profileEmail"), user.user.email);
  assert.match(ui.text("#profileRole"), /Standard/);
  assert.ok(ui.$("#adminView").classList.contains("hidden"));
  await ui.waitFor(() => /2 devices/.test(ui.text("#sessionStatus")), { message: "the session count" });
  assert.equal(ui.$$("#sessionList .session-item").length, 2);

  // The section index scrolls instead of navigating.
  ui.click(ui.$('.settings-nav a[href="#settingsGemini"]'));

  // Name.
  ui.type("#profileName", "New Name");
  submit(ui, "#profileForm");
  await ui.waitFor(() => /Saved/.test(ui.text("#profileStatus")), { message: "the name" });
  assert.equal((await user.get("/api/auth/me")).body.name, "New Name");

  // Password: mismatch and too short are caught here, wrong current by the server.
  ui.type("#currentPassword", "first password");
  ui.type("#newPassword", "short");
  ui.type("#confirmPassword", "short");
  submit(ui, "#passwordForm");
  assert.match(ui.text("#passwordStatus"), /at least 8/);
  ui.type("#newPassword", "second password");
  ui.type("#confirmPassword", "different password");
  submit(ui, "#passwordForm");
  assert.match(ui.text("#passwordStatus"), /don't match/);
  ui.type("#currentPassword", "wrong password");
  ui.type("#confirmPassword", "second password");
  submit(ui, "#passwordForm");
  await ui.waitFor(() => /not correct/.test(ui.text("#passwordStatus")), { message: "the wrong-password error" });
  ui.type("#currentPassword", "first password");
  ui.type("#newPassword", "second password");
  ui.type("#confirmPassword", "second password");
  submit(ui, "#passwordForm");
  await ui.waitFor(() => /Password changed/.test(ui.text("#passwordStatus")), { message: "the change" });
  assert.equal((await elsewhere.get("/api/auth/me")).status, 401);
  await ui.waitFor(() => /only signed in here/.test(ui.text("#sessionStatus")), { message: "one session" });
  assert.ok(ui.$("#revokeSessionsButton").disabled);

  // Sign the others out (after another sign-in elsewhere).
  await server.client().post("/api/auth/login", { email: user.user.email, password: "second password" });
  ui.click("#settingsButton");
  await ui.waitFor(() => !ui.$("#revokeSessionsButton").disabled, { message: "a second session" });
  ui.click("#revokeSessionsButton");
  await ui.waitFor(() => /only signed in here/.test(ui.text("#sessionStatus")), { message: "the revoke" });

  // Gemini: a bad key, a good key, the model alone, then remove.
  ui.type("#geminiApiKey", "nope");
  ui.click("#saveSettingsButton");
  await ui.waitFor(() => /valid Gemini/.test(ui.text("#geminiKeyStatus")), { message: "the key error" });
  ui.type("#geminiApiKey", VALID_KEY);
  ui.click("#saveSettingsButton");
  await ui.waitFor(() => /saved to your account/.test(ui.text("#geminiKeyStatus")), { message: "the key" });
  ui.type("#geminiModel", "gemini-3.5-flash");
  ui.click("#saveSettingsButton");
  assert.equal(ui.window.localStorage.getItem("gemini_model"), "gemini-3.5-flash");
  ui.click("#removeKeyButton");
  await ui.waitFor(() => /No key yet/.test(ui.text("#geminiKeyStatus")), { message: "the removal" });

  // Preferences are kept on the device and used next time.
  ui.type("#prefStartTab", "budgeting");
  ui.type("#prefCategory", "Dining");
  assert.match(ui.window.localStorage.getItem("receipt-ring-preferences"), /budgeting/);

  ui.click("#closeSettingsButton");
  assert.equal(ui.document.body.dataset.tab, "history");

  const next = await openApp(server, {
    as: user,
    setup: (later) => later.window.localStorage.setItem("receipt-ring-preferences", JSON.stringify({ startTab: "budgeting", defaultCategory: "Dining" }))
  });
  assert.equal(next.document.body.dataset.tab, "budgeting");
  assert.equal(next.$("#receiptCategory").value, "Dining");
  assert.deepEqual(ui.errors, []);
});

test("a regular account cannot reach the admin tools", async () => {
  const user = await server.signUp();
  const ui = await openApp(server, { as: user });
  ui.click(ui.$("#adminToolsButton"));
  assert.notEqual(ui.document.body.dataset.tab, "admin");
  assert.equal((await user.get("/api/admin/overview")).status, 403);
});

test("admin tools: stats, chart, accounts, search, sort, detail, sign-out", async () => {
  const admin = await server.admin();
  const zoe = await server.signUp({ name: "Zoe" });
  await zoe.post("/api/receipts", {
    storeName: "Whole Foods",
    category: "Groceries",
    total: 25,
    lines: [{ clientId: "a", label: "Kale", amount: 25, ignored: false, isFood: true }],
    people: [],
    assignments: [],
    imageDataUrl: JPEG_DATA_URL
  });

  const ui = await openApp(server, { as: admin });
  ui.click("#adminToolsButton");
  await ui.waitFor(() => ui.$$("#adminUsersBody tr").length >= 2, { message: "the accounts" });
  assert.equal(ui.document.body.dataset.tab, "admin");
  assert.match(ui.text("#adminStats"), /Accounts/);
  assert.match(ui.text("#adminStats"), /Items itemized/);
  assert.equal(ui.$$("#adminChart .admin-chart-col").length, 12);
  assert.match(ui.text("#adminCapacity"), /of 20/);

  // Search, then sort by receipts both ways.
  ui.type("#adminUserSearch", "zoe");
  assert.equal(ui.$$("#adminUsersBody tr").length, 1);
  ui.type("#adminUserSearch", "nobody-at-all");
  assert.ok(!ui.$("#adminUsersEmpty").classList.contains("hidden"));
  ui.type("#adminUserSearch", "");
  const sortBy = (key) => ui.click(ui.$(`#adminUsersTable [data-sort="${key}"]`));
  sortBy("receipts");
  assert.equal(ui.$('#adminUsersTable [data-sort="receipts"]').closest("th").getAttribute("aria-sort"), "descending");
  sortBy("receipts");
  assert.equal(ui.$('#adminUsersTable [data-sort="receipts"]').closest("th").getAttribute("aria-sort"), "ascending");
  for (const key of ["email", "joinedAt", "lastSignInAt", "lines", "spend", "photos"]) sortBy(key);

  // Zoe's detail, then sign her out.
  const zoeRow = () => ui.$(`#adminUsersBody tr[data-user-id="${zoe.user.id}"]`);
  ui.click(zoeRow());
  await ui.waitFor(() => /Whole Foods/.test(ui.text("#adminUserDetail")), { message: "the detail" });
  assert.match(ui.text("#adminUserDetail"), /Receipts/);
  ui.confirmAnswer = false;
  ui.click(ui.$('#adminUserDetail [data-action="sign-out"]'));
  assert.equal((await zoe.get("/api/auth/me")).status, 200);
  ui.confirmAnswer = true;
  ui.click(ui.$('#adminUserDetail [data-action="sign-out"]'));
  await ui.waitFor(async () => (await zoe.get("/api/auth/me")).status === 401, { message: "the sign-out" });

  // Keyboard selection of the admin's own row: no sign-out offered.
  ui.key(ui.$(`#adminUsersBody tr[data-user-id="${admin.user.id}"]`), "Enter");
  await ui.waitFor(() => /This is your account/.test(ui.text("#adminUserDetail")), { message: "own detail" });
  ui.click([...ui.$$("#adminUserDetail button")].find((b) => b.textContent === "Close"));
  assert.ok(ui.$("#adminUserDetail").classList.contains("hidden"));

  ui.click("#refreshAdminButton");
  await ui.settle();
  ui.click("#closeAdminButton");
  assert.equal(ui.document.body.dataset.tab, "receipts");

  // The Settings page has its own way in.
  ui.click("#settingsButton");
  ui.click(ui.$("#settingsAdmin [data-open-admin]"));
  assert.equal(ui.document.body.dataset.tab, "admin");
  assert.deepEqual(ui.errors, []);
});

test("deleting the account from Settings", async () => {
  const user = await server.signUp({ password: "delete password" });
  const ui = await openApp(server, { as: user });
  ui.click("#settingsButton");
  ui.click("#deleteAccountButton");
  assert.match(ui.text("#deleteAccountStatus"), /Enter your password/);
  ui.type("#deleteAccountPassword", "not it");
  ui.click("#deleteAccountButton");
  await ui.waitFor(() => /not correct/.test(ui.text("#deleteAccountStatus")), { message: "the wrong password" });
  ui.type("#deleteAccountPassword", "delete password");
  ui.click("#deleteAccountButton");
  await ui.waitFor(async () => (await server.prisma.user.count({ where: { id: user.user.id } })) === 0, { message: "the deletion" });
});

test("exports from Settings: all data, and the admin database backup", async () => {
  const admin = await server.admin();
  const ui = await openApp(server, { as: admin });
  ui.click("#settingsButton");
  ui.click("#exportAllDataButton");
  await ui.waitFor(() => ui.downloads.some((d) => /receipt-ring-export-.*\.zip/.test(d.name)), { message: "the export" });
  ui.$("#backupIncludeSecrets").checked = true;
  ui.confirmAnswer = false;
  ui.click("#databaseBackupButton");
  assert.ok(!ui.downloads.some((d) => /backup/.test(d.name)));
  ui.confirmAnswer = true;
  ui.click("#databaseBackupButton");
  await ui.waitFor(() => ui.downloads.some((d) => /receipt-ring-backup-.*\.zip/.test(d.name)), { message: "the backup" });
  const backup = ui.downloads.find((d) => /backup/.test(d.name));
  assert.ok(backup.blob.size > 100);
});
