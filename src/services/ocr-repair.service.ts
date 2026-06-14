namespace ReceiptRing.Services {
  export interface OcrRepairService {
    repair(document: Domain.OcrDocument): Promise<Domain.OcrDocument>;
  }

  export class NoopOcrRepairService implements OcrRepairService {
    async repair(document: Domain.OcrDocument): Promise<Domain.OcrDocument> {
      return document;
    }
  }
}
