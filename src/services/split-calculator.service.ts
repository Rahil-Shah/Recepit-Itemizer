namespace ReceiptRing.Services {
  /**
   * Running record of how far each person's even-split shares have strayed
   * from their exact fair share, across the lines of one receipt.
   *
   * $0.99 four ways is 24.75 cents each, which cannot be paid: three people
   * pay 25 and one pays 24. Whoever has so far paid the most over their exact
   * share is the last in line for the next spare cent, so across a batch of
   * odd-priced lines everyone ends within a cent of the exact even split.
   * `turn` rotates who goes first when people are tied, so a tie never falls
   * to whoever happened to be selected first.
   */
  export interface CentLedger {
    drift: Map<string, number>;
    turn: number;
  }

  const EPSILON = 1e-9;

  export class SplitCalculatorService {
    // Everything is computed in whole cents. Splitting in floats and rounding
    // only at display time meant the shares didn't add up to the bill: $10.00
    // three ways printed as three rows of $3.33 against a $10.00 total, and
    // float drift accumulated across lines on top of that.
    calculate(
      people: readonly Domain.SplitPerson[],
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[],
      tax: number
    ): Domain.SplitSummary {
      const itemCents = new Map<string, number>();
      const foodCents = new Map<string, number>();
      // How far each person's even-split shares have strayed from the exact
      // split so far, so odd cents even out across the receipt.
      const ledger: CentLedger = { drift: new Map(), turn: 0 };
      people.forEach((person) => {
        itemCents.set(person.id, 0);
        foodCents.set(person.id, 0);
      });
      let unallocatedCents = 0;
      const taxCents = this.toCents(tax);
      let receiptCents = taxCents;

      lines
        .filter((line) => !line.ignored)
        .forEach((line) => {
          // The receipt is owed this whether or not anyone was assigned to the
          // line, so it is counted before the early return below.
          receiptCents += this.toCents(line.amount);

          const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
          if (lineAssignments.length === 0) return;

          const shares = this.getLineShares(line, lineAssignments, ledger);
          let allocated = 0;
          shares.forEach((cents, personId) => {
            itemCents.set(personId, (itemCents.get(personId) ?? 0) + cents);
            // Food is the same share of the same line, so it is taken from the
            // one `shares` map rather than recomputed: two code paths could
            // round apart and claim someone's food exceeded their items. This
            // is the pre-tax figure; tax is apportioned onto it below.
            if (line.isFood) {
              foodCents.set(personId, (foodCents.get(personId) ?? 0) + cents);
            }
            allocated += cents;
          });

          // Custom amounts and percentages need not cover the line. What's
          // left over is charged to nobody, so it has to be reported rather
          // than silently vanishing from the split. A line with no assignments
          // at all is already surfaced by getUnassignedCount.
          unallocatedCents += this.toCents(line.amount) - allocated;
        });

      const orderedPeople = [...people];
      const weights = orderedPeople.map((person) => itemCents.get(person.id) ?? 0);
      // Tax is shared in proportion to what each person owes exactly, before
      // their items were rounded to the cent. Otherwise the person who took a
      // spare item cent would also be first in line for a spare tax cent, and
      // the same person would come out two cents ahead of everyone else.
      // Ties go to whoever paid the fewest item cents.
      const exactWeights = orderedPeople.map(
        (person, index) => weights[index] - (ledger.drift.get(person.id) ?? 0)
      );
      const taxShares = this.distributeProportionally(taxCents, exactWeights, weights);

      let assignedCents = 0;
      const totals = orderedPeople.map((person, index) => {
        const itemTotal = weights[index];
        const allocatedTax = taxShares[index];
        assignedCents += itemTotal + allocatedTax;

        // Tax follows the items it was charged on. This person's tax is split
        // between their food and non-food items in the same proportion, so the
        // food figure is what the food actually cost them at the till rather
        // than a pre-tax subtotal. Reusing distributeProportionally means the
        // food and non-food halves sum back to allocatedTax exactly, so no cent
        // of tax is invented or dropped on the way in.
        const foodItems = foodCents.get(person.id) ?? 0;
        const [foodTax] = this.distributeProportionally(allocatedTax, [
          foodItems,
          itemTotal - foodItems
        ]);

        return {
          personId: person.id,
          personName: person.name,
          itemTotal: this.toAmount(itemTotal),
          foodTotal: this.toAmount(foodItems + foodTax),
          allocatedTax: this.toAmount(allocatedTax),
          finalTotal: this.toAmount(itemTotal + allocatedTax)
        };
      });

      return {
        totals,
        unallocated: this.toAmount(unallocatedCents),
        receiptTotal: this.toAmount(receiptCents),
        assignedTotal: this.toAmount(assignedCents),
        // Compared as cent integers: the dollar values are the same numbers
        // divided by 100, and asking whether two of those are within half a
        // cent of each other reintroduces exactly the float slop the cent
        // discipline exists to avoid.
        isBalanced: receiptCents === assignedCents
      };
    }

    getUnassignedCount(
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[]
    ): number {
      return lines.filter(
        (line) => !line.ignored && !assignments.some((assignment) => assignment.lineId === line.id)
      ).length;
    }

    /** Each assigned person's share of one line, in whole cents. */
    private getLineShares(
      line: Domain.ReceiptLine,
      assignments: readonly Domain.LineAssignment[],
      ledger: CentLedger
    ): Map<string, number> {
      const shares = new Map<string, number>();
      if (assignments.length === 0) return shares;

      const lineCents = this.toCents(line.amount);
      const equal = assignments.filter((assignment) => assignment.mode === "equal");

      // The equal-mode people each take 1/n of the line, as they always have;
      // in a mixed line the others' percentages and amounts are on top. Their
      // part is shared out as one pot, so its odd cents are balanced too.
      if (equal.length > 0) {
        const pot =
          equal.length === assignments.length
            ? lineCents
            : Math.round((lineCents * equal.length) / assignments.length);
        const even = this.splitEvenly(
          pot,
          equal.map((assignment) => assignment.personId),
          ledger
        );
        equal.forEach((assignment, index) => shares.set(assignment.personId, even[index]));
      }

      assignments.forEach((assignment) => {
        if (assignment.mode === "percentage") {
          shares.set(assignment.personId, Math.round(lineCents * (assignment.value / 100)));
        } else if (assignment.mode === "amount") {
          shares.set(assignment.personId, this.toCents(assignment.value));
        }
      });

      return shares;
    }

    /**
     * Split a cent total evenly between `personIds` so the parts sum back to
     * it exactly. The leftover cents go to whoever has paid the least against
     * their exact share on earlier lines (see CentLedger); ties rotate from
     * line to line rather than always landing on the first person. A negative
     * leftover (a discount) takes its cents back from whoever has paid most.
     */
    private splitEvenly(totalCents: number, personIds: readonly string[], ledger: CentLedger): number[] {
      const count = personIds.length;
      if (count <= 0) return [];
      const base = Math.trunc(totalCents / count);
      const remainder = totalCents - base * count;
      const exact = totalCents / count;
      const step = remainder < 0 ? -1 : 1;
      const drift = personIds.map((id) => ledger.drift.get(id) ?? 0);
      const start = ledger.turn % count;
      const rotation = (index: number) => (index - start + count) % count;

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
     * giving the leftover cents to the largest fractional remainders. Equal
     * remainders go to the lowest `tiebreak` first, then in order.
     */
    private distributeProportionally(
      totalCents: number,
      weights: readonly number[],
      tiebreak: readonly number[] = []
    ): number[] {
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

    private toCents(value: number): number {
      return Number.isFinite(value) ? Math.round(value * 100) : 0;
    }

    private toAmount(cents: number): number {
      return cents / 100;
    }
  }
}
