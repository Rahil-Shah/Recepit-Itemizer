import test from "node:test";
import assert from "node:assert/strict";
import { summariseReceiptFood, getLineShares, distributeProportionally } from "../server/food-share.mjs";

const ME = "acct-me";
const BRYCE = "acct-bryce";
const DYLAN = "acct-dylan";

function line(id, amount, options = {}) {
  return {
    id,
    label: options.label ?? id,
    amount,
    ignored: options.ignored ?? false,
    isFood: options.isFood ?? false,
    assignments: options.assignments ?? []
  };
}

function foodLine(id, amount, options = {}) {
  return line(id, amount, { ...options, isFood: true });
}

function equal(accountPersonId, name) {
  return { accountPersonId, name, mode: "equal", value: 0 };
}

function receipt(lines, tax = 0) {
  return { id: "r1", storeName: "Costco", date: "2026-08-19", tax, lines };
}

function cents(amount) {
  return Math.round(amount * 100);
}

test("an unsplit receipt counts all of its food as the owner's", () => {
  const summary = summariseReceiptFood(receipt([foodLine("l1", 12.5), line("l2", 30)]), ME);

  assert.equal(summary.total, 12.5);
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0].shared, false);
});

test("food assigned only to other people is not the owner's expense", () => {
  const lines = [
    foodLine("l1", 20, { assignments: [equal(BRYCE, "Bryce")] }),
    foodLine("l2", 8, { assignments: [equal(ME, "Rahil")] })
  ];

  const summary = summariseReceiptFood(receipt(lines), ME);

  // Bryce's $20 of food is money the owner is not paying, so it neither counts
  // toward the total nor appears in the drill-down at all.
  assert.equal(summary.total, 8);
  assert.deepEqual(summary.items.map((item) => item.lineId), ["l2"]);
});

test("a split food line counts only the owner's share", () => {
  const lines = [
    foodLine("l1", 30, {
      assignments: [equal(ME, "Rahil"), equal(BRYCE, "Bryce"), equal(DYLAN, "Dylan")]
    })
  ];

  const summary = summariseReceiptFood(receipt(lines), ME);

  assert.equal(summary.total, 10);
  assert.equal(summary.items[0].amount, 10);
  // The full price is kept so the row can read "your share of $30.00".
  assert.equal(summary.items[0].fullAmount, 30);
  assert.equal(summary.items[0].shared, true);
  assert.deepEqual(summary.items[0].sharedWith, ["Bryce", "Dylan"]);
});

test("percentage and amount splits follow the same rules as the workspace", () => {
  const lines = [
    foodLine("l1", 40, {
      assignments: [
        { accountPersonId: ME, name: "Rahil", mode: "percentage", value: 25 },
        { accountPersonId: BRYCE, name: "Bryce", mode: "percentage", value: 75 }
      ]
    }),
    foodLine("l2", 20, {
      assignments: [{ accountPersonId: ME, name: "Rahil", mode: "amount", value: 12 }]
    })
  ];

  const summary = summariseReceiptFood(receipt(lines), ME);

  assert.equal(summary.items.find((item) => item.lineId === "l1").amount, 10);
  assert.equal(summary.items.find((item) => item.lineId === "l2").amount, 12);
  assert.equal(summary.total, 22);
});

test("ignored lines are left out entirely", () => {
  const lines = [foodLine("l1", 10), foodLine("l2", 99, { ignored: true })];

  const summary = summariseReceiptFood(receipt(lines), ME);

  assert.equal(summary.total, 10);
  assert.equal(summary.items.length, 1);
});

test("tax is apportioned onto the owner's food share", () => {
  // $30 of food and $10 of other things, $4 of tax over $40 of items. Three
  // quarters of the items are food, so three quarters of the tax is too.
  const summary = summariseReceiptFood(receipt([foodLine("l1", 30), line("l2", 10)], 4), ME);

  assert.equal(summary.itemTotal, 30);
  assert.equal(summary.taxTotal, 3);
  assert.equal(summary.total, 33);
});

test("tax follows the owner's share of a split receipt, not the whole bill", () => {
  const lines = [
    foodLine("l1", 30, { assignments: [equal(ME, "Rahil"), equal(BRYCE, "Bryce")] }),
    line("l2", 10, { assignments: [equal(BRYCE, "Bryce")] })
  ];

  // $4 tax over $40 of items; the owner's food is $15 of that, so $1.50.
  const summary = summariseReceiptFood(receipt(lines, 4), ME);

  assert.equal(summary.itemTotal, 15);
  assert.equal(summary.taxTotal, 1.5);
  assert.equal(summary.total, 16.5);
});

test("an all-food unsplit receipt puts every cent of tax in the total", () => {
  const summary = summariseReceiptFood(receipt([foodLine("l1", 30)], 6), ME);

  assert.equal(summary.taxTotal, 6);
  assert.equal(summary.total, 36);
});

test("apportioned tax never invents or loses a cent", () => {
  // Odd amounts so the proportional split cannot land on whole cents by luck.
  const summary = summariseReceiptFood(receipt([foodLine("l1", 10.01), line("l2", 10)], 3.33), ME);

  const mine = cents(summary.taxTotal);
  const theirs = distributeProportionally(333, [1001, 1000])[1];
  assert.equal(mine + theirs, 333);
  assert.equal(cents(summary.total), 1001 + mine);
});

test("a receipt with no self person still counts its unassigned food", () => {
  // Before the account owner has a person entry, an unsplit receipt is still
  // plainly theirs -- but a line named to someone else is not.
  const lines = [foodLine("l1", 10), foodLine("l2", 25, { assignments: [equal(BRYCE, "Bryce")] })];

  const summary = summariseReceiptFood(receipt(lines), null);

  assert.equal(summary.total, 10);
  assert.deepEqual(summary.items.map((item) => item.lineId), ["l1"]);
});

test("an even split of an odd amount hands out every cent", () => {
  const shares = getLineShares(1000, [equal(ME, "Rahil"), equal(BRYCE, "B"), equal(DYLAN, "D")]);
  const total = [...shares.values()].reduce((sum, value) => sum + value, 0);

  assert.equal(total, 1000);
  assert.ok(shares.get(ME) === 334 || shares.get(ME) === 333);
});

test("a receipt whose food is entirely someone else's yields no items", () => {
  const lines = [foodLine("l1", 40, { assignments: [equal(BRYCE, "Bryce")] })];

  const summary = summariseReceiptFood(receipt(lines, 3), ME);

  assert.equal(summary.items.length, 0);
  assert.equal(summary.total, 0);
  // No food of the owner's means no tax on the owner's food either.
  assert.equal(summary.taxTotal, 0);
});

test("odd cents rotate between people across lines", () => {
  const luck = new Map();
  const people = ["a", "b", "c", "d"].map((id) => ({ accountPersonId: id, mode: "equal", value: 0 }));
  const owed = new Map(people.map((p) => [p.accountPersonId, 0]));
  for (let i = 0; i < 4; i += 1) {
    const shares = getLineShares(99, people, luck);
    shares.forEach((cents, id) => owed.set(id, owed.get(id) + cents));
  }
  assert.deepEqual([...owed.values()], [99, 99, 99, 99]);
});
