namespace ReceiptRing.Services {
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
      // Extra cents each person has absorbed on earlier lines, so odd cents
      // rotate between people instead of always landing on the first one.
      const luck = new Map<string, number>();
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

          const shares = this.getLineShares(line, lineAssignments, luck);
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
      const taxShares = this.distributeProportionally(taxCents, weights);

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
      luck: Map<string, number>
    ): Map<string, number> {
      const shares = new Map<string, number>();
      if (assignments.length === 0) return shares;

      const lineCents = this.toCents(line.amount);
      const tally = assignments.map((assignment) => luck.get(assignment.personId) ?? 0);
      const base = Math.trunc(lineCents / assignments.length);
      const recordLuck = (personId: string, cents: number) =>
        luck.set(personId, (luck.get(personId) ?? 0) + cents - base);

      if (assignments.every((assignment) => assignment.mode === "equal")) {
        const even = this.distributeEvenly(lineCents, assignments.length, tally);
        assignments.forEach((assignment, index) => {
          shares.set(assignment.personId, even[index]);
          recordLuck(assignment.personId, even[index]);
        });
        return shares;
      }

      // Mixed modes: the equal-mode assignments still divide the whole line, as
      // before — only the even-split path can distribute leftover cents.
      const equalCount = assignments.filter((assignment) => assignment.mode === "equal").length;
      const equalShares = equalCount > 0 ? this.distributeEvenly(lineCents, assignments.length, tally) : [];
      let equalIndex = 0;

      assignments.forEach((assignment) => {
        if (assignment.mode === "percentage") {
          shares.set(assignment.personId, Math.round(lineCents * (assignment.value / 100)));
        } else if (assignment.mode === "amount") {
          shares.set(assignment.personId, this.toCents(assignment.value));
        } else {
          shares.set(assignment.personId, equalShares[equalIndex]);
          recordLuck(assignment.personId, equalShares[equalIndex]);
          equalIndex += 1;
        }
      });

      return shares;
    }

    /**
     * Split a cent total into `count` parts that sum back to it exactly. The
     * leftover cents go to the slots with the lowest `tally` (cents of luck
     * they have already had on earlier lines), so the same person is not always
     * the one who pays the extra cent. Ties fall back to slot order. A negative
     * leftover (a discount) takes its cent back from the highest tally.
     */
    private distributeEvenly(totalCents: number, count: number, tally: readonly number[] = []): number[] {
      if (count <= 0) return [];
      const base = Math.trunc(totalCents / count);
      const remainder = totalCents - base * count;
      const step = remainder < 0 ? -1 : 1;
      const owed = (index: number) => tally[index] ?? 0;

      const order = Array.from({ length: count }, (_, index) => index).sort(
        (left, right) => step * (owed(left) - owed(right)) || left - right
      );
      const result = Array.from({ length: count }, () => base);
      for (let taken = 0; taken < Math.abs(remainder); taken += 1) {
        result[order[taken]] += step;
      }
      return result;
    }

    /**
     * Split a cent total across weights so the parts sum back to it exactly,
     * giving the leftover cents to the largest fractional remainders.
     */
    private distributeProportionally(totalCents: number, weights: readonly number[]): number[] {
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

    private toCents(value: number): number {
      return Number.isFinite(value) ? Math.round(value * 100) : 0;
    }

    private toAmount(cents: number): number {
      return cents / 100;
    }
  }
}
