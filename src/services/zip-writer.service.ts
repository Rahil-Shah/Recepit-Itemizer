namespace ReceiptRing.Services {
  // CRC-32 (IEEE), the checksum every ZIP entry carries. Built once.
  const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  interface ZipEntry {
    name: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
    time: number;
    date: number;
  }

  /**
   * A minimal ZIP archive writer: stored (uncompressed) entries, UTF-8 names.
   *
   * Built in the browser so a full export never has to pass through a
   * serverless response, which is capped at a few megabytes -- one year of
   * receipt photos is well past that. Photos are JPEG/PNG/WebP already, so
   * compressing them again would cost time and save almost nothing; the CSVs
   * are small. Every unzip tool reads stored entries.
   */
  export class ZipWriter {
    private readonly entries: ZipEntry[] = [];
    private readonly chunks: Uint8Array[] = [];
    private offset = 0;
    private readonly encoder = new TextEncoder();

    constructor(private readonly when: Date = new Date()) {}

    get size(): number {
      return this.entries.length;
    }

    addText(path: string, text: string): void {
      this.add(path, this.encoder.encode(text));
    }

    add(path: string, data: Uint8Array): void {
      const name = this.encoder.encode(path);
      const entry: ZipEntry = {
        name,
        data,
        crc: crc32(data),
        offset: this.offset,
        time: this.dosTime(),
        date: this.dosDate()
      };

      const header = new DataView(new ArrayBuffer(30));
      header.setUint32(0, 0x04034b50, true); // local file header signature
      header.setUint16(4, 20, true); // version needed to extract
      header.setUint16(6, 0x0800, true); // flags: UTF-8 file name
      header.setUint16(8, 0, true); // method: stored
      header.setUint16(10, entry.time, true);
      header.setUint16(12, entry.date, true);
      header.setUint32(14, entry.crc, true);
      header.setUint32(18, data.length, true); // compressed size
      header.setUint32(22, data.length, true); // uncompressed size
      header.setUint16(26, name.length, true);
      header.setUint16(28, 0, true); // extra field length

      this.push(new Uint8Array(header.buffer), name, data);
      this.entries.push(entry);
    }

    /** The finished archive. */
    toBytes(): Uint8Array<ArrayBuffer> {
      const centralStart = this.offset;
      const central: Uint8Array[] = [];
      let centralSize = 0;

      for (const entry of this.entries) {
        const record = new DataView(new ArrayBuffer(46));
        record.setUint32(0, 0x02014b50, true); // central directory signature
        record.setUint16(4, 20, true); // version made by
        record.setUint16(6, 20, true); // version needed
        record.setUint16(8, 0x0800, true);
        record.setUint16(10, 0, true);
        record.setUint16(12, entry.time, true);
        record.setUint16(14, entry.date, true);
        record.setUint32(16, entry.crc, true);
        record.setUint32(20, entry.data.length, true);
        record.setUint32(24, entry.data.length, true);
        record.setUint16(28, entry.name.length, true);
        record.setUint16(30, 0, true); // extra
        record.setUint16(32, 0, true); // comment
        record.setUint16(34, 0, true); // disk number
        record.setUint16(36, 0, true); // internal attributes
        record.setUint32(38, 0, true); // external attributes
        record.setUint32(42, entry.offset, true);
        const bytes = new Uint8Array(record.buffer);
        central.push(bytes, entry.name);
        centralSize += bytes.length + entry.name.length;
      }

      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); // end of central directory
      end.setUint16(4, 0, true);
      end.setUint16(6, 0, true);
      end.setUint16(8, this.entries.length, true);
      end.setUint16(10, this.entries.length, true);
      end.setUint32(12, centralSize, true);
      end.setUint32(16, centralStart, true);
      end.setUint16(20, 0, true);

      const parts = [...this.chunks, ...central, new Uint8Array(end.buffer)];
      const total = parts.reduce((sum, part) => sum + part.length, 0);
      const out = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      return out;
    }

    private push(...parts: Uint8Array[]): void {
      for (const part of parts) {
        this.chunks.push(part);
        this.offset += part.length;
      }
    }

    private dosTime(): number {
      return (this.when.getHours() << 11) | (this.when.getMinutes() << 5) | Math.floor(this.when.getSeconds() / 2);
    }

    private dosDate(): number {
      return ((Math.max(1980, this.when.getFullYear()) - 1980) << 9) | ((this.when.getMonth() + 1) << 5) | this.when.getDate();
    }
  }
}
