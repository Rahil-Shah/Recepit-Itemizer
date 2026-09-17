namespace ReceiptRing.Services {
  // Phone photos arrive at several megapixels — far more than the history view
  // ever shows, and more than the save endpoint will accept. Every receipt
  // image is re-encoded down to a bounded JPEG before it is carried around as
  // a data URL, so a saved receipt costs a few hundred kilobytes, not several
  // megabytes.
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.82;

  // What the parser gets. Larger than the stored copy, because the model has
  // to read the small print, but still bounded: the parse route sits behind a
  // request-size cap (4.5 MB on Vercel, and the server's own 8 MB of base64),
  // and a phone's original is routinely past both. At this size a receipt is
  // a few hundred kilobytes to a megabyte of JPEG.
  const MAX_PARSE_DIMENSION = 2400;
  const PARSE_JPEG_QUALITY = 0.85;

  /** An image ready to upload as JSON: base64 without the data: prefix. */
  export interface UploadImage {
    base64: string;
    mimeType: string;
  }

  export class ReceiptImageService {
    // Returns null when the image can't be decoded: a photo we can't process
    // must not stop the receipt itself from being saved.
    async toStorableDataUrl(file: File): Promise<string | null> {
      return this.reencode(file, MAX_DIMENSION, JPEG_QUALITY);
    }

    // The photo as the parse route wants it. Falls back to the file as it is
    // when the browser cannot decode it (HEIC outside Safari, say): the model
    // may still read it, and the server says so if it is too large.
    async toParseImage(file: File): Promise<UploadImage> {
      const dataUrl = await this.reencode(file, MAX_PARSE_DIMENSION, PARSE_JPEG_QUALITY);
      if (dataUrl) {
        return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
      }
      return { base64: await this.toBase64(file), mimeType: file.type };
    }

    private async reencode(file: File, maxDimension: number, quality: number): Promise<string | null> {
      try {
        const source = await this.decode(file);
        const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));

        const context = canvas.getContext("2d");
        if (!context) return null;
        context.drawImage(source, 0, 0, canvas.width, canvas.height);

        if ("close" in source) {
          source.close();
        }
        return canvas.toDataURL("image/jpeg", quality);
      } catch (error) {
        console.error("Could not prepare the receipt image:", error);
        return null;
      }
    }

    private toBase64(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          resolve(result.slice(result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
    }

    // createImageBitmap applies the EXIF orientation, so a photo taken sideways
    // is stored the way it was shot. Older browsers without it fall back to an
    // <img>, which at worst keeps the camera's own orientation.
    private async decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
      if (typeof createImageBitmap === "function") {
        return createImageBitmap(file, { imageOrientation: "from-image" });
      }

      const url = URL.createObjectURL(file);
      try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Could not decode the image."));
          image.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }
}
