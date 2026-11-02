namespace ReceiptRing.UI {
  const MINUTES_PER_UNIT: Record<string, number> = { minutes: 1, hours: 60, days: 24 * 60 };

  /** The dialog behind a receipt's Share button: make links, and manage live ones. */
  export class ShareReceiptView {
    private receipt: Services.SavedReceiptSummary | null = null;

    constructor(
      private readonly elements: DomRegistry,
      private readonly receiptApiService: Services.ReceiptApiService
    ) {
      this.bindEvents();
    }

    open(receipt: Services.SavedReceiptSummary): void {
      this.receipt = receipt;
      this.elements.shareTitle.textContent = `Share ${receipt.storeName || "this receipt"}`;
      this.elements.shareDurationAmount.value = "1";
      this.elements.shareDurationUnit.value = "days";
      this.elements.shareCanEdit.checked = false;
      this.elements.shareResult.classList.add("hidden");
      this.elements.shareLinkInput.value = "";
      this.elements.shareCopyButton.textContent = "Copy";
      this.setStatus("");
      this.renderActive([]);
      this.elements.shareModal.classList.remove("hidden");
      this.elements.shareDurationAmount.focus();
      void this.loadActive(receipt);
    }

    private close(): void {
      this.receipt = null;
      this.elements.shareModal.classList.add("hidden");
    }

    private setStatus(message: string): void {
      this.elements.shareStatus.textContent = message;
    }

    private async loadActive(receipt: Services.SavedReceiptSummary): Promise<void> {
      try {
        const shares = await this.receiptApiService.listShares(receipt.id);
        // The dialog may have moved on to another receipt in the meantime.
        if (this.receipt?.id === receipt.id) this.renderActive(shares);
      } catch (error) {
        if (this.receipt?.id === receipt.id) this.setStatus(this.reason(error));
      }
    }

    private async createLink(): Promise<void> {
      const receipt = this.receipt;
      if (!receipt) return;
      const amount = Number(this.elements.shareDurationAmount.value);
      if (!Number.isInteger(amount) || amount < 1) {
        this.setStatus("Enter how long the link should last, as a whole number.");
        return;
      }

      const button = this.elements.shareCreateButton;
      setBusy(button, true);
      this.setStatus("");
      try {
        const minutes = amount * MINUTES_PER_UNIT[this.elements.shareDurationUnit.value];
        const link = await this.receiptApiService.createShare(receipt.id, minutes, this.elements.shareCanEdit.checked);
        if (this.receipt?.id !== receipt.id) return;
        this.elements.shareLinkInput.value = `${window.location.origin}${link.path}`;
        this.elements.shareCopyButton.textContent = "Copy";
        this.elements.shareResult.classList.remove("hidden");
        this.elements.shareLinkInput.select();
        await this.loadActive(receipt);
      } catch (error) {
        this.setStatus(this.reason(error));
      } finally {
        setBusy(button, false);
      }
    }

    private async copyLink(): Promise<void> {
      const input = this.elements.shareLinkInput;
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        this.elements.shareCopyButton.textContent = "Copied";
      } catch {
        // No clipboard (an insecure origin, or permission refused). The link is
        // selected, so a keyboard copy still works.
        this.setStatus("Couldn't copy automatically. The link is selected, so copy it from there.");
      }
    }

    private renderActive(shares: readonly Services.ReceiptShare[]): void {
      this.elements.shareActive.classList.toggle("hidden", shares.length === 0);
      this.elements.shareActiveList.replaceChildren(...shares.map((share) => this.renderShare(share)));
    }

    private renderShare(share: Services.ReceiptShare): HTMLElement {
      const row = document.createElement("div");
      row.className = "share-active-row";

      const when = document.createElement("span");
      when.className = "share-active-when";
      when.textContent = `Expires ${new Date(share.expiresAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      })}`;

      const toggle = document.createElement("label");
      toggle.className = "share-switch";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("role", "switch");
      box.checked = share.canEdit;
      box.addEventListener("change", () => void this.setEditing(share, box));
      const text = document.createElement("span");
      text.textContent = "Can edit";
      toggle.append(box, text);

      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "btn btn-danger btn-small";
      stop.textContent = "Stop sharing";
      stop.addEventListener("click", () => void this.stopSharing(share));

      row.append(when, toggle, stop);
      return row;
    }

    private async setEditing(share: Services.ReceiptShare, box: HTMLInputElement): Promise<void> {
      const receipt = this.receipt;
      if (!receipt) return;
      const wanted = box.checked;
      box.disabled = true;
      this.setStatus("");
      try {
        await this.receiptApiService.setShareEditing(receipt.id, share.id, wanted);
      } catch (error) {
        // Show what is actually in force, not what was asked for.
        box.checked = !wanted;
        this.setStatus(this.reason(error));
      } finally {
        box.disabled = false;
      }
    }

    private async stopSharing(share: Services.ReceiptShare): Promise<void> {
      const receipt = this.receipt;
      if (!receipt) return;
      this.setStatus("");
      try {
        await this.receiptApiService.removeShare(receipt.id, share.id);
        await this.loadActive(receipt);
      } catch (error) {
        this.setStatus(this.reason(error));
      }
    }

    private reason(error: unknown): string {
      return error instanceof Error ? error.message : "Something went wrong.";
    }

    private bindEvents(): void {
      this.elements.shareCreateButton.addEventListener("click", () => void this.createLink());
      this.elements.shareCopyButton.addEventListener("click", () => void this.copyLink());
      this.elements.shareCloseButton.addEventListener("click", () => this.close());
      this.elements.shareModal.addEventListener("click", (event) => {
        if (event.target === this.elements.shareModal) this.close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.receipt) this.close();
      });
    }
  }
}
