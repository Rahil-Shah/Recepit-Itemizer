namespace ReceiptRing.Services {
  export interface OcrProgress {
    label: string;
    progress: number;
  }

  interface OcrImageVariant {
    name: string;
    canvas: HTMLCanvasElement;
  }

  interface OcrPass {
    name: string;
    image: HTMLCanvasElement;
    pageSegmentationMode: string;
  }

  interface OcrCandidate {
    name: string;
    text: string;
    confidence: number;
    itemLineCount: number;
    score: number;
  }

  interface CropBox {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  }

  export class ReceiptOcrService {
    private readonly receiptPricePattern = /\s(?:\$?\s*)?\d{1,4}(?:[,.]\d{2})\s*$/;
    private workerPromise: Promise<Integrations.TesseractWorker> | null = null;

    async recognize(file: File, onProgress: (progress: OcrProgress) => void): Promise<string> {
      if (typeof Tesseract === "undefined") {
        throw new Error("OCR engine did not load. Refresh the page and try again.");
      }

      const tesseract = Tesseract;
      onProgress({ label: "Preparing receipt image", progress: 0.05 });

      const variants = await this.createReceiptImageVariants(file);
      const worker = await this.getWorker(tesseract, onProgress);
      const passes = this.createOcrPasses(variants);
      const candidates: OcrCandidate[] = [];

      for (let index = 0; index < passes.length; index += 1) {
        const pass = passes[index];
        const baseProgress = 0.18 + (index / passes.length) * 0.72;

        onProgress({ label: `Reading ${pass.name}`, progress: baseProgress });
        await worker.setParameters({
          tessedit_pageseg_mode: pass.pageSegmentationMode,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300"
        });

        const result = await worker.recognize(pass.image, {}, { text: true, blocks: true });
        const text = this.cleanExtractedText(this.getStructuredText(result.data));
        candidates.push(this.scoreCandidate(pass.name, text, result.data.confidence));
      }

      const bestCandidate = candidates.sort((left, right) => right.score - left.score)[0];
      if (!bestCandidate || bestCandidate.text.length < 8) {
        throw new Error("I could not read enough text from this receipt. Try a flatter, brighter photo.");
      }

      onProgress({
        label: `Best read found ${bestCandidate.itemLineCount} likely item lines`,
        progress: 1
      });

      return bestCandidate.text;
    }

    private async getWorker(
      tesseract: Integrations.TesseractGlobal,
      onProgress: (progress: OcrProgress) => void
    ): Promise<Integrations.TesseractWorker> {
      if (!this.workerPromise) {
        const workerPath = new URL("vendor/tesseract/worker.min.js", window.location.href).href;
        const corePath = new URL("vendor/tesseract-core", window.location.href).href;
        const langPath = new URL("vendor/tessdata", window.location.href).href;

        this.workerPromise = tesseract.createWorker("eng", 1, {
          workerPath,
          corePath,
          langPath,
          logger: (message) => {
            onProgress({
              label: this.humanizeStatus(message.status),
              progress: Math.min(0.95, Math.max(0.08, message.progress * 0.18))
            });
          }
        });
      }

      return this.workerPromise;
    }

    private async createReceiptImageVariants(file: File): Promise<OcrImageVariant[]> {
      const image = await this.loadImage(file);
      const baseCanvas = this.createBaseCanvas(image);

      return [
        {
          name: "adaptive receipt",
          canvas: this.createAdaptiveThresholdCanvas(baseCanvas)
        },
        {
          name: "balanced receipt",
          canvas: this.createContrastCanvas(baseCanvas, 1.42, 112)
        },
        {
          name: "sharp receipt",
          canvas: this.createBinaryCanvas(baseCanvas)
        }
      ];
    }

    private createBaseCanvas(image: HTMLImageElement): HTMLCanvasElement {
      const crop = this.detectReceiptCrop(image);
      const targetWidth = Math.min(Math.max(crop.sw, 1500), 1900);
      const scale = targetWidth / crop.sw;
      const targetHeight = Math.round(crop.sh * scale);
      const canvas = document.createElement("canvas");
      const context = this.getContext(canvas);

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetWidth, targetHeight);

      return canvas;
    }

    private detectReceiptCrop(image: HTMLImageElement): CropBox {
      const probeWidth = 640;
      const scale = probeWidth / image.naturalWidth;
      const probeHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const probe = document.createElement("canvas");
      const context = this.getContext(probe);

      probe.width = probeWidth;
      probe.height = probeHeight;
      context.drawImage(image, 0, 0, probeWidth, probeHeight);

      const pixels = context.getImageData(0, 0, probeWidth, probeHeight).data;
      let minX = probeWidth;
      let minY = probeHeight;
      let maxX = 0;
      let maxY = 0;
      let matchedPixels = 0;

      for (let y = 0; y < probeHeight; y += 1) {
        for (let x = 0; x < probeWidth; x += 1) {
          const index = (y * probeWidth + x) * 4;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
          const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);

          if (luminance > 142 && saturation < 72) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            matchedPixels += 1;
          }
        }
      }

      const matchedRatio = matchedPixels / (probeWidth * probeHeight);
      if (matchedRatio < 0.08 || matchedRatio > 0.92 || maxX <= minX || maxY <= minY) {
        return { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
      }

      const margin = 18;
      const sx = Math.max(0, Math.round((minX - margin) / scale));
      const sy = Math.max(0, Math.round((minY - margin) / scale));
      const ex = Math.min(image.naturalWidth, Math.round((maxX + margin) / scale));
      const ey = Math.min(image.naturalHeight, Math.round((maxY + margin) / scale));

      return {
        sx,
        sy,
        sw: Math.max(1, ex - sx),
        sh: Math.max(1, ey - sy)
      };
    }

    private createContrastCanvas(source: HTMLCanvasElement, contrast: number, midpoint: number): HTMLCanvasElement {
      const canvas = this.cloneCanvas(source);
      const context = this.getContext(canvas);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;

      for (let index = 0; index < data.length; index += 4) {
        const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const contrasted = this.clamp((gray - midpoint) * contrast + 142);
        data[index] = contrasted;
        data[index + 1] = contrasted;
        data[index + 2] = contrasted;
      }

      context.putImageData(pixels, 0, 0);
      return canvas;
    }

    private createBinaryCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
      const canvas = this.createContrastCanvas(source, 1.62, 118);
      const context = this.getContext(canvas);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      const threshold = this.getOtsuThreshold(data);

      for (let index = 0; index < data.length; index += 4) {
        const value = data[index] > threshold ? 255 : 0;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
      }

      context.putImageData(pixels, 0, 0);
      return canvas;
    }

    private createAdaptiveThresholdCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
      const canvas = this.cloneCanvas(source);
      const context = this.getContext(canvas);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const gray = new Uint8ClampedArray(width * height);
      const integral = new Uint32Array((width + 1) * (height + 1));

      for (let y = 0; y < height; y += 1) {
        let rowSum = 0;
        for (let x = 0; x < width; x += 1) {
          const pixelIndex = y * width + x;
          const dataIndex = pixelIndex * 4;
          const value = Math.round(
            pixels.data[dataIndex] * 0.299 + pixels.data[dataIndex + 1] * 0.587 + pixels.data[dataIndex + 2] * 0.114
          );
          gray[pixelIndex] = value;
          rowSum += value;
          integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
        }
      }

      const radius = Math.max(18, Math.round(width / 70));
      for (let y = 0; y < height; y += 1) {
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);

        for (let x = 0; x < width; x += 1) {
          const x0 = Math.max(0, x - radius);
          const x1 = Math.min(width - 1, x + radius);
          const area = (x1 - x0 + 1) * (y1 - y0 + 1);
          const sum =
            integral[(y1 + 1) * (width + 1) + x1 + 1] -
            integral[y0 * (width + 1) + x1 + 1] -
            integral[(y1 + 1) * (width + 1) + x0] +
            integral[y0 * (width + 1) + x0];
          const localMean = sum / area;
          const value = gray[y * width + x] < localMean - 10 ? 0 : 255;
          const dataIndex = (y * width + x) * 4;

          pixels.data[dataIndex] = value;
          pixels.data[dataIndex + 1] = value;
          pixels.data[dataIndex + 2] = value;
        }
      }

      context.putImageData(pixels, 0, 0);
      return canvas;
    }

    private createOcrPasses(variants: readonly OcrImageVariant[]): OcrPass[] {
      const adaptive = variants.find((variant) => variant.name === "adaptive receipt") ?? variants[0];
      const balanced = variants.find((variant) => variant.name === "balanced receipt") ?? variants[0];
      const sharp = variants.find((variant) => variant.name === "sharp receipt") ?? variants[0];

      return [
        { name: "adaptive receipt", image: adaptive.canvas, pageSegmentationMode: "4" },
        { name: "balanced receipt", image: balanced.canvas, pageSegmentationMode: "6" },
        { name: "sparse price scan", image: sharp.canvas, pageSegmentationMode: "11" },
        { name: "full receipt fallback", image: balanced.canvas, pageSegmentationMode: "3" }
      ];
    }

    private getStructuredText(data: Integrations.TesseractRecognitionResult["data"]): string {
      const lines =
        data.blocks
          ?.flatMap((block) => block.paragraphs)
          .flatMap((paragraph) => paragraph.lines)
          .filter((line) => line.text.trim().length > 0)
          .sort((left, right) => {
            const rowDistance = left.bbox.y0 - right.bbox.y0;
            return Math.abs(rowDistance) > 12 ? rowDistance : left.bbox.x0 - right.bbox.x0;
          })
          .map((line) => line.text) ?? [];

      return lines.length > 0 ? lines.join("\n") : data.text;
    }

    private scoreCandidate(name: string, text: string, confidence: number): OcrCandidate {
      const lines = text.split("\n").filter(Boolean);
      const itemLineCount = lines.filter((line) => this.receiptPricePattern.test(line)).length;
      const amountDensity = itemLineCount / Math.max(1, lines.length);
      const score = confidence + itemLineCount * 28 + amountDensity * 26 + Math.min(text.length / 28, 24);

      return {
        name,
        text,
        confidence,
        itemLineCount,
        score
      };
    }

    private cleanExtractedText(text: string): string {
      return text
        .split("\n")
        .map((line) => this.repairReceiptLine(line))
        .filter((line) => line.length > 0)
        .join("\n");
    }

    private repairReceiptLine(line: string): string {
      const normalizedLine = line
        .replace(/[|{}[\]_=~`]/g, " ")
        .replace(/[^\w\s$.,:;#@*%&+-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const amountMatch = normalizedLine.match(/(.+?\s)([$S]?\s*[0-9OoQDSIl|B]{1,4}(?:[.,:;][0-9OoQDSIl|B]{2})?)$/);
      if (!amountMatch) return normalizedLine;

      const rawAmount = amountMatch[2];
      let repairedAmount = rawAmount
        .replace(/[OoQ]/g, "0")
        .replace(/[Il|]/g, "1")
        .replace(/S/g, "5")
        .replace(/B/g, "8")
        .replace(/[:;]/g, ".")
        .replace(/\s+/g, "");

      if (!/[.,]/.test(rawAmount) && /[OoQDSIl|B]/.test(rawAmount)) {
        const sign = repairedAmount.startsWith("$") ? "$" : "";
        const digits = repairedAmount.replace("$", "");
        if (/^\d{3,5}$/.test(digits)) {
          repairedAmount = `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
        }
      }

      return `${amountMatch[1].trim()} ${repairedAmount}`;
    }

    private getOtsuThreshold(data: Uint8ClampedArray): number {
      const histogram = new Uint32Array(256);
      const pixelCount = data.length / 4;

      for (let index = 0; index < data.length; index += 4) {
        histogram[data[index]] += 1;
      }

      let sum = 0;
      for (let value = 0; value < 256; value += 1) {
        sum += value * histogram[value];
      }

      let sumBackground = 0;
      let weightBackground = 0;
      let maxVariance = 0;
      let threshold = 128;

      for (let value = 0; value < 256; value += 1) {
        weightBackground += histogram[value];
        if (weightBackground === 0) continue;

        const weightForeground = pixelCount - weightBackground;
        if (weightForeground === 0) break;

        sumBackground += value * histogram[value];
        const meanBackground = sumBackground / weightBackground;
        const meanForeground = (sum - sumBackground) / weightForeground;
        const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = value;
        }
      }

      return threshold;
    }

    private cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
      const canvas = document.createElement("canvas");
      const context = this.getContext(canvas);

      canvas.width = source.width;
      canvas.height = source.height;
      context.drawImage(source, 0, 0);

      return canvas;
    }

    private getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Could not prepare receipt image for OCR.");
      }

      return context;
    }

    private clamp(value: number): number {
      return Math.max(0, Math.min(255, value));
    }

    private loadImage(file: File): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Could not load the receipt image."));
        };

        image.src = objectUrl;
      });
    }

    private humanizeStatus(status: string): string {
      const words = status.replace(/_/g, " ").trim();
      return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Reading receipt";
    }
  }
}
