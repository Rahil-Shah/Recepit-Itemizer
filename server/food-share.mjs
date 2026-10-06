// Works out how much of a receipt's food the account owner actually paid for.
//
// A receipt's food lines are not automatically the owner's expense: a line
// split with friends is only theirs in part, and a line assigned entirely to
// someone else is not theirs at all. Everything here is whole-cent integer
// arithmetic and mirrors SplitCalculatorService on the client, so the figure
// the budgeting view shows agrees with the figure the split workspace showed
// when the receipt was saved.
//
// Pure and side-effect free (no Prisma types, no server imports) so it can be
// unit tested directly.

export function toCents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

const EPSILON = 1e-9;

/**
 * A running record, across one receipt's lines, of how far each person's
 * even-split shares have strayed from their exact fair share. Mirrors
 * CentLedger in SplitCalculatorService.
 */
export function createCentLedger() {
  return { drift: new Map(), turn: 0 };
}

/**
 * Split a cent total evenly between `personIds` so the parts sum back to it
 * exactly. The leftover cents go to whoever has paid least against their exact
 * share on earlier lines; ties rotate from line to line rather than always
 * landing on the first person. A negative leftover (a discount) takes its
 * cents back from whoever has paid most.
 */
export function splitEvenly(totalCents, personIds, ledger = createCentLedger()) {
  const count = personIds.length;
  if (count <= 0) return [];
  const base = Math.trunc(totalCents / count);
  const remainder = totalCents - base * count;
  const exact = totalCents / count;
  const step = remainder < 0 ? -1 : 1;
  const drift = personIds.map((id) => ledger.drift.get(id) ?? 0);
  const start = ledger.turn % count;
  const rotation = (index) => (index - start + count) % count;

  const order = personIds
    .map((_, index) => index)
    .sort((left, right) => {
      const gap = step * (drift[left] - drift[right]);
      return Math.abs(gap) > EPSILON ? gap : rotation(left) - rotation(right);
    });
  const result = personIds.map(() => base);
  for (let taken = 0; taken < Math.abs(remainder); taken += 1) {
    result[order[taken]] += step;
  }

  personIds.forEach((id, index) => ledger.drift.set(id, drift[index] + result[index] - exact));
  ledger.turn += 1;
  return result;
}

/**
 * Split a cent total across weights so the parts sum back to it exactly,
 * giving the leftover cents to the largest fractional remainders.
 */
export function distributeProportionally(totalCents, weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0 || totalCents === 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (weight / weightSum) * totalCents);
  const result = exact.map((value) => Math.trunc(value));
  let remainder = totalCents - result.reduce((sum, value) => sum + value, 0);
  const step = remainder < 0 ? -1 : 1;

  const byFraction = exact
    .map((value, index) => ({ index, fraction: Math.abs(value - result[index]) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (const { index } of byFraction) {
    if (remainder === 0) break;
    result[index] += step;
    remainder -= step;
  }

  return result;
}

/**
 * Each assigned person's share of one line, in whole cents, keyed by
 * accountPersonId. Mirrors SplitCalculatorService.getLineShares.
 */
export function getLineShares(lineCents, assignments, ledger = createCentLedger()) {
  const shares = new Map();
  if (assignments.length === 0) return shares;

  const equal = assignments.filter((assignment) => assignment.mode === "equal");
  if (equal.length > 0) {
    const pot =
      equal.length === assignments.length
        ? lineCents
        : Math.round((lineCents * equal.length) / assignments.length);
    const even = splitEvenly(
      pot,
      equal.map((assignment) => assignment.accountPersonId),
      ledger
    );
    equal.forEach((assignment, index) => shares.set(assignment.accountPersonId, even[index]));
  }

  assignments.forEach((assignment) => {
    if (assignment.mode === "percentage") {
      shares.set(assignment.accountPersonId, Math.round(lineCents * (Number(assignment.value) / 100)));
    } else if (assignment.mode === "amount") {
      shares.set(assignment.accountPersonId, toCents(assignment.value));
    }
  });

  return shares;
}

/**
 * The owner's food spend on one receipt, plus the per-item detail behind it.
 *
 * `receipt.lines[].assignments[]` carry `{ accountPersonId, name, mode, value }`.
 * A line with no assignments at all is treated as wholly the owner's: an
 * unsplit receipt is the ordinary case, and nobody else has been named on it.
 * A line assigned only to other people contributes nothing and is left out of
 * the detail entirely -- that is the food the owner is not paying for.
 */
export function summariseReceiptFood(receipt, selfAccountPersonId) {
  const activeLines = (receipt.lines ?? []).filter((line) => !line.ignored);

  // Denominator for the tax apportionment below: what the receipt charged for
  // items, whoever ends up owing it.
  const receiptItemCents = activeLines.reduce((sum, line) => sum + toCents(line.amount), 0);

  const items = [];
  let foodCents = 0;
  // How far each person's even shares have strayed from exact, so odd cents
  // even out across the receipt the way the split workspace balances them.
  const ledger = createCentLedger();

  for (const line of activeLines) {
    const lineCents = toCents(line.amount);
    const assignments = line.assignments ?? [];

    let mineCents;
    let sharedWith = [];
    if (assignments.length === 0) {
      mineCents = lineCents;
    } else {
      const shares = getLineShares(lineCents, assignments, ledger);
      mineCents = selfAccountPersonId ? shares.get(selfAccountPersonId) ?? 0 : 0;
      sharedWith = assignments
        .filter((assignment) => assignment.accountPersonId !== selfAccountPersonId)
        .map((assignment) => assignment.name)
        .filter(Boolean);
    }

    if (!line.isFood) continue;
    // A line that costs the owner nothing is not their expense, so it neither
    // adds to the total nor clutters the drill-down.
    if (mineCents === 0) continue;

    foodCents += mineCents;
    items.push({
      lineId: line.id,
      label: line.label,
      amount: mineCents / 100,
      // Kept so the detail row can show "$4.50 of $13.50" for a split line.
      fullAmount: lineCents / 100,
      shared: sharedWith.length > 0,
      sharedWith
    });
  }

  // Tax follows the items it was charged on, the same rule the split workspace
  // uses. Going through distributeProportionally rather than multiplying keeps
  // it exact: the owner's half and everyone else's half sum back to the tax on
  // the receipt, so no cent is invented or dropped.
  const taxCents = toCents(receipt.tax);
  const [foodTaxCents] = distributeProportionally(taxCents, [
    foodCents,
    Math.max(0, receiptItemCents - foodCents)
  ]);

  return {
    receiptId: receipt.id,
    storeName: receipt.storeName ?? null,
    date: receipt.date,
    itemTotal: foodCents / 100,
    taxTotal: foodTaxCents / 100,
    total: (foodCents + foodTaxCents) / 100,
    items
  };
}
