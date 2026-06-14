# Receipt OCR Architecture

## Current Runtime

The static browser app currently uses a provider-agnostic OCR document model:

- `OcrWord`
- `OcrLine`
- `OcrDocument`

The active OCR provider is a multi-pass Tesseract-based local provider. It returns word coordinates, line coordinates, confidence scores, image quality warnings, and diagnostic artifacts. The UI renders this as an editable OCR overlay before spatial parsing.

## PaddleOCR Migration

PaddleOCR is technically feasible in the browser through the official `@paddleocr/paddleocr-js` package. It returns recognized line items with polygons, text, scores, image dimensions, metrics, and runtime metadata.

The current repo includes a `PaddleOcrProvider` placeholder. Activating it requires moving the app from a `module: none` static bundle to an ESM bundler runtime so the package can load module workers, ONNX Runtime, OpenCV, and model archives reliably.

Recommended next build step:

1. Move the app to Vite.
2. Replace `ReceiptOcrService` construction with an `OcrProvider` factory.
3. Map PaddleOCR `items[].poly`, `items[].text`, and `items[].score` to `OcrLine` and `OcrWord`.
4. Keep Tesseract as fallback for offline or unsupported browsers.

## AI Extension Points

AI OCR repair and item-level AI categorization are no longer part of the primary product direction. The OCR pipeline still has a no-op OCR repair interface for future use:

`OCR -> OcrRepairService -> Spatial Parser`

Future prompt:

```text
You are repairing OCR text extracted from a receipt. Correct obvious OCR errors while preserving item order and prices. Do not invent products. Return only corrected receipt text.
```

Item categorization has a no-op AI interface, but the active workflow now applies category at the whole-receipt level:

`Receipt -> ReceiptCategory`

User category rules remain the durable learning layer.

## Persistence

`prisma/schema.prisma` defines PostgreSQL tables for the receipt splitting workflow:

- `users`
- `receipts`
- `receipt_lines`
- `people`
- `line_assignments`

The static UI still uses local browser storage until a backend API is added. The Prisma schema is ready for that backend migration.
