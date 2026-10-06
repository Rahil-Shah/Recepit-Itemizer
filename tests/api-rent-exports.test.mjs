import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, JPEG_DATA_URL } from "./helpers/test-server.mjs";

const server = await startTestServer();
test.after(() => server.close());

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n%%EOF").toString("base64")}`;

test("rent: create, list by month, summary, photo, edit, delete", async () => {
  const user = await server.signUp();
  const created = await user.post("/api/rent-entries", {
    year: 2026,
    month: 9,
    amount: 1200,
    propertyName: "Oak St",
    date: "2026-09-01",
    photoDataUrl: JPEG_DATA_URL
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.hasPhoto, true);
  assert.equal(created.body.date, "2026-09-01");

  const duplicate = await user.post("/api/rent-entries", { year: 2026, month: 9, amount: 5 });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /already exists/);

  assert.equal((await user.get("/api/rent-entries?month=2026-09")).body.length, 1);
  assert.equal((await user.get("/api/rent-entries?month=2026-08")).body.length, 0);
  assert.equal((await user.get("/api/rent-entries")).body.length, 1);
  assert.equal((await user.get("/api/rent-entries?month=bad")).status, 400);

  const summary = await user.get("/api/rent-entries/summary?month=2026-09");
  assert.equal(summary.body.rentTotal, 1200);
  assert.equal((await user.get("/api/rent-entries/summary")).body.entries.length, 1);
  assert.equal((await user.get("/api/rent-entries/summary?month=nope")).status, 400);

  const photo = await user.get(`/api/rent-entries/${created.body.id}/photo`, { raw: true });
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");

  const id = created.body.id;
  assert.equal((await user.patch(`/api/rent-entries/${id}`, {})).body.amount, 1200);
  assert.equal((await user.patch(`/api/rent-entries/${id}`, { amount: "x" })).status, 400);
  assert.equal((await user.patch(`/api/rent-entries/${id}`, { propertyName: 7 })).status, 400);
  assert.equal((await user.patch(`/api/rent-entries/${id}`, { date: "soon" })).status, 400);
  assert.equal((await user.patch(`/api/rent-entries/${id}`, { date: "2026-13-01" })).status, 400);
  assert.equal((await user.patch(`/api/rent-entries/${id}`, { photoDataUrl: "data:text/plain;base64,eA==" })).status, 400);

  const moved = await user.patch(`/api/rent-entries/${id}`, {
    amount: 1250,
    propertyName: null,
    date: "2026-10-01",
    photoDataUrl: PDF_DATA_URL
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.month, 10);
  assert.equal(moved.body.amount, 1250);
  const pdf = await user.get(`/api/rent-entries/${id}/photo`, { raw: true });
  assert.equal(pdf.headers.get("content-type"), "application/pdf");

  // Moving into a month that already has an entry is refused.
  await user.post("/api/rent-entries", { year: 2026, month: 11, amount: 1, date: "2026-11-01" });
  const clash = await user.patch(`/api/rent-entries/${id}`, { date: "2026-11-02" });
  assert.equal(clash.status, 400);

  const cleared = await user.patch(`/api/rent-entries/${id}`, { photoDataUrl: null });
  assert.equal(cleared.body.hasPhoto, false);
  assert.equal((await user.get(`/api/rent-entries/${id}/photo`)).status, 404);

  const stranger = await server.signUp();
  assert.equal((await stranger.patch(`/api/rent-entries/${id}`, { amount: 1 })).status, 404);
  assert.equal((await stranger.delete(`/api/rent-entries/${id}`)).status, 404);
  assert.equal((await user.delete(`/api/rent-entries/${id}`)).status, 204);
});

test("rent: the payload is validated", async () => {
  const user = await server.signUp();
  const cases = [
    [{ year: 2026, month: 0, amount: 1 }, /month/],
    [{ year: 1999, month: 1, amount: 1 }, /year/],
    [{ year: 2026, month: 1, amount: "1" }, /amount/],
    [{ year: 2026, month: 1, amount: 1, date: 5 }, /date/],
    [{ year: 2026, month: 1, amount: 1, propertyName: "" }, /propertyName/],
    [{ year: 2026, month: 1, amount: 1, bankTransactionId: 7 }, /bankTransactionId/],
    [{ year: 2026, month: 1, amount: 1, photoDataUrl: "nope" }, /photoDataUrl/]
  ];
  for (const [body, message] of cases) {
    const response = await user.post("/api/rent-entries", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match(response.body.error, message);
  }
  const fromBank = await user.post("/api/rent-entries", { year: 2026, month: 1, amount: 1, bankTransactionId: "t1" });
  assert.equal(fromBank.status, 403);
});

async function seedEducation(user) {
  const [me] = (await user.get("/api/people")).body;
  const receipt = await user.post("/api/receipts", {
    storeName: "Safeway",
    category: "Groceries",
    subtotal: 10,
    tax: 1,
    total: 11,
    people: [{ clientId: me.id }],
    lines: [{ clientId: "a", label: "Bread", amount: 10, ignored: false, isFood: true }],
    assignments: [{ lineClientId: "a", personClientId: me.id, mode: "equal", value: 0 }],
    imageDataUrl: JPEG_DATA_URL
  });
  const month = receipt.body.createdAt.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  await user.post("/api/rent-entries", {
    year,
    month: monthNumber,
    amount: 900,
    date: `${month}-02`,
    photoDataUrl: JPEG_DATA_URL
  });
  return { month, year };
}

test("education export: PDF and spreadsheet for a month and a year", async () => {
  const user = await server.signUp();
  const { month, year } = await seedEducation(user);

  const pdf = await user.get(`/api/education-expenses/export?month=${month}&format=pdf`, { raw: true });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition"), /education-expenses-.*\.pdf/);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");

  const xlsx = await user.get(`/api/education-expenses/export?year=${year}&format=xlsx`, { raw: true });
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.headers.get("content-type"), /spreadsheetml/);
  assert.equal(Buffer.from(await xlsx.arrayBuffer()).subarray(0, 2).toString(), "PK");
});

test("education export: bad period or format is refused", async () => {
  const user = await server.signUp();
  assert.equal((await user.get("/api/education-expenses/export?format=pdf")).status, 400);
  assert.equal((await user.get("/api/education-expenses/export?month=2026-01&format=doc")).status, 400);
  assert.equal((await user.get("/api/education-expenses/export?month=2026-01&year=2026")).status, 400);
});

test("spending export is admin-only and lists receipts and transactions", async () => {
  const user = await server.signUp();
  assert.equal((await user.get("/api/spending/export")).status, 403);

  const admin = await server.admin();
  await seedEducation(admin);
  const csv = await admin.get("/api/spending/export");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(csv.body, /Safeway/);
});
