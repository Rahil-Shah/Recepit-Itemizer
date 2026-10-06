import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";

const server = await startTestServer({ MAX_RECEIPTS_PER_USER: "3" });
test.after(() => server.close());

function receiptBody(overrides = {}) {
  return {
    storeName: "Trader Joe's",
    category: "Groceries",
    subtotal: 10,
    tax: 1,
    total: 11,
    people: [],
    lines: [
      { clientId: "a", label: "Milk", amount: 4, ignored: false, isFood: true },
      { clientId: "b", label: "Soap", amount: 6, ignored: false }
    ],
    assignments: [],
    imageDataUrl: null,
    ...overrides
  };
}

test("people: the owner is listed first and cannot be removed", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const people = await user.get("/api/people");
  assert.equal(people.status, 200);
  assert.equal(people.body[0].isSelf, true);

  const refused = await user.delete(`/api/people/${people.body[0].id}`);
  assert.equal(refused.status, 400);
});

test("people: add, search, delete, and the validation around them", async () => {
  const user = await server.signUp();
  assert.equal((await user.post("/api/people", { name: "" })).status, 400);
  assert.equal((await user.post("/api/people", { name: "x".repeat(201) })).status, 400);

  const sam = await user.post("/api/people", { name: "Sam" });
  assert.equal(sam.status, 201);
  // The same name twice is the same person.
  assert.equal((await user.post("/api/people", { name: "Sam" })).body.id, sam.body.id);

  assert.deepEqual((await user.get("/api/people/search?q=sa")).body.map((p) => p.name), ["Sam"]);
  assert.deepEqual((await user.get("/api/people/search?q=")).body, []);

  const stranger = await server.signUp();
  assert.equal((await stranger.delete(`/api/people/${sam.body.id}`)).status, 403);
  assert.equal((await user.delete("/api/people/missing")).status, 404);
  assert.equal((await user.delete(`/api/people/${sam.body.id}`)).status, 204);
});

test("people: no more than ten", async () => {
  const user = await server.signUp();
  await user.get("/api/people"); // creates the owner's own entry
  for (let i = 1; i < 10; i += 1) assert.equal((await user.post("/api/people", { name: `P${i}` })).status, 201);
  const eleventh = await user.post("/api/people", { name: "One too many" });
  assert.equal(eleventh.status, 400);
  assert.match(eleventh.body.error, /up to 10/);
});

test("receipts: save with a split and a photo, list, image, update, delete", async () => {
  const user = await server.signUp();
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;

  const saved = await user.post(
    "/api/receipts",
    receiptBody({
      people: [{ clientId: me.id }, { clientId: sam.id }],
      assignments: [
        { lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 },
        { lineClientId: "a", personClientId: sam.id, mode: "equal", value: 0 },
        { lineClientId: "b", personClientId: sam.id, mode: "amount", value: 6 }
      ],
      lines: [
        {
          clientId: "a",
          label: "GV MLK",
          amount: 4,
          ignored: false,
          isFood: true,
          itemCode: "0078742",
          identification: {
            resolvedName: "Great Value Milk",
            brand: "Great Value",
            size: "1 gal",
            confidence: 0.9,
            source: "ai",
            reasoning: "decoded",
            alternatives: [{ name: "Milk", confidence: 0.4 }],
            confirmed: false
          }
        },
        { clientId: "b", label: "Soap", amount: 6, ignored: false }
      ],
      imageDataUrl: JPEG_DATA_URL
    })
  );
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.hasImage, true);
  assert.equal(saved.body.lines[0].identification.resolvedName, "Great Value Milk");
  assert.equal(saved.body.lines[0].itemCode, "0078742");
  assert.equal(saved.body.people.length, 2);

  const list = await user.get("/api/receipts");
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].lines[0].assignments.length, 2);

  const image = await user.get(`/api/receipts/${saved.body.id}/image`, { raw: true });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.equal(Buffer.from(await image.arrayBuffer())[0], 0xff);

  // Editing keeps the photo when none is sent, and a category change drops
  // the AI's budget category.
  await server.prisma.receipt.update({ where: { id: saved.body.id }, data: { budgetCategory: "Shopping" } });
  const updated = await user.put(`/api/receipts/${saved.body.id}`, receiptBody({ storeName: "TJ's", category: "Dining" }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.storeName, "TJ's");
  assert.equal(updated.body.hasImage, true);
  assert.equal(updated.body.budgetCategory, null);

  const stranger = await server.signUp();
  assert.equal((await stranger.put(`/api/receipts/${saved.body.id}`, receiptBody())).status, 404);
  assert.equal((await stranger.get(`/api/receipts/${saved.body.id}/image`)).status, 404);
  assert.equal((await stranger.delete(`/api/receipts/${saved.body.id}`)).status, 404);

  assert.equal((await user.delete(`/api/receipts/${saved.body.id}`)).status, 204);
  assert.equal((await user.get("/api/receipts")).body.length, 0);
  assert.equal((await user.get(`/api/receipts/${saved.body.id}/image`)).status, 404);
});

test("receipts: the payload is validated before anything is written", async () => {
  const user = await server.signUp();
  const cases = [
    [{ lines: [] }, /At least one/],
    [{ people: "x" }, /people must be an array/],
    [{ assignments: "x" }, /assignments must be an array/],
    [{ storeName: "x".repeat(300) }, /storeName/],
    [{ category: 5 }, /category/],
    [{ total: 1e20 }, /total must be a number/],
    [{ lines: [null] }, /must be an object/],
    [{ lines: [{ label: "", amount: 1 }] }, /label/],
    [{ lines: [{ label: "x", amount: "1" }] }, /amount/],
    [{ people: [null] }, /Each person/],
    [{ imageDataUrl: "data:text/plain;base64,aGk=" }, /imageDataUrl/],
    [{ assignments: [null] }, /Each assignment/],
    [{ assignments: [{ lineClientId: "a", personClientId: "p", mode: "weird" }] }, /Unknown assignment mode/],
    [{ assignments: [{ lineClientId: "a", personClientId: "p", value: Infinity }] }, /value/],
    [
      {
        assignments: [
          { lineClientId: "a", personClientId: "p" },
          { lineClientId: "a", personClientId: "p" }
        ]
      },
      /twice/
    ]
  ];
  for (const [overrides, message] of cases) {
    const response = await user.post("/api/receipts", receiptBody(overrides));
    assert.equal(response.status, 400, JSON.stringify(overrides));
    assert.match(response.body.error, message);
  }
  // A person who is not the caller's is refused inside the write.
  const foreign = await user.post(
    "/api/receipts",
    receiptBody({ people: [{ clientId: "not-mine" }] })
  );
  assert.equal(foreign.status, 400);
  assert.equal((await user.get("/api/receipts")).body.length, 0);
});

test("receipts: a regular account stops at its limit, an admin does not", async () => {
  const user = await server.signUp();
  for (let i = 0; i < 3; i += 1) assert.equal((await user.post("/api/receipts", receiptBody())).status, 201);
  const fourth = await user.post("/api/receipts", receiptBody());
  assert.equal(fourth.status, 403);
  assert.match(fourth.body.error, /limit of 3/);

  const admin = await server.admin();
  for (let i = 0; i < 4; i += 1) assert.equal((await admin.post("/api/receipts", receiptBody())).status, 201);
});

test("receipt lines: food flag and the owner's food summary", async () => {
  const user = await server.signUp();
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;
  const saved = (
    await user.post(
      "/api/receipts",
      receiptBody({
        people: [{ clientId: me.id }, { clientId: sam.id }],
        assignments: [
          { lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 },
          { lineClientId: "a", personClientId: sam.id, mode: "equal", value: 0 }
        ]
      })
    )
  ).body;
  const milk = saved.lines.find((line) => line.label === "Milk");
  const soap = saved.lines.find((line) => line.label === "Soap");

  const month = saved.createdAt.slice(0, 7);
  const summary = await user.get(`/api/receipts/food-summary?month=${month}`);
  assert.equal(summary.status, 200);
  // Half the milk is the owner's; tax follows the food share.
  assert.equal(summary.body.foodReceipts.length, 1);
  assert.equal(summary.body.foodReceipts[0].items[0].amount, 2);
  assert.equal(summary.body.foodReceipts[0].items[0].shared, true);

  assert.equal((await user.patch(`/api/receipts/${saved.id}/lines/${soap.id}`, { isFood: "yes" })).status, 400);
  const flagged = await user.patch(`/api/receipts/${saved.id}/lines/${soap.id}`, { isFood: true });
  assert.equal(flagged.status, 200);
  assert.equal(flagged.body.isFood, true);
  assert.equal((await user.patch(`/api/receipts/${saved.id}/lines/nope`, { isFood: true })).status, 404);
  assert.equal((await user.patch(`/api/receipts/nope/lines/${milk.id}`, { isFood: true })).status, 404);

  const all = await user.get("/api/receipts/food-summary");
  assert.equal(all.body.foodReceipts[0].items.length, 2);
  assert.equal((await user.get("/api/receipts/food-summary?month=2026-13")).status, 400);
});

test("unknown API paths answer JSON 404, malformed JSON answers 400", async () => {
  const user = await server.signUp();
  const missing = await user.get("/api/nothing-here");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "Not found.");

  const bad = await user.request("POST", "/api/receipts", {
    body: "{not json",
    headers: { "Content-Type": "application/json" }
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "Invalid request.");
});

test("the static front end and its 404 page are served", async () => {
  const page = await server.client().get("/");
  assert.equal(page.status, 200);
  assert.match(page.body, /Receipt Ring/);
  const missing = await server.client().get("/no-such-page");
  assert.equal(missing.status, 404);
  const head = await server.client().request("POST", "/no-such-page");
  assert.equal(head.status, 404);
});

test("security headers are set on every response", async () => {
  const response = await server.client().get("/api/health");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-powered-by"), null);
});
