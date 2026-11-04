import zlib from "zlib";
import { generateSingleCertificatePdf } from "./pdfService.js";

// CRC32 Table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Creates a valid, standard ZIP archive buffer from a list of files in memory.
 */
export function createZipBuffer(fileList) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const f of fileList) {
        const nameBuf = Buffer.from(f.name, "utf8");
        const crc = crc32(f.data);
        const uncompressedSize = f.data.length;
        const compressed = zlib.deflateRawSync(f.data);
        const compressedSize = compressed.length;

        const local = Buffer.alloc(30 + nameBuf.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressedSize, 18);
        local.writeUInt32LE(uncompressedSize, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        nameBuf.copy(local, 30);

        localHeaders.push(local, compressed);

        const central = Buffer.alloc(46 + nameBuf.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressedSize, 20);
        central.writeUInt32LE(uncompressedSize, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        nameBuf.copy(central, 46);

        centralHeaders.push(central);
        offset += local.length + compressed.length;
    }

    const centralDirBuffer = Buffer.concat(centralHeaders);
    const centralDirSize = centralDirBuffer.length;
    const centralDirOffset = offset;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(fileList.length, 8);
    eocd.writeUInt16LE(fileList.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(centralDirOffset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

/**
 * Streams individual PDF certificates into a ZIP archive directly to a WritableStream (e.g. Express res)
 * Naming pattern: <Nama Peserta>_Aksara Vol.7.pdf
 * Uses STORE method (0) so streaming is near instantaneous and RAM remains < 5MB!
 */
export async function streamCertificatesPdfZip({
    outStream,
    participants,
    jpegBuffer,
    eventName = "Aksara Vol.7",
    bulanRomawi = "X",
    tahun = 2026
}) {
    const centralHeaders = [];
    let offset = 0;

    for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const noUrut = String(p.no || (i + 1)).padStart(3, "0");
        const nomor = `${noUrut}/AKSARA.07/KR5/${bulanRomawi}/${tahun}`;

        // File name: Nama Peserta_Aksara Vol.7.pdf
        const cleanName = (p.nama || `Peserta_${i + 1}`)
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .trim();
        const fileName = `${cleanName}_${eventName}.pdf`;
        const nameBuf = Buffer.from(fileName, "utf8");

        const pdfBuf = generateSingleCertificatePdf({
            jpegBuffer,
            nomor,
            nama: p.nama
        });

        const crc = crc32(pdfBuf);
        const size = pdfBuf.length;

        // Local Header (30 bytes + filename)
        const local = Buffer.alloc(30 + nameBuf.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
        local.writeUInt16LE(0, 8);      // Stored (0 compression, instant streaming)
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(size, 18);
        local.writeUInt32LE(size, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        nameBuf.copy(local, 30);

        outStream.write(local);
        outStream.write(pdfBuf);

        // Central Directory Header (46 bytes + filename)
        const central = Buffer.alloc(46 + nameBuf.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(size, 20);
        central.writeUInt32LE(size, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        nameBuf.copy(central, 46);

        centralHeaders.push(central);
        offset += local.length + size;

        // Small yield every 500 files to allow event loop breathing
        if (i > 0 && i % 500 === 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    const centralDirBuffer = Buffer.concat(centralHeaders);
    const centralDirSize = centralDirBuffer.length;
    const centralDirOffset = offset;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(participants.length, 8);
    eocd.writeUInt16LE(participants.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(centralDirOffset, 16);
    eocd.writeUInt16LE(0, 20);

    outStream.write(centralDirBuffer);
    outStream.write(eocd);
    outStream.end();
}
