import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

function line(id, label, extra = {}) {
  return { id, label, amount: 1, confidence: 1, ignored: false, ...extra };
}

// Records what it was asked, so a test can assert the model was never
// consulted about a line the free tiers already handled.
function recordingAi(answers = []) {
  const calls = [];
  return {
    calls,
    identify(requests, storeName) {
      calls.push({ requests: requests.map((r) => r.lineId), storeName });
      return Promise.resolve(answers);
    }
  };
}

function makeService(ai = null) {
  const normalizer = new ReceiptRing.Services.LabelNormalizerService();
  const aliases = new ReceiptRing.Services.ItemAliasStoreService(normalizer);
  const dictionary = new ReceiptRing.Services.DictionaryResolverService(normalizer);
  const service = new ReceiptRing.Services.ItemIdentityService(aliases, dictionary, ai);
  return { service, aliases, dictionary };
}

test("expands what the dictionary knows without asking the model", async () => {
  const ai = recordingAi();
  const { service } = makeService(ai);

  const result = await service.identify([line("l1", "GV SHRD MOZZ 8Z")], new Map());

  assert.equal(result.get("l1").resolvedName, "Great Value Shredded Mozzarella");
  assert.equal(result.get("l1").source, "dictionary");
  assert.equal(ai.calls.length, 0, "the model should not have been consulted");
});

test("a saved alias beats the dictionary", async () => {
  const { service, aliases } = makeService();
  aliases.remember(
    {
      lineId: "x",
      rawLabel: "GV SHRD MOZZ 8Z",
      resolvedName: "Great Value Low-Moisture Mozzarella",
      confidence: 1,
      source: "user-confirmed",
      alternatives: [],
      confirmed: true
    },
    "Walmart"
  );

  const result = await service.identify([line("l1", "GV SHRD MOZZ 8Z")], new Map(), {
    storeName: "Walmart"
  });

  assert.equal(result.get("l1").source, "saved-alias");
  assert.equal(result.get("l1").resolvedName, "Great Value Low-Moisture Mozzarella");
});

test("only sends the model what the free tiers could not place", async () => {
  const ai = recordingAi([
    {
      lineId: "l2",
      rawLabel: "QQZ XZ9",
      resolvedName: "Mystery Item",
      confidence: 0.6,
      source: "ai",
      alternatives: [],
      confirmed: false
    }
  ]);
  const { service } = makeService(ai);

  const result = await service.identify(
    [line("l1", "GV SHRD MOZZ 8Z"), line("l2", "QQZ XZ9")],
    new Map()
  );

  assert.deepEqual(Array.from(ai.calls[0].requests), ["l2"]);
  assert.equal(result.get("l2").resolvedName, "Mystery Item");
});

test("works with no AI tier at all", async () => {
  const { service } = makeService(null);

  const result = await service.identify(
    [line("l1", "GV SHRD MOZZ 8Z"), line("l2", "QQZ XZ9")],
    new Map()
  );

  assert.equal(result.get("l1").source, "dictionary");
  assert.equal(result.has("l2"), false);
});

test("skips ignored lines", async () => {
  const ai = recordingAi();
  const { service } = makeService(ai);

  const result = await service.identify(
    [line("l1", "GV SHRD MOZZ 8Z", { ignored: true }), line("l2", "QQZ XZ9", { ignored: true })],
    new Map()
  );

  assert.equal(result.size, 0);
  assert.equal(ai.calls.length, 0);
});

test("leaves a confirmed answer alone", async () => {
  const ai = recordingAi();
  const { service } = makeService(ai);
  const known = new Map([
    [
      "l1",
      {
        lineId: "l1",
        rawLabel: "QQZ XZ9",
        resolvedName: "What I Said It Was",
        confidence: 1,
        source: "user-confirmed",
        alternatives: [],
        confirmed: true
      }
    ]
  ]);

  const result = await service.identify([line("l1", "QQZ XZ9")], known);

  assert.equal(result.has("l1"), false);
  assert.equal(ai.calls.length, 0);
});

test("re-derives even a confirmed answer when forced", async () => {
  const { service } = makeService();
  const known = new Map([
    [
      "l1",
      {
        lineId: "l1",
        rawLabel: "GV SHRD MOZZ 8Z",
        resolvedName: "Stale",
        confidence: 1,
        source: "user-confirmed",
        alternatives: [],
        confirmed: true
      }
    ]
  ]);

  const result = await service.identify([line("l1", "GV SHRD MOZZ 8Z")], known, { force: true });

  assert.equal(result.get("l1").source, "dictionary");
});

test("ignores an answer for a line it never asked about", async () => {
  const ai = recordingAi([
    {
      lineId: "ghost",
      rawLabel: "invented",
      resolvedName: "Not On This Receipt",
      confidence: 0.9,
      source: "ai",
      alternatives: [],
      confirmed: false
    }
  ]);
  const { service } = makeService(ai);

  const result = await service.identify([line("l1", "QQZ XZ9")], new Map());

  assert.equal(result.has("ghost"), false);
  assert.equal(result.size, 0);
});

test("passes the store name down to the model", async () => {
  const ai = recordingAi();
  const { service } = makeService(ai);

  await service.identify([line("l1", "QQZ XZ9")], new Map(), { storeName: "Costco" });

  assert.equal(ai.calls[0].storeName, "Costco");
});
