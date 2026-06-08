namespace ReceiptRing.Integrations {
  export interface TesseractProgress {
    status: string;
    progress: number;
  }

  export interface TesseractRecognitionResult {
    data: {
      text: string;
      confidence: number;
      blocks: TesseractBlock[] | null;
    };
  }

  export interface TesseractWorker {
    recognize(
      image: CanvasImageSource | File | Blob,
      options?: Record<string, unknown>,
      output?: Partial<Record<"text" | "blocks" | "tsv", boolean>>
    ): Promise<TesseractRecognitionResult>;
    setParameters(parameters: Record<string, string>): Promise<void>;
  }

  export interface TesseractBlock {
    paragraphs: TesseractParagraph[];
    text: string;
    confidence: number;
    bbox: TesseractBoundingBox;
  }

  export interface TesseractParagraph {
    lines: TesseractLine[];
    text: string;
    confidence: number;
    bbox: TesseractBoundingBox;
  }

  export interface TesseractLine {
    text: string;
    confidence: number;
    bbox: TesseractBoundingBox;
  }

  export interface TesseractBoundingBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }

  export interface TesseractGlobal {
    createWorker(
      language: string,
      oem?: number,
      options?: {
        corePath?: string;
        workerPath?: string;
        langPath?: string;
        logger?: (message: TesseractProgress) => void;
      }
    ): Promise<TesseractWorker>;
    PSM?: {
      SINGLE_BLOCK?: string;
      SINGLE_BLOCK_VERT_TEXT?: string;
      SINGLE_COLUMN?: string;
      AUTO?: string;
      SPARSE_TEXT?: string;
    };
  }
}

declare const Tesseract: ReceiptRing.Integrations.TesseractGlobal | undefined;
