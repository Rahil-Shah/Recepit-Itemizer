import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

// Loads the bundle with a recording fetch fake so the service's URLs, methods,
// and payloads can be asserted without a server.
function makeService(response = { ok: true, json: {} }) {
  const calls = [];
  const fetchFake = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.json,
      text: async () => JSON.stringify(response.json)
    };
  };
  const { ReceiptRing } = loadReceiptRing({ fetch: fetchFake });
  return { service: new ReceiptRing.Services.ReceiptApiService(), calls };
}

const payload = {
  storeName: "Walmart",
  category: "Groceries",
  subtotal: 3.24,
  tax: 0.2,
  total: 3.44,
  people: [{ clientId: "p-me" }],
  lines: [{ clientId: "l1", label: "GV SHRD MOZZ 8Z", amount: 3.24, ignored: false, isFood: true }],
  assignments: [{ lineClientId: "l1", personClientId: "p-me", mode: "equal", value: 0 }],
  imageDataUrl: null
};

test("update puts the edited receipt to that receipt's own url", async () => {
  const { service, calls } = makeService({ ok: true, json: { id: "r1" } });
  const saved = await service.update("r1", payload);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/receipts/r1");
  assert.equal(calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  assert.equal(saved.id, "r1");
});

test("update escapes the receipt id into the path", async () => {
  const { service, calls } = makeService({ ok: true, json: { id: "r/1" } });
  await service.update("r/1", payload);

  assert.equal(calls[0].url, "/api/receipts/r%2F1");
});

test("a refused update throws with the server's reason", async () => {
  const { service } = makeService({ ok: false, status: 404, json: { error: "Receipt not found." } });

  await assert.rejects(service.update("gone", payload), /Update failed \(404\).*Receipt not found/);
});
