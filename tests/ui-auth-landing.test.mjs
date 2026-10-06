import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers/test-server.mjs";
import { openApp } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
test.after(() => server.close());

test("a visitor sees the landing page, signs up through the dialog, and lands in the app", async () => {
  const ui = await openApp(server);
  assert.equal(ui.document.body.dataset.auth, "anon");

  // The mobile menu opens and closes.
  ui.click("#landingMenuToggle");
  assert.ok(ui.$("#landingMenu").classList.contains("is-open"));
  ui.key(ui.document, "Escape");
  assert.ok(!ui.$("#landingMenu").classList.contains("is-open"));

  ui.click('[data-auth-action="register"]');
  assert.ok(!ui.$("#authOverlay").classList.contains("hidden"));
  assert.ok(!ui.$("#authNameField").classList.contains("hidden"));
  ui.type("#authName", "Visitor");
  ui.type("#authEmail", "visitor@test.dev");
  ui.type("#authPassword", "short");
  ui.$("#authForm").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => !ui.$("#authError").classList.contains("hidden"), { message: "the password error" });

  ui.type("#authPassword", "a long enough password");
  ui.$("#authForm").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => ui.document.body.dataset.auth === "user", { message: "sign-up" });
  await ui.settle();
  assert.equal(ui.document.body.dataset.access, "regular");
  assert.ok(ui.$(".regular-only"));
  assert.deepEqual(ui.errors, []);
});

test("logging in from the landing page, a wrong password first", async () => {
  await server.signUp({ email: "returning@test.dev", password: "my real password" });
  const ui = await openApp(server);
  ui.click('[data-auth-action="login"]');
  ui.click("#authToggle");
  ui.click("#authToggle");
  ui.type("#authEmail", "returning@test.dev");
  ui.type("#authPassword", "not my password");
  ui.$("#authForm").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => /Invalid/.test(ui.text("#authError")), { message: "the login error" });

  ui.type("#authPassword", "my real password");
  ui.$("#authForm").dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(() => ui.document.body.dataset.auth === "user", { message: "login" });
  await ui.settle();
});

test("the auth dialog closes from its button and from Escape", async () => {
  const ui = await openApp(server);
  ui.click('[data-auth-action="login"]');
  ui.click("#authCloseButton");
  assert.ok(ui.$("#authOverlay").classList.contains("hidden"));
  ui.click('[data-auth-action="register"]');
  ui.key(ui.document, "Escape");
  assert.ok(ui.$("#authOverlay").classList.contains("hidden"));
});

test("signed in, the logo opens the home page and Open app comes back", async () => {
  const ui = await openApp(server, { as: await server.signUp() });
  assert.equal(ui.document.body.dataset.auth, "user");
  ui.click("#appBrandLink");
  assert.equal(ui.document.body.dataset.view, "landing");
  ui.click('[data-app-action="open"]');
  await ui.waitFor(() => ui.document.body.dataset.view === undefined, { message: "back to the app" });

  // Every landing call to action leads back to the app for a signed-in user.
  ui.click("#appBrandLink");
  ui.click('[data-auth-action="register"]');
  await ui.waitFor(() => ui.document.body.dataset.view === undefined, { message: "back again" });
  assert.ok(ui.$("#authOverlay").classList.contains("hidden"));
});

test("logging out ends the session", async () => {
  const user = await server.signUp();
  const ui = await openApp(server, { as: user });
  ui.click("#logoutButton");
  // jsdom cannot reload a page; the session ending on the server is the part
  // that matters.
  await ui.waitFor(async () => (await server.client({}).get("/api/health")) && ui.requests.includes("POST /api/auth/logout"), {
    message: "the logout"
  });
  assert.equal((await user.get("/api/auth/me")).status, 401);
});
