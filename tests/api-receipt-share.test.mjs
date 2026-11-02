import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";

const server = await startTestServer();
test.after(() => server.close());

const visitor = () => server.client();

async function savedReceipt(user) {
  const [me] = (await user.get("/api/people")).body;
  const sam = (await user.post("/api/people", { name: "Sam" })).body;
  const saved = await user.post("/api/receipts", {
    storeName: "Trader Joe's",
    category: "Groceries",
    subtotal: 10,
    tax: 1,
    total: 11,
    imageDataUrl: JPEG_DATA_URL,
    people: [{ clientId: me.id }, { clientId: sam.id }],
    lines: [
      {
        clientId: "a",
        label: "GV SHRD MOZZ",
        amount: 4,
        ignored: false,
        isFood: true,
        itemCode: "12345",
        identification: { resolvedName: "Shredded Mozzarella", confidence: 0.9, source: "ai", reasoning: "secret", alternatives: [], confirmed: false }
      },
      { clientId: "b", label: "Soap", amount: 6, ignored: false },
      { clientId: "c", label: "COUPON NOTE", amount: 99, ignored: true }
    ],
    assignments: [
      { lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 },
      { lineClientId: "a", personClientId: sam.id, mode: "equal", value: 0 },
      { lineClientId: "b", personClientId: sam.id, mode: "percentage", value: 100 }
    ]
  });
  assert.equal(saved.status, 201);
  return saved.body;
}

async function share(user, receipt, body = {}) {
  const created = await user.post(`/api/receipts/${receipt.id}/shares`, { expiresInMinutes: 60, ...body });
  assert.equal(created.status, 201);
  return { ...created.body, api: created.body.path.replace("/r/", "/api/shared-receipts/") };
}

/** An edit that leaves everything as the link shows it. */
function editOf(shared) {
  return {
    updatedAt: shared.updatedAt,
    storeName: shared.storeName,
    tax: shared.tax,
    lines: shared.lines.map((line) => ({ id: line.id, label: line.name, amount: line.amount, assignments: line.assignments }))
  };
}

test("anyone with the link can read the receipt, without an account", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt);
  assert.match(link.path, /^\/r\/[\w-]{43}$/);
  assert.equal(link.canEdit, false);

  const read = await visitor().get(link.api);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "no-store");
  assert.equal(read.body.storeName, "Trader Joe's");
  assert.equal(read.body.total, 11);
  assert.equal(read.body.canEdit, false);
  assert.deepEqual(read.body.people.map((person) => person.name), ["Rahil", "Sam"]);
  assert.deepEqual(read.body.lines.map((line) => line.name), ["Shredded Mozzarella", "Soap"]);
  assert.equal(read.body.lines[1].assignments[0].mode, "percentage");
});

test("a link gives away nothing it does not need to", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt);
  const { body } = await visitor().get(link.api);
  const text = JSON.stringify(body);

  assert.deepEqual(Object.keys(body).sort(), [
    "canEdit", "category", "createdAt", "expiresAt", "lines", "people", "storeName", "subtotal", "tax", "total", "updatedAt"
  ]);
  for (const secret of [user.user.email, user.user.id, receipt.id, "base64", "imageData", "12345", "secret", "COUPON NOTE", "isFood"]) {
    assert.ok(!text.includes(secret), `leaked ${secret}`);
  }
  // Only the hash is stored.
  const row = await server.prisma.receiptShare.findFirst({ where: { receiptId: receipt.id } });
  assert.ok(!link.path.includes(row.tokenHash));
});

test("a link stops working when it expires, and a made-up one never worked", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt, { canEdit: true });
  const { body: shared } = await visitor().get(link.api);

  await server.prisma.receiptShare.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await visitor().get(link.api)).status, 404);
  assert.equal((await visitor().put(link.api, editOf(shared))).status, 404);
  assert.deepEqual((await user.get(`/api/receipts/${receipt.id}/shares`)).body, []);

  assert.equal((await visitor().get(`/api/shared-receipts/${"a".repeat(43)}`)).status, 404);
  assert.equal((await visitor().get("/api/shared-receipts/short")).status, 404);

  // The next share sweeps it away.
  await share(user, receipt);
  assert.equal(await server.prisma.receiptShare.count({ where: { id: link.id } }), 0);
});

test("creating a link checks the duration, the permission and the owner", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const create = (body) => user.post(`/api/receipts/${receipt.id}/shares`, body);

  for (const expiresInMinutes of [undefined, 0, -5, 1.5, "60", 43201]) {
    assert.equal((await create({ expiresInMinutes })).status, 400, String(expiresInMinutes));
  }
  assert.equal((await create({ expiresInMinutes: 60, canEdit: "yes" })).status, 400);

  const longest = await create({ expiresInMinutes: 43200 });
  assert.equal(longest.status, 201);
  assert.ok(Date.parse(longest.body.expiresAt) > Date.now() + 29 * 86_400_000);

  const stranger = await server.signUp();
  assert.equal((await stranger.post(`/api/receipts/${receipt.id}/shares`, { expiresInMinutes: 60 })).status, 404);
  assert.equal((await stranger.get(`/api/receipts/${receipt.id}/shares`)).status, 404);
  assert.equal((await visitor().post(`/api/receipts/${receipt.id}/shares`, { expiresInMinutes: 60 })).status, 401);
});

test("the owner can list a receipt's links, flip editing and stop a link", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt);
  const url = `/api/receipts/${receipt.id}/shares/${link.id}`;

  const listed = await user.get(`/api/receipts/${receipt.id}/shares`);
  assert.deepEqual(listed.body.map((item) => item.id), [link.id]);
  // The token cannot be told twice.
  assert.equal(listed.body[0].path, undefined);

  const stranger = await server.signUp();
  assert.equal((await stranger.patch(url, { canEdit: true })).status, 404);
  assert.equal((await stranger.delete(url)).status, 404);
  assert.equal((await user.patch(url, { canEdit: "yes" })).status, 400);

  assert.equal((await user.patch(url, { canEdit: true })).body.canEdit, true);
  assert.equal((await visitor().get(link.api)).body.canEdit, true);
  assert.equal((await user.patch(url, { canEdit: false })).body.canEdit, false);

  assert.equal((await user.delete(url)).status, 204);
  assert.equal((await user.delete(url)).status, 404);
  assert.equal((await user.patch(url, { canEdit: true })).status, 404);
  assert.equal((await visitor().get(link.api)).status, 404);
});

test("deleting the receipt ends its links", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt);
  assert.equal((await user.delete(`/api/receipts/${receipt.id}`)).status, 204);
  assert.equal((await visitor().get(link.api)).status, 404);
});

test("a view-only link cannot edit, and turning editing off takes effect at once", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt);
  const { body: shared } = await visitor().get(link.api);

  const refused = await visitor().put(link.api, { ...editOf(shared), storeName: "Hacked" });
  assert.equal(refused.status, 403);
  assert.equal((await visitor().get(link.api)).body.storeName, "Trader Joe's");

  await user.patch(`/api/receipts/${receipt.id}/shares/${link.id}`, { canEdit: true });
  const allowed = await visitor().put(link.api, { ...editOf(shared), storeName: "Fixed" });
  assert.equal(allowed.status, 200);

  await user.patch(`/api/receipts/${receipt.id}/shares/${link.id}`, { canEdit: false });
  const again = await visitor().put(link.api, { ...editOf(allowed.body), storeName: "Again" });
  assert.equal(again.status, 403);
});

test("an editor changes items, tax and the split; the owner's receipt follows", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt, { canEdit: true });
  const { body: shared } = await visitor().get(link.api);
  const [mozz, soap] = shared.lines;
  const [rahil, sam] = shared.people;

  const edited = await visitor().put(link.api, {
    updatedAt: shared.updatedAt,
    storeName: "TJ's",
    tax: 2,
    lines: [
      // Only the price and split change, so the food flag and name stay.
      { id: mozz.id, label: mozz.name, amount: 5, assignments: [{ personId: rahil.id, mode: "percentage", value: 40 }, { personId: sam.id, mode: "percentage", value: 60 }] },
      // Soap is gone, and there is something new.
      { label: "Bread", amount: 3.5, assignments: [{ personId: sam.id, mode: "equal", value: 0 }] }
    ]
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.subtotal, 8.5);
  assert.equal(edited.body.total, 10.5);
  assert.notEqual(edited.body.updatedAt, shared.updatedAt);

  const [owned] = (await user.get("/api/receipts")).body.filter((item) => item.id === receipt.id);
  assert.equal(owned.storeName, "TJ's");
  assert.equal(owned.total, 10.5);
  assert.deepEqual(owned.lines.map((line) => line.label), ["GV SHRD MOZZ", "COUPON NOTE", "Bread"]);
  const [ownedMozz, coupon, bread] = owned.lines;
  assert.equal(ownedMozz.isFood, true);
  assert.equal(ownedMozz.itemCode, "12345");
  assert.equal(ownedMozz.identification.resolvedName, "Shredded Mozzarella");
  assert.deepEqual(ownedMozz.assignments.map((a) => [a.personName, a.mode, a.value]).sort(), [["Rahil", "percentage", 40], ["Sam", "percentage", 60]]);
  assert.equal(coupon.ignored, true);
  assert.equal(coupon.amount, 99);
  assert.equal(bread.isFood, false);
  // The photo and category were out of reach.
  assert.equal(owned.hasImage, true);
  assert.equal(owned.category, "Groceries");
});

test("renaming an item drops what it was identified as", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt, { canEdit: true });
  const { body: shared } = await visitor().get(link.api);
  const edit = editOf(shared);
  edit.lines[0].label = "Cheddar";
  const edited = await visitor().put(link.api, edit);
  assert.equal(edited.body.lines[0].name, "Cheddar");

  const [owned] = (await user.get("/api/receipts")).body.filter((item) => item.id === receipt.id);
  assert.equal(owned.lines[0].label, "Cheddar");
  assert.equal(owned.lines[0].identification, null);
  assert.equal(owned.lines[0].itemCode, null);
  assert.equal(owned.lines[0].isFood, true);
});

test("two people editing at once: the second is told, not overwritten", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt, { canEdit: true });
  const { body: shared } = await visitor().get(link.api);

  assert.equal((await visitor().put(link.api, { ...editOf(shared), storeName: "First" })).status, 200);
  const late = await visitor().put(link.api, { ...editOf(shared), storeName: "Second" });
  assert.equal(late.status, 409);
  assert.equal((await visitor().get(link.api)).body.storeName, "First");
});

test("an edit is validated, and cannot reach beyond its own receipt", async () => {
  const user = await server.signUp();
  const receipt = await savedReceipt(user);
  const link = await share(user, receipt, { canEdit: true });
  const { body: shared } = await visitor().get(link.api);
  const base = editOf(shared);
  const line = base.lines[0];
  const assignment = { personId: shared.people[0].id, mode: "equal", value: 0 };

  const other = await server.signUp();
  const otherReceipt = await savedReceipt(other);
  const otherLink = await share(other, otherReceipt);
  const { body: otherShared } = await visitor().get(otherLink.api);

  const bad = [
    { ...base, updatedAt: undefined },
    { ...base, storeName: "" },
    { ...base, storeName: 5 },
    { ...base, tax: "1" },
    { ...base, tax: 1e9 },
    { ...base, lines: [] },
    { ...base, lines: "nope" },
    { ...base, lines: [null] },
    { ...base, lines: [line, line] },
    { ...base, lines: [{ ...line, label: "" }] },
    { ...base, lines: [{ ...line, amount: "4" }] },
    { ...base, lines: [{ ...line, amount: 1e9 }] },
    { ...base, lines: [{ ...line, assignments: null }] },
    { ...base, lines: [{ ...line, assignments: [null] }] },
    { ...base, lines: [{ ...line, assignments: [assignment, assignment] }] },
    { ...base, lines: [{ ...line, assignments: [{ ...assignment, mode: "sneaky" }] }] },
    { ...base, lines: [{ ...line, assignments: [{ ...assignment, value: "1" }] }] },
    // Someone else's person, someone else's line.
    { ...base, lines: [{ ...line, assignments: [{ ...assignment, personId: otherShared.people[0].id }] }] },
    { ...base, lines: [{ ...line, id: otherShared.lines[0].id }] },
    // Fine one by one; too much together.
    { ...base, lines: [{ ...line, amount: 9e7 }, { label: "More", amount: 9e7, assignments: [] }] }
  ];
  for (const body of bad) {
    assert.equal((await visitor().put(link.api, body)).status, 400, JSON.stringify(body).slice(0, 200));
  }

  // Nothing above changed anything, here or on the other receipt.
  assert.equal((await visitor().get(link.api)).body.updatedAt, shared.updatedAt);
  assert.equal((await visitor().get(otherLink.api)).body.lines[0].amount, otherShared.lines[0].amount);
});
