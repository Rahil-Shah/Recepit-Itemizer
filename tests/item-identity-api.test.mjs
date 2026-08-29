import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing, plain, createLocalStorageFake } from "./helpers/load-bundle.mjs";

// Captures the requests the service makes and replies with whatever the test
// queued, so the transport can be exercised without a server.
function fakeFetch(responses) {
  const calls = [];
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const fetch = (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return Promise.resolve({
      ok: next.ok !== false,
      status: next.status ?? 200,
      json: () => Promise.resolve(next.body ?? {})
    });
  };
  return { fetch, calls };
}

function makeService(responses, storedModel) {
  const { fetch, calls } = fakeFetch(responses);
  const localStorage = createLocalStorageFake();
  if (storedModel) localStorage.setItem("gemini_model", storedModel);
  const { ReceiptRing } = loadReceiptRing({ fetch, localStorage });
  return { service: new ReceiptRing.Services.ItemIdentityApiService(), calls };
}

const request = { lineId: "l1", label: "QQZ XZ9", itemCode: "12345", amount: 4.5 };

test("posts the lines and maps the answers back", async () => {
  const { service, calls } = makeService({
    body: {
      items: [
        {
          id: "l1",
          name: "Quiznos Gift Card",
          brand: "Quiznos",
          size: null,
          confidence: 0.82,
          reasoning: "QQZ is the store's code for gift cards.",
          alternatives: [{ name: "Quiche", confidence: 0.1 }]
        }
      ]
    }
  });

  const [answer] = await service.identify([request], "Walmart");

  assert.equal(calls[0].url, "/api/items/identify");
  assert.equal(calls[0].body.storeName, "Walmart");
  assert.deepEqual(calls[0].body.items[0], {
    id: "l1",
    label: "QQZ XZ9",
    itemCode: "12345",
    amount: 4.5
  });

  assert.equal(answer.lineId, "l1");
  assert.equal(answer.resolvedName, "Quiznos Gift Card");
  assert.equal(answer.brand, "Quiznos");
  assert.equal(answer.source, "ai");
  assert.equal(answer.confidence, 0.82);
  assert.equal(answer.confirmed, false);
  assert.equal(answer.alternatives[0].name, "Quiche");
});

test("keeps the receipt's own label rather than whatever came back", async () => {
  const { service } = makeService({
    body: { items: [{ id: "l1", name: "Cheese", confidence: 0.9, alternatives: [] }] }
  });

  const [answer] = await service.identify([request], "Walmart");

  assert.equal(answer.rawLabel, "QQZ XZ9");
  assert.equal(answer.itemCode, "12345");
});

test("makes no request at all for an empty batch", async () => {
  const { service, calls } = makeService({ body: { items: [] } });

  assert.deepEqual(plain(await service.identify([], "Walmart")), []);
  assert.equal(calls.length, 0);
});

test("drops an answer about a line it never asked about", async () => {
  const { service } = makeService({
    body: {
      items: [
        { id: "ghost", name: "Not On This Receipt", confidence: 0.99, alternatives: [] },
        { id: "l1", name: "Cheese", confidence: 0.9, alternatives: [] }
      ]
    }
  });

  const answers = await service.identify([request], "Walmart");

  assert.equal(answers.length, 1);
  assert.equal(answers[0].lineId, "l1");
});

test("clamps a confidence outside the range whatever the body said", async () => {
  const { service } = makeService({
    body: {
      items: [
        { id: "l1", name: "Cheese", confidence: 7, alternatives: [{ name: "Other", confidence: -2 }] }
      ]
    }
  });

  const [answer] = await service.identify([request], "Walmart");

  assert.equal(answer.confidence, 1);
  assert.equal(answer.alternatives[0].confidence, 0);
});

test("surfaces the server's error message", async () => {
  const { service } = makeService({
    ok: false,
    status: 429,
    body: { error: "Too many identification requests. Give it a minute." }
  });

  await assert.rejects(() => service.identify([request], "Walmart"), /Give it a minute/);
});

test("reports a status when the error body is unreadable", async () => {
  const { service } = makeService({ ok: false, status: 502, body: {} });

  await assert.rejects(() => service.identify([request], "Walmart"), /502/);
});

test("splits a very long receipt into more than one request", async () => {
  const requests = Array.from({ length: 130 }, (_, index) => ({
    lineId: `l${index}`,
    label: `ITEM ${index}`,
    amount: 1
  }));
  const { service, calls } = makeService({ body: { items: [] } });

  await service.identify(requests, "Walmart");

  assert.equal(calls.length, 3);
  assert.equal(calls[0].body.items.length, 60);
  assert.equal(calls[2].body.items.length, 10);
});

test("survives a response with no items array", async () => {
  const { service } = makeService({ body: {} });

  assert.deepEqual(plain(await service.identify([request], "Walmart")), []);
});

test("sends the model the receipt was parsed with", async () => {
  const { service, calls } = makeService({ body: { items: [] } }, "gemini-3.5-flash");

  await service.identify([request], "Walmart");

  assert.equal(calls[0].body.model, "gemini-3.5-flash");
});

test("falls back to flash-lite when Settings has never been opened", async () => {
  const { service, calls } = makeService({ body: { items: [] } });

  await service.identify([request], "Walmart");

  assert.equal(calls[0].body.model, "gemini-3.5-flash-lite");
});
