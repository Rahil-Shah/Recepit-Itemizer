namespace ReceiptRing.Services {
  export class SplitCalculatorService {
    calculate(
      people: readonly Domain.SplitPerson[],
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[],
      tax: number
    ): Domain.PersonSplitTotal[] {
      const itemTotals = new Map<string, number>();
      people.forEach((person) => itemTotals.set(person.id, 0));

      lines
        .filter((line) => !line.ignored)
        .forEach((line) => {
          const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
          this.getLineShares(line, lineAssignments).forEach((amount, personId) => {
            itemTotals.set(personId, (itemTotals.get(personId) ?? 0) + amount);
          });
        });

      const subtotal = Array.from(itemTotals.values()).reduce((sum, value) => sum + value, 0);

      return people.map((person) => {
        const itemTotal = itemTotals.get(person.id) ?? 0;
        const allocatedTax = subtotal > 0 ? (itemTotal / subtotal) * tax : 0;

        return {
          personId: person.id,
          personName: person.name,
          itemTotal,
          allocatedTax,
          finalTotal: itemTotal + allocatedTax
        };
      });
    }

    getUnassignedCount(
      lines: readonly Domain.ReceiptLine[],
      assignments: readonly Domain.LineAssignment[]
    ): number {
      return lines.filter(
        (line) => !line.ignored && !assignments.some((assignment) => assignment.lineId === line.id)
      ).length;
    }

    private getLineShares(
      line: Domain.ReceiptLine,
      assignments: readonly Domain.LineAssignment[]
    ): Map<string, number> {
      const shares = new Map<string, number>();
      if (assignments.length === 0) return shares;

      if (assignments.every((assignment) => assignment.mode === "equal")) {
        const share = line.amount / assignments.length;
        assignments.forEach((assignment) => shares.set(assignment.personId, share));
        return shares;
      }

      assignments.forEach((assignment) => {
        if (assignment.mode === "percentage") {
          shares.set(assignment.personId, line.amount * (assignment.value / 100));
        } else if (assignment.mode === "amount") {
          shares.set(assignment.personId, assignment.value);
        } else {
          shares.set(assignment.personId, line.amount / assignments.length);
        }
      });

      return shares;
    }
  }
}
