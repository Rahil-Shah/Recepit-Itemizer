namespace ReceiptRing.UI {
  export class DiagnosticsView {
    render(
      grid: HTMLElement,
      textOutput: HTMLElement,
      summary: HTMLElement,
      document: Domain.OcrDocument | null,
      metadata: Domain.ReceiptMetadata | null,
      items: readonly Domain.PurchaseItem[]
    ): void {
      grid.innerHTML = "";
      textOutput.textContent = "";

      if (!document) {
        summary.textContent = "No OCR run";
        return;
      }

      summary.textContent = `${Math.round(document.confidence)}% confidence / ${items.length} items`;
      document.artifacts.forEach((artifact) => grid.append(this.createArtifactCard(artifact)));
      grid.append(this.createTextCard("Image quality", document.quality.warnings.join("\n") || "No warnings"));
      grid.append(this.createTextCard("Metadata", JSON.stringify(metadata, null, 2)));
      grid.append(this.createTextCard("Parsed items", JSON.stringify(items, null, 2)));
      textOutput.textContent = document.text;
    }

    private createArtifactCard(artifact: Domain.OcrImageArtifact): HTMLElement {
      const card = document.createElement("article");
      card.className = "diagnostics-card";

      const title = document.createElement("strong");
      title.textContent = artifact.label;

      const image = document.createElement("img");
      image.src = artifact.dataUrl;
      image.alt = artifact.label;

      card.append(title, image);
      return card;
    }

    private createTextCard(titleText: string, contentText: string): HTMLElement {
      const card = document.createElement("article");
      card.className = "diagnostics-card";

      const title = document.createElement("strong");
      title.textContent = titleText;

      const content = document.createElement("pre");
      content.textContent = contentText;

      card.append(title, content);
      return card;
    }
  }
}
