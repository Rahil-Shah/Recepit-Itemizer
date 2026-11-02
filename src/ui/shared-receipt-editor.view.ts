namespace ReceiptRing.UI {
  export interface SharedReceiptEditorActions {
    save(edit: Services.SharedReceiptEdit): Promise<Services.SharedReceipt>;
    onSaved(receipt: Services.SharedReceipt): void;
    onCancel(): void;
  }

  interface DraftLine {
    id?: string;
    name: string;
    amount: string;
    // What a person ticked onto this line gets. A line keeps each person's own
    // mode until this is changed, so saving never flattens a mixed line.
    mode: Domain.AssignmentMode;
    assignments: Services.SharedReceiptAssignment[];
  }

  const MODE_LABELS: Record<Domain.AssignmentMode, string> = {
    equal: "Split evenly",
    percentage: "Split by %",
    amount: "Custom amounts"
  };

  /** The form behind "Edit receipt" on a share link that allows it. */
  export class SharedReceiptEditorView {
    private storeName: string;
    private tax: string;
    private lines: DraftLine[];

    constructor(
      private readonly root: HTMLElement,
      private readonly receipt: Services.SharedReceipt,
      private readonly actions: SharedReceiptEditorActions
    ) {
      this.storeName = receipt.storeName ?? "";
      this.tax = receipt.tax === null ? "" : String(receipt.tax);
      this.lines = receipt.lines.map((line) => ({
        id: line.id,
        name: line.name,
        amount: String(line.amount),
        mode: (line.assignments[0]?.mode as Domain.AssignmentMode) ?? "equal",
        assignments: line.assignments.map((assignment) => ({ ...assignment }))
      }));
    }

    render(): void {
      const heading = document.createElement("h1");
      heading.className = "page-title";
      heading.textContent = "Edit receipt";

      const form = document.createElement("form");
      form.className = "shared-editor";
      form.noValidate = true;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.submit(form);
      });

      form.append(
        this.field("Store", this.input("text", this.storeName, "Store name", (value) => (this.storeName = value)))
      );
      this.lines.forEach((line, index) => form.append(this.renderLine(line, index)));

      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn-secondary btn-small shared-add-item";
      add.textContent = "Add item";
      add.addEventListener("click", () => {
        this.lines.push({ name: "", amount: "", mode: "equal", assignments: [] });
        this.render();
      });
      form.append(add);

      form.append(this.field("Tax", this.input("number", this.tax, "Tax", (value) => (this.tax = value))));

      const error = document.createElement("p");
      error.className = "shared-editor-error";
      error.setAttribute("role", "alert");

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-secondary";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => this.actions.onCancel());
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "btn btn-primary shared-save";
      save.textContent = "Save changes";
      const buttons = document.createElement("div");
      buttons.className = "modal-actions";
      buttons.append(cancel, save);
      form.append(error, buttons);

      this.root.replaceChildren(heading, form);
    }

    private renderLine(line: DraftLine, index: number): HTMLElement {
      const wrap = document.createElement("section");
      wrap.className = "shared-card shared-editor-line";

      const top = document.createElement("div");
      top.className = "shared-editor-top";
      const name = this.input("text", line.name, "Item name", (value) => (line.name = value));
      const amount = this.input("number", line.amount, "Item price", (value) => (line.amount = value));
      amount.classList.add("shared-editor-amount");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost btn-small shared-remove-item";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${line.name || "this item"}`);
      remove.addEventListener("click", () => {
        this.lines.splice(index, 1);
        this.render();
      });
      top.append(name, amount, remove);
      wrap.append(top);

      if (this.receipt.people.length > 0) wrap.append(this.renderAssignments(line));
      return wrap;
    }

    private renderAssignments(line: DraftLine): HTMLElement {
      const wrap = document.createElement("div");
      wrap.className = "shared-editor-split";

      const mode = document.createElement("select");
      mode.className = "table-select shared-editor-mode";
      mode.setAttribute("aria-label", "How this item is split");
      (Object.keys(MODE_LABELS) as Domain.AssignmentMode[]).forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = MODE_LABELS[value];
        mode.append(option);
      });
      mode.value = line.mode;
      mode.addEventListener("change", () => {
        this.setMode(line, mode.value as Domain.AssignmentMode);
        this.render();
      });
      wrap.append(mode);

      const chips = document.createElement("div");
      chips.className = "person-chips";
      this.receipt.people.forEach((person) => {
        const on = line.assignments.some((assignment) => assignment.personId === person.id);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "person-chip";
        chip.textContent = person.name;
        chip.setAttribute("aria-pressed", String(on));
        chip.addEventListener("click", () => {
          line.assignments = on
            ? line.assignments.filter((assignment) => assignment.personId !== person.id)
            : [...line.assignments, { personId: person.id, mode: line.mode, value: 0 }];
          this.render();
        });
        chips.append(chip);
      });
      wrap.append(chips);

      line.assignments
        .filter((assignment) => assignment.mode !== "equal")
        .forEach((assignment) => {
          const person = this.receipt.people.find((entry) => entry.id === assignment.personId);
          const unit = assignment.mode === "percentage" ? "%" : "$";
          const label = `${person?.name ?? "Someone"} (${unit})`;
          wrap.append(
            this.field(
              label,
              this.input("number", String(assignment.value), label, (value) => {
                assignment.value = Number(value);
              })
            )
          );
        });
      return wrap;
    }

    /** A new mode starts everyone on an even share, ready to be adjusted. */
    private setMode(line: DraftLine, mode: Domain.AssignmentMode): void {
      line.mode = mode;
      const count = line.assignments.length;
      const amount = Number(line.amount) || 0;
      line.assignments.forEach((assignment) => {
        assignment.mode = mode;
        if (mode === "equal" || count === 0) assignment.value = 0;
        else if (mode === "percentage") assignment.value = Math.round((100 / count) * 100) / 100;
        else assignment.value = Math.round((amount / count) * 100) / 100;
      });
    }

    private async submit(form: HTMLFormElement): Promise<void> {
      const edit = this.buildEdit();
      if (typeof edit === "string") {
        this.showError(form, edit);
        return;
      }
      const save = form.querySelector<HTMLButtonElement>(".shared-save");
      if (save) setBusy(save, true);
      try {
        this.actions.onSaved(await this.actions.save(edit));
      } catch (error) {
        if (save) setBusy(save, false);
        this.showError(form, error instanceof Error ? error.message : "Could not save.");
      }
    }

    private showError(form: HTMLFormElement, message: string): void {
      const element = form.querySelector(".shared-editor-error");
      if (element) element.textContent = message;
    }

    /** The edit to send, or what is wrong with the form. */
    private buildEdit(): Services.SharedReceiptEdit | string {
      if (this.lines.length === 0) return "A receipt needs at least one item.";
      const tax = this.tax.trim() === "" ? null : Number(this.tax);
      if (tax !== null && !Number.isFinite(tax)) return "Tax must be a number.";

      const lines: Services.SharedReceiptEdit["lines"] = [];
      for (const line of this.lines) {
        const label = line.name.trim();
        const amount = Number(line.amount);
        if (!label) return "Every item needs a name.";
        if (line.amount.trim() === "" || !Number.isFinite(amount)) return `Enter a price for ${label}.`;
        if (line.assignments.some((assignment) => !Number.isFinite(assignment.value))) {
          return `Check the split on ${label}.`;
        }
        lines.push({
          ...(line.id ? { id: line.id } : {}),
          label,
          amount,
          assignments: line.assignments
        });
      }
      return { updatedAt: this.receipt.updatedAt, storeName: this.storeName.trim() || null, tax, lines };
    }

    private field(label: string, control: HTMLElement): HTMLElement {
      const wrap = document.createElement("label");
      wrap.className = "field shared-editor-field";
      const text = document.createElement("span");
      text.className = "field-label";
      text.textContent = label;
      wrap.append(text, control);
      return wrap;
    }

    private input(type: "text" | "number", value: string, label: string, onInput: (value: string) => void): HTMLInputElement {
      const input = document.createElement("input");
      input.type = type;
      input.className = "table-input";
      input.value = value;
      input.setAttribute("aria-label", label);
      if (type === "number") input.step = "0.01";
      else input.maxLength = 200;
      input.addEventListener("input", () => onInput(input.value));
      return input;
    }
  }
}
