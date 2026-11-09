// server/split.mjs is a port of the client's SplitCalculatorService, used by
// the MCP tools to say who owes what. It must agree with the client to the
// cent, so most of this file runs both on the same receipts and compares.
import test from "node:test";
import assert from "node:assert/strict";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";
import { calculateSplit, personBreakdown, distributeProportionally, describeSplit } from "../server/split.mjs";

const { ReceiptRing } = loadReceiptRing();
const client = new ReceiptRing.Services.SplitCalculatorService();
const plain = (value) => JSON.parse(JSON.stringify(value));

// The client takes lines and assignments apart; the server takes each line
// with its own assignments.
function forClient(lines) {
  const assignments = [];
  for (const line of lines) {
    for (const assignment of line.assignments) {
      assignments.push({ id: `${line.id}-${assignment.personId}`, lineId: line.id, ...assignment });
    }
  }
  return {
    lines: lines.map(({ assignments: _ignored, ...line }) => ({ confidence: 1, ...line })),
    assignments
  };
}

// A deterministic generator, so a failure names a seed that reproduces it.
function random(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function randomReceipt(seed) {
  const next = random(seed);
  const pick = (items) => items[Math.floor(next() * items.length)];
  const people = Array.from({ length: 1 + Math.floor(next() * 5) }, (_, index) => ({ id: `p${index}`, name: `P${index}` }));
  const lines = Array.from({ length: 1 + Math.floor(next() * 12) }, (_, index) => {
    // Mostly odd prices, some discounts, the odd zero.
    const amount = Math.round((next() < 0.15 ? -1 : 1) * next() * 4000) / 100;
    const chosen = people.filter(() => next() < 0.55);
    const assignments = chosen.map((person) => {
      const mode = pick(["equal", "equal", "equal", "percentage", "amount"]);
      const value = mode === "percentage" ? Math.round(next() * 100) : mode === "amount" ? Math.round(next() * amount * 100) / 100 : 0;
      return { personId: person.id, mode, value };
    });
    return { id: `l${index}`, label: `Item ${index}`, amount, ignored: next() < 0.1, isFood: next() < 0.5, assignments };
  });
  const tax = Math.round(next() * 500) / 100;
  return { people, lines, tax };
}

test("the server's split matches the client's on 3000 random receipts", () => {
  for (let seed = 1; seed <= 3000; seed += 1) {
    const { people, lines, tax } = randomReceipt(seed);
    const split = calculateSplit(people, lines, tax);
    const { lines: clientLines, assignments } = forClient(lines);
    const expected = plain(client.calculate(people, clientLines, assignments, tax));

    assert.deepEqual(plain(split.totals), expected.totals, `totals, seed ${seed}`);
    assert.equal(split.unallocated, expected.unallocated, `unallocated, seed ${seed}`);
    assert.equal(split.receiptTotal, expected.receiptTotal, `receipt total, seed ${seed}`);
    assert.equal(split.assignedTotal, expected.assignedTotal, `assigned total, seed ${seed}`);
    assert.equal(split.isBalanced, expected.isBalanced, `balanced, seed ${seed}`);
    assert.equal(split.unassignedLines, client.getUnassignedCount(clientLines, assignments), `unassigned, seed ${seed}`);

    for (const person of people) {
      const mine = personBreakdown(people, lines, tax, person.id);
      const theirs = plain(client.personBreakdown(people, clientLines, assignments, tax, person.id));
      assert.deepEqual(plain(mine), theirs, `breakdown of ${person.id}, seed ${seed}`);
    }
  }
});

test("$10 three ways with tax adds back up to the receipt", () => {
  const people = [{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }, { id: "c", name: "Cam" }];
  const lines = [{ id: "l1", label: "Pizza", amount: 10, isFood: true, assignments: people.map((p) => ({ personId: p.id, mode: "equal", value: 0 })) }];
  const split = calculateSplit(people, lines, 1);
  assert.equal(split.receiptTotal, 11);
  assert.ok(split.isBalanced);
  const cents = split.totals.map((total) => Math.round(total.finalTotal * 100));
  assert.equal(cents.reduce((sum, value) => sum + value, 0), 1100);
  assert.ok(Math.max(...cents) - Math.min(...cents) <= 1);
});

test("a line nobody is on counts toward the receipt and is reported as unassigned", () => {
  const people = [{ id: "a", name: "Ana" }];
  const lines = [
    { id: "l1", label: "Milk", amount: 3, assignments: [{ personId: "a", mode: "equal", value: 0 }] },
    { id: "l2", label: "Eggs", amount: 4, assignments: [] },
    { id: "l3", label: "Coupon note", amount: 99, ignored: true, assignments: [] }
  ];
  const split = calculateSplit(people, lines, 0);
  assert.equal(split.receiptTotal, 7);
  assert.equal(split.unassignedLines, 1);
  assert.equal(split.isBalanced, false);
  assert.deepEqual(personBreakdown(people, lines, 0, "a").items.map((item) => item.label), ["Milk"]);
});

test("distributeProportionally always sums back and breaks ties as asked", () => {
  assert.deepEqual(distributeProportionally(0, [1, 2]), [0, 0]);
  assert.deepEqual(distributeProportionally(5, [0, 0]), [0, 0]);
  assert.deepEqual(distributeProportionally(1, [1, 1], [5, 2]), [0, 1]);
  assert.deepEqual(distributeProportionally(-3, [1, 1]), [-2, -1]);
  assert.equal(distributeProportionally(1001, [3, 3, 3]).reduce((a, b) => a + b, 0), 1001);
});

test("describeSplit words a share the way History does", () => {
  assert.equal(describeSplit({ mode: "percentage", value: 40, splitCount: 2 }), "Split by % · 40%");
  assert.equal(describeSplit({ mode: "amount", value: 3, splitCount: 2 }), "Custom amount");
  assert.equal(describeSplit({ mode: "equal", value: 0, splitCount: 3 }), "Split evenly · 3 people");
  assert.equal(describeSplit({ mode: "equal", value: 0, splitCount: 1 }), "Not split");
});
