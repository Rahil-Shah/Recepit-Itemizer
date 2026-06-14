namespace ReceiptRing.Services {
  export interface OcrProvider {
    readonly name: string;
    recognize(file: File, onProgress: (progress: OcrProgress) => void): Promise<Domain.OcrDocument>;
  }
}
