// Who owes what on a saved receipt, worked out on the server.
//
// A port of SplitCalculatorService (src/services/split-calculator.service.ts)
// for callers that never load the browser bundle -- the MCP tools an AI
// assistant uses to answer "who paid for what". It must give the same cents
// to the same people as the Split tab and the History person filter do, so it
// follows that code step for step, and tests/split.test.mjs runs both on the
// same receipts and compares.
//
// Pure: no Prisma, no Express. Everything is whole-cent integer arithmetic.

import { createCentLedger, getLineShares, toCents } from "./food-share.mjs";

const EPSILON = 1e-9;

/**
 * Split a cent total across weights so the parts sum back to it exactly,
 * giving the leftover cents to the largest fractional remainders. Equal
 * remainders go to the lowest `tiebreak` first, then in order. The same rule
 * as the client's distributeProportionally (food-share.mjs has a simpler one
 * without the tiebreak, which the tax split here needs).
 */
export function distributeProportionally(totalCents, weights, tiebreak = []) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0 || totalCents === 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (weight / weightSum) * totalCents);
  const result = exact.map((value) => Math.trunc(value));
  let remainder = totalCents - result.reduce((sum, value) => sum + value, 0);
  const step = remainder < 0 ? -1 : 1;

  const byFraction = exact
    .map((value, index) => ({ index, fraction: Math.abs(value - result[index]) }))
    .sort(
      (left, right) =>
        (Math.abs(right.fraction - left.fraction) > EPSILON ? right.fraction - left.fraction : 0) ||
        (tiebreak[left.index] ?? 0) - (tiebreak[right.index] ?? 0) ||
        left.index - right.index
    );

  for (const { index } of byFraction) {
    if (remainder === 0) break;
    result[index] += step;
    remainder -= step;
  }

  return result;
}

// food-share.mjs keys shares by accountPersonId; here a person is just `id`.
const asShareInput = (assignments) =>
  assignments.map((assignment) => ({
    accountPersonId: assignment.personId,
    mode: assignment.mode,
    value: Number(assignment.value)
  }));

const activeLines = (lines) => lines.filter((line) => !line.ignored);

/**
 * Each person's items, tax and total on one receipt.
 *
 * `people` is [{ id, name }] in the order the receipt lists them (tax ties are
 * broken by that order, as on the client). `lines` carry
 * { id, amount, ignored, isFood, assignments: [{ personId, mode, value }] }.
 */
export function calculateSplit(people, lines, tax) {
  const itemCents = new Map();
  const foodCents = new Map();
  const ledger = createCentLedger();
  for (const person of people) {
    itemCents.set(person.id, 0);
    foodCents.set(person.id, 0);
  }
  let unallocatedCents = 0;
  let unassignedLines = 0;
  const taxCents = toCents(tax);
  let receiptCents = taxCents;

  for (const line of activeLines(lines)) {
    receiptCents += toCents(line.amount);
    const assignments = line.assignments ?? [];
    if (assignments.length === 0) {
      unassignedLines += 1;
      continue;
    }

    const shares = getLineShares(toCents(line.amount), asShareInput(assignments), ledger);
    let allocated = 0;
    shares.forEach((cents, personId) => {
      itemCents.set(personId, (itemCents.get(personId) ?? 0) + cents);
      if (line.isFood) foodCents.set(personId, (foodCents.get(personId) ?? 0) + cents);
      allocated += cents;
    });
    unallocatedCents += toCents(line.amount) - allocated;
  }

  const weights = people.map((person) => itemCents.get(person.id) ?? 0);
  const exactWeights = people.map((person, index) => weights[index] - (ledger.drift.get(person.id) ?? 0));
  const taxShares = distributeProportionally(taxCents, exactWeights, weights);

  let assignedCents = 0;
  const totals = people.map((person, index) => {
    const items = weights[index];
    const allocatedTax = taxShares[index];
    assignedCents += items + allocatedTax;
    const food = foodCents.get(person.id) ?? 0;
    const [foodTax] = distributeProportionally(allocatedTax, [food, items - food]);
    return {
      personId: person.id,
      personName: person.name,
      itemTotal: items / 100,
      foodTotal: (food + foodTax) / 100,
      allocatedTax: allocatedTax / 100,
      finalTotal: (items + allocatedTax) / 100
    };
  });

  return {
    totals,
    unallocated: unallocatedCents / 100,
    unassignedLines,
    receiptTotal: receiptCents / 100,
    assignedTotal: assignedCents / 100,
    isBalanced: receiptCents === assignedCents
  };
}

/**
 * One person's lines and what each cost them, with their tax and total. The
 * lines are walked with a ledger of their own in the order calculateSplit()
 * walks them, so odd cents land on the same people and the shares here add up
 * to that person's total there.
 */
export function personBreakdown(people, lines, tax, personId) {
  const ledger = createCentLedger();
  const items = [];

  for (const line of activeLines(lines)) {
    const assignments = line.assignments ?? [];
    if (assignments.length === 0) continue;
    const shares = getLineShares(toCents(line.amount), asShareInput(assignments), ledger);
    const mine = assignments.find((assignment) => assignment.personId === personId);
    if (!mine) continue;
    items.push({
      lineId: line.id,
      label: line.label,
      lineAmount: Number(line.amount),
      share: (shares.get(personId) ?? 0) / 100,
      mode: mine.mode,
      value: Number(mine.value),
      splitCount: assignments.length
    });
  }

  const total = calculateSplit(people, lines, tax).totals.find((entry) => entry.personId === personId);
  return {
    personId,
    items,
    itemTotal: total?.itemTotal ?? 0,
    allocatedTax: total?.allocatedTax ?? 0,
    finalTotal: total?.finalTotal ?? 0
  };
}

/** "Split evenly · 3 people", as the History person filter words it. */
export function describeSplit(item) {
  if (item.mode === "percentage") return `Split by % · ${item.value}%`;
  if (item.mode === "amount") return "Custom amount";
  return item.splitCount > 1 ? `Split evenly · ${item.splitCount} people` : "Not split";
}
