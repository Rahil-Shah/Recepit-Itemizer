namespace ReceiptRing.Services {
  export class PaddleOcrProvider implements OcrProvider {
    readonly name = "PaddleOCR";

    async recognize(_file: File, _onProgress: (progress: OcrProgress) => void): Promise<Domain.OcrDocument> {
      throw new Error(
        "PaddleOCR provider is installed but not active in the static bundle. Move the app to an ESM bundler to enable @paddleocr/paddleocr-js as the primary OCR engine."
      );
    }
  }
}
