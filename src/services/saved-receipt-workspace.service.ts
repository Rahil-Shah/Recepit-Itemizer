namespace ReceiptRing.Services {
  /** A saved receipt, laid back out in the shape the Split workspace edits. */
  export interface SavedReceiptWorkspace {
    storeName: string;
    category: string;
    tax: number;
    lines: Domain.ReceiptLine[];
    assignments: Domain.LineAssignment[];
    lineModes: Map<string, Domain.AssignmentMode>;
    identifications: Map<string, Domain.ItemIdentification>;
    people: Domain.SplitPerson[];
  }

  const ASSIGNMENT_MODES: readonly string[] = ["equal", "percentage", "amount"];

  /**
   * Turns a receipt from History back into something the Split tab can edit,
   * so a wrong assignment or food flag is fixed with the controls it was made
   * with rather than on a read-only card.
   *
   * Line ids are kept as saved. They only ever travel back to the server as
   * client ids, and keeping them means every share, flag and identification
   * still points at the line it was made on.
   */
  export function workspaceFromSavedReceipt(
    receipt: SavedReceiptSummary,
    createId: () => string
  ): SavedReceiptWorkspace {
    const assignments: Domain.LineAssignment[] = [];
    const lineModes = new Map<string, Domain.AssignmentMode>();
    const identifications = new Map<string, Domain.ItemIdentification>();

    const lines = receipt.lines.map((line): Domain.ReceiptLine => {
      const identification = identificationFromStored(line, line.identification);
      if (identification) identifications.set(line.id, identification);

      for (const share of line.assignments) {
        // The server reports a share with no person as an empty id. There is
        // nobody to put it back on, and saving it would be refused.
        if (!share.personId) continue;

        const mode = ASSIGNMENT_MODES.includes(share.mode)
          ? (share.mode as Domain.AssignmentMode)
          : "equal";
        // Changing a line's mode rewrites every share on it, so the first
        // share speaks for the whole line.
        if (!lineModes.has(line.id)) lineModes.set(line.id, mode);

        assignments.push({
          id: createId(),
          lineId: line.id,
          personId: share.personId,
          mode,
          value: Number(share.value) || 0
        });
      }

      return {
        id: line.id,
        label: line.label,
        amount: Number(line.amount) || 0,
        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
        confidence: 100,
        ignored: line.ignored ?? false,
        isFood: line.isFood ?? false
      };
    });

    return {
      storeName: receipt.storeName ?? "",
      category: receipt.category,
      tax: Number(receipt.tax) || 0,
      lines,
      assignments,
      lineModes,
      identifications,
      people: receipt.people.map((person) => ({
        id: person.id,
        name: person.name,
        isSelf: Boolean(person.isSelf)
      }))
    };
  }

  /** A stored identification back in the shape the workspace works with. */
  function identificationFromStored(
    line: { id: string; label: string; itemCode?: string | null },
    stored: StoredIdentification | null | undefined
  ): Domain.ItemIdentification | null {
    if (!stored?.resolvedName) return null;

    return {
      lineId: line.id,
      rawLabel: line.label,
      ...(line.itemCode ? { itemCode: line.itemCode } : {}),
      resolvedName: stored.resolvedName,
      ...(stored.brand ? { brand: stored.brand } : {}),
      ...(stored.size ? { size: stored.size } : {}),
      confidence: Number(stored.confidence) || 0,
      source: stored.source ?? "unresolved",
      ...(stored.reasoning ? { reasoning: stored.reasoning } : {}),
      alternatives: Array.isArray(stored.alternatives) ? stored.alternatives : [],
      confirmed: Boolean(stored.confirmed)
    };
  }
}
