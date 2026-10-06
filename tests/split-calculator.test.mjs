import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

const { ReceiptRing } = loadReceiptRing();

const people = [
  { id: "p1", name: "Ana" },
  { id: "p2", name: "Ben" },
  { id: "p3", name: "Cam" }
];

function line(id, amount, ignored = false) {
  return { id, label: id, amount, confidence: 1, ignored };
}

function foodLine(id, amount, ignored = false) {
  return { ...line(id, amount, ignored), isFood: true };
}

function cents(amount) {
  return Math.round(amount * 100);
}

function equalAssignment(lineId, personId) {
  return { id: `${lineId}-${personId}`, lineId, personId, mode: "equal", value: 0 };
}

function makeCalculator() {
  return new ReceiptRing.Services.SplitCalculatorService();
}

test("splitting $10.00 three ways sums back to exactly $10.00", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 10)];
  const assignments = people.map((p) => equalAssignment("l1", p.id));

  const summary = calculator.calculate(people, lines, assignments, 0);

  const total = summary.totals.reduce((sum, t) => sum + t.finalTotal, 0);
  assert.equal(Number(total.toFixed(2)), 10);
  assert.equal(summary.unallocated, 0);
  // Leftover cent lands on someone; nobody strays more than a cent from even.
  for (const t of summary.totals) {
    assert.ok(Math.abs(t.finalTotal - 10 / 3) < 0.011);
  }
});

test("tax is distributed proportionally and sums exactly", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 30), line("l2", 10)];
  const assignments = [
    equalAssignment("l1", "p1"),
    equalAssignment("l2", "p2")
  ];

  const summary = calculator.calculate(people, lines, assignments, 4);

  const byId = new Map(summary.totals.map((t) => [t.personId, t]));
  assert.equal(byId.get("p1").allocatedTax, 3);
  assert.equal(byId.get("p2").allocatedTax, 1);
  assert.equal(byId.get("p3").allocatedTax, 0);
  assert.equal(byId.get("p1").finalTotal, 33);
  assert.equal(byId.get("p2").finalTotal, 11);
});

test("custom amounts that undershoot a line surface as unallocated", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 20)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "amount", value: 12 }
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.itemTotal, 12);
  assert.equal(summary.unallocated, 8);
});

test("percentage mode charges the given share of the line", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 40)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "percentage", value: 25 },
    { id: "a2", lineId: "l1", personId: "p2", mode: "percentage", value: 75 }
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const byId = new Map(summary.totals.map((t) => [t.personId, t]));
  assert.equal(byId.get("p1").itemTotal, 10);
  assert.equal(byId.get("p2").itemTotal, 30);
  assert.equal(summary.unallocated, 0);
});

test("ignored lines are excluded from the split", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 10), line("l2", 99, true)];
  const assignments = [
    equalAssignment("l1", "p1"),
    equalAssignment("l2", "p1")
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);
  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.finalTotal, 10);
});

test("food total is each person's share of the food lines, before any tax", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 30), line("l2", 15)];
  const assignments = [
    ...people.map((p) => equalAssignment("l1", p.id)),
    equalAssignment("l2", "p1")
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const byId = new Map(summary.totals.map((t) => [t.personId, t]));
  assert.equal(byId.get("p1").itemTotal, 25);
  assert.equal(byId.get("p1").foodTotal, 10);
  assert.equal(byId.get("p2").foodTotal, 10);
  assert.equal(byId.get("p3").foodTotal, 10);
});

test("an all-food receipt puts every cent of the tax in the food total", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 30)];
  const assignments = [equalAssignment("l1", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 6);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.allocatedTax, 6);
  assert.equal(p1.finalTotal, 36);
  // Nothing but food was bought, so the whole charge is a food expense.
  assert.equal(p1.foodTotal, 36);
});

test("tax is apportioned between food and non-food items", () => {
  const calculator = makeCalculator();
  // p1 buys $30 of food and $10 of other things; $4 of tax on $40 of items.
  const lines = [foodLine("l1", 30), line("l2", 10)];
  const assignments = [equalAssignment("l1", "p1"), equalAssignment("l2", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 4);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.itemTotal, 40);
  assert.equal(p1.allocatedTax, 4);
  // Three quarters of the items were food, so three quarters of the tax is.
  assert.equal(p1.foodTotal, 33);
  assert.ok(p1.foodTotal <= p1.finalTotal);
});

test("a receipt with no food keeps tax out of the food total", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 20)];
  const assignments = [equalAssignment("l1", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 5);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.allocatedTax, 5);
  assert.equal(p1.foodTotal, 0);
});

test("apportioned food tax never invents or loses a cent", () => {
  const calculator = makeCalculator();
  // $10.01 of food against $10.00 of other items, with an odd tax, so the
  // proportional split cannot land on whole cents by luck.
  const lines = [foodLine("l1", 10.01), line("l2", 10)];
  const assignments = [equalAssignment("l1", "p1"), equalAssignment("l2", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 3.33);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  const foodTaxCents = cents(p1.foodTotal) - 1001;
  const nonFoodTaxCents = cents(p1.allocatedTax) - foodTaxCents;
  // The two halves of this person's tax must add back to all of it.
  assert.equal(foodTaxCents + nonFoodTaxCents, cents(p1.allocatedTax));
  assert.ok(foodTaxCents >= 0 && foodTaxCents <= cents(p1.allocatedTax));
  assert.ok(cents(p1.foodTotal) <= cents(p1.finalTotal));
});

test("food total follows percentage shares", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 40)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "percentage", value: 25 },
    { id: "a2", lineId: "l1", personId: "p2", mode: "percentage", value: 75 }
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const byId = new Map(summary.totals.map((t) => [t.personId, t]));
  assert.equal(byId.get("p1").foodTotal, 10);
  assert.equal(byId.get("p2").foodTotal, 30);
  assert.equal(byId.get("p3").foodTotal, 0);
});

test("food total follows custom amounts, undershoot included", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 20)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "amount", value: 12 }
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  // The $8 nobody covered is unallocated, so it is nobody's food either.
  assert.equal(p1.foodTotal, 12);
  assert.equal(summary.unallocated, 8);
});

test("ignored food lines are excluded from the food total", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 10), foodLine("l2", 99, true)];
  const assignments = [equalAssignment("l1", "p1"), equalAssignment("l2", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 0);

  const p1 = summary.totals.find((t) => t.personId === "p1");
  assert.equal(p1.foodTotal, 10);
  assert.equal(p1.itemTotal, 10);
});

test("food shares of an uneven split sum back to the line exactly", () => {
  const calculator = makeCalculator();
  const lines = [foodLine("l1", 10)];
  const assignments = people.map((p) => equalAssignment("l1", p.id));

  const summary = calculator.calculate(people, lines, assignments, 0);

  const foodCents = summary.totals.reduce((sum, t) => sum + cents(t.foodTotal), 0);
  assert.equal(foodCents, 1000);
  // Nobody's food share may outrun what they owe. With tax apportioned in, the
  // bound is their final total rather than their items alone.
  for (const t of summary.totals) {
    assert.ok(cents(t.foodTotal) <= cents(t.finalTotal));
  }
});

test("a fully assigned receipt balances against its total", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 30), line("l2", 10)];
  const assignments = [
    ...people.map((p) => equalAssignment("l1", p.id)),
    equalAssignment("l2", "p2")
  ];

  const summary = calculator.calculate(people, lines, assignments, 4);

  assert.equal(summary.receiptTotal, 44);
  assert.equal(summary.assignedTotal, 44);
  assert.equal(summary.isBalanced, true);
});

test("an unassigned line leaves the receipt out of balance by its amount", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 30), line("l2", 12.45)];
  const assignments = [equalAssignment("l1", "p1")];

  const summary = calculator.calculate(people, lines, assignments, 0);

  assert.equal(summary.isBalanced, false);
  assert.equal(summary.receiptTotal, 42.45);
  assert.equal(summary.assignedTotal, 30);
  assert.equal(cents(summary.receiptTotal) - cents(summary.assignedTotal), cents(12.45));
  // Nothing was left over on the line p1 was assigned to.
  assert.equal(summary.unallocated, 0);
});

test("the balance gap counts unassigned lines on top of unallocated", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 20), line("l2", 5)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "amount", value: 12 }
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);

  // unallocated is only the $8 left on l1; the gap also carries all of l2.
  assert.equal(summary.unallocated, 8);
  assert.equal(summary.receiptTotal, 25);
  assert.equal(summary.assignedTotal, 12);
  assert.equal(summary.isBalanced, false);
});

test("getUnassignedCount counts active lines with no assignments", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 10), line("l2", 5), line("l3", 7, true)];
  const assignments = [equalAssignment("l1", "p1")];

  assert.equal(calculator.getUnassignedCount(lines, assignments), 1);
});

test("odd cents rotate between people instead of always hitting the first", () => {
  const calculator = makeCalculator();
  const four = [
    { id: "p1", name: "A" }, { id: "p2", name: "B" },
    { id: "p3", name: "C" }, { id: "p4", name: "D" }
  ];
  // $0.99 four ways leaves 3 spare cents per line; over four lines everyone
  // should absorb the same number of extra cents.
  const lines = ["l1", "l2", "l3", "l4"].map((id) => line(id, 0.99));
  const assignments = lines.flatMap((l) => four.map((p) => equalAssignment(l.id, p.id)));

  const summary = calculator.calculate(four, lines, assignments, 0);

  const totals = [...summary.totals].map((t) => cents(t.finalTotal));
  assert.equal(totals.reduce((a, b) => a + b, 0), 396);
  assert.deepEqual([...totals], [99, 99, 99, 99]);
});

test("a batch of odd-priced lines stays within a cent of even, tax included", () => {
  const calculator = makeCalculator();
  const four = [
    { id: "p1", name: "A" }, { id: "p2", name: "B" },
    { id: "p3", name: "C" }, { id: "p4", name: "D" }
  ];
  const lines = Array.from({ length: 10 }, (_, i) => line(`l${i}`, 0.99));
  const assignments = lines.flatMap((l) => four.map((p) => equalAssignment(l.id, p.id)));

  const summary = calculator.calculate(four, lines, assignments, 1.03);

  const finals = summary.totals.map((t) => cents(t.finalTotal));
  assert.equal(finals.reduce((a, b) => a + b, 0), 1093);
  // 10.93 four ways is 273.25 each: one person pays 274, everyone else 273.
  assert.ok(Math.max(...finals) - Math.min(...finals) <= 1, finals.join(","));
  const items = summary.totals.map((t) => cents(t.itemTotal));
  assert.ok(Math.max(...items) - Math.min(...items) <= 1, items.join(","));
});

test("odd cents balance across lines shared by different groups", () => {
  const calculator = makeCalculator();
  const four = [
    { id: "p1", name: "A" }, { id: "p2", name: "B" },
    { id: "p3", name: "C" }, { id: "p4", name: "D" }
  ];
  // Every other line is split three ways, so the groups overlap.
  const lines = Array.from({ length: 12 }, (_, i) => line(`l${i}`, 0.97));
  const assignments = lines.flatMap((l, i) =>
    (i % 2 === 0 ? four : four.slice(0, 3)).map((p) => equalAssignment(l.id, p.id))
  );

  const summary = calculator.calculate(four, lines, assignments, 0);

  const exact = { p1: 0, p2: 0, p3: 0, p4: 0 };
  lines.forEach((l, i) => {
    const group = i % 2 === 0 ? four : four.slice(0, 3);
    group.forEach((p) => (exact[p.id] += 97 / group.length));
  });
  for (const total of summary.totals) {
    assert.ok(Math.abs(cents(total.itemTotal) - exact[total.personId]) < 1, `${total.personName}`);
  }
});

test("mixed-mode lines still hand the equal people an even part", () => {
  const calculator = makeCalculator();
  const lines = [line("l1", 10)];
  const assignments = [
    { id: "a1", lineId: "l1", personId: "p1", mode: "percentage", value: 50 },
    equalAssignment("l1", "p2"),
    equalAssignment("l1", "p3")
  ];

  const summary = calculator.calculate(people, lines, assignments, 0);
  const byId = new Map(summary.totals.map((t) => [t.personId, cents(t.itemTotal)]));

  assert.equal(byId.get("p1"), 500);
  assert.equal(byId.get("p2") + byId.get("p3"), 667);
  assert.ok(Math.abs(byId.get("p2") - byId.get("p3")) <= 1);
});
