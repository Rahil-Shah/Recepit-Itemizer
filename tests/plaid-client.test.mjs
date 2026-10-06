import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { EventEmitter } from "node:events";
import * as plaid from "../server/plaid.mjs";

// https.request answered in-process: each test queues what "Plaid" says.
const sent = [];
let answer = { status: 200, body: "{}" };
const realRequest = https.request;
https.request = (options, onResponse) => {
  const req = new EventEmitter();
  let written = "";
  req.write = (chunk) => {
    written += chunk;
  };
  req.setTimeout = (ms, onTimeout) => {
    req.timeoutMs = ms;
    req.onTimeout = onTimeout;
  };
  req.destroy = (error) => req.emit("error", error);
  req.end = () => {
    sent.push({ options, body: JSON.parse(written) });
    if (answer.error) return req.emit("error", answer.error);
    if (answer.timeout) return req.onTimeout();
    const res = new EventEmitter();
    res.statusCode = answer.status;
    onResponse(res);
    if (answer.body) res.emit("data", answer.body);
    res.emit("end");
  };
  return req;
};
test.after(() => {
  https.request = realRequest;
});

test("config reports whether credentials are set, and which environment", () => {
  process.env.PLAID_CLIENT_ID = "";
  process.env.PLAID_SECRET = "";
  process.env.PLAID_ENV = "production";
  assert.deepEqual(plaid.plaidConfig(), { environment: "production", configured: false });
  process.env.PLAID_CLIENT_ID = "client";
  process.env.PLAID_SECRET = "secret";
  process.env.PLAID_ENV = "development"; // retired: falls back to sandbox
  assert.deepEqual(plaid.plaidConfig(), { environment: "sandbox", configured: true });
});

test("each call posts to its endpoint with the credentials in the body", async () => {
  answer = { status: 200, body: JSON.stringify({ link_token: "link-1" }) };
  assert.equal((await plaid.createLinkToken(42)).link_token, "link-1");
  const [first] = sent.splice(0);
  assert.equal(first.options.host, "sandbox.plaid.com");
  assert.equal(first.options.path, "/link/token/create");
  assert.equal(first.body.client_id, "client");
  assert.equal(first.body.secret, "secret");
  assert.equal(first.body.user.client_user_id, "42");

  answer = { status: 200, body: "{}" };
  await plaid.exchangePublicToken("pub");
  await plaid.getItem("acc");
  await plaid.getAccounts("acc");
  await plaid.removeItem("acc");
  await plaid.syncTransactions("acc", null);
  await plaid.syncTransactions("acc", "cursor-1");
  assert.deepEqual(
    sent.map((call) => call.options.path),
    ["/item/public_token/exchange", "/item/get", "/accounts/get", "/item/remove", "/transactions/sync", "/transactions/sync"]
  );
  assert.equal(sent[4].body.cursor, undefined);
  assert.equal(sent[5].body.cursor, "cursor-1");
  sent.splice(0);
});

test("an error status carries Plaid's error code, without the request body", async () => {
  answer = { status: 400, body: JSON.stringify({ error_code: "PRODUCT_NOT_READY", error_message: "not yet" }) };
  await assert.rejects(plaid.syncTransactions("acc"), (error) => {
    assert.equal(error.plaidErrorCode, "PRODUCT_NOT_READY");
    assert.equal(error.status, 400);
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
  answer = { status: 500, body: "plain text failure" };
  await assert.rejects(plaid.getItem("acc"), /plain text failure/);
});

test("invalid JSON, an empty body, network errors and timeouts", async () => {
  answer = { status: 200, body: "{not json" };
  await assert.rejects(plaid.getAccounts("acc"), /invalid JSON/);
  answer = { status: 200, body: "" };
  assert.equal(await plaid.removeItem("acc"), null);
  answer = { error: new Error("ECONNRESET") };
  await assert.rejects(plaid.getAccounts("acc"), /ECONNRESET/);
  answer = { timeout: true };
  await assert.rejects(plaid.getAccounts("acc"), /timed out/);
});
