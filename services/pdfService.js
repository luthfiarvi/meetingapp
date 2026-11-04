import fs from "fs";

// Standard Adobe Type 1 Helvetica-Bold character widths (per 1000 units)
const HELVETICA_BOLD_WIDTHS = {
    32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 278,
    40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
    56: 556, 57: 556, 58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611,
    64: 975, 65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
    72: 722, 73: 278, 74: 556, 75: 722, 76: 611, 77: 833, 78: 722, 79: 778,
    80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
    88: 667, 89: 667, 90: 611, 91: 333, 92: 278, 93: 333, 94: 584, 95: 500,
    96: 333, 97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611,
    104: 611, 105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611, 111: 611,
    112: 611, 113: 611, 114: 389, 115: 556, 116: 333, 117: 611, 118: 556, 119: 778,
    120: 556, 121: 556, 122: 500, 123: 389, 124: 280, 125: 389, 126: 584
};

function getHelveticaBoldWidth(text, fontSize) {
    if (!text) return 0;
    const str = String(text);
    let units = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        const u = HELVETICA_BOLD_WIDTHS[code];
        if (u !== undefined) {
            units += u;
        } else if (code >= 192 && code <= 221) {
            units += 722; // Uppercase accented Latin
        } else if (code >= 224 && code <= 255) {
            units += 556; // Lowercase accented Latin
        } else {
            units += 600; // Fallback
        }
    }
    return (units * fontSize) / 1000;
}

function sanitizeText(str) {
    if (!str) return "";
    return String(str)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

function escapePdf(str) {
    return (str || "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

/**
 * Generates a single multi-page PDF containing all participants (1 page per participant).
 * The background JPEG is embedded ONCE and shared across all pages.
 * Total size for 4,158 pages is only ~2 MB!
 */
export function generateCombinedCertificatesPdf({ jpegBuffer, participants, formatNomor, bulanRomawi, tahun, meetingTitle }) {
    const pageWidth = 841.89;
    const pageHeight = 595.28;

    let imgWidth = 1491;
    let imgHeight = 1055;
    let offset = 2;
    while (offset < jpegBuffer.length) {
        if (jpegBuffer[offset] !== 0xFF) break;
        const marker = jpegBuffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
            imgHeight = jpegBuffer.readUInt16BE(offset + 5);
            imgWidth = jpegBuffer.readUInt16BE(offset + 7);
            break;
        }
        offset += 2 + jpegBuffer.readUInt16BE(offset + 2);
    }

    const yNomor = (pageHeight * (1 - 0.328)).toFixed(2);
    const yNama = (pageHeight * (1 - 0.438)).toFixed(2);
    const nomorFontSize = 13;
    const namaFontSize = 24;

    const count = participants.length;

    // Object numbering scheme:
    // 1: Catalog
    // 2: Pages
    // 3: Font (Helvetica-Bold)
    // 4: XObject Image (/Im1)
    // For each participant i (0 to count - 1):
    //   Page object: 5 + i * 2
    //   Content stream: 6 + i * 2
    const totalObjects = 4 + count * 2;

    const chunks = [];
    const xrefOffsets = new Array(totalObjects + 1).fill(0);
    let runningPos = 0;

    const append = (strOrBuf) => {
        const buf = Buffer.isBuffer(strOrBuf) ? strOrBuf : Buffer.from(strOrBuf, "utf8");
        chunks.push(buf);
        runningPos += buf.length;
    };

    // Header
    append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    // 1 0 obj: Catalog
    xrefOffsets[1] = runningPos;
    append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    // 2 0 obj: Pages
    xrefOffsets[2] = runningPos;
    const kids = [];
    for (let i = 0; i < count; i++) {
        kids.push(`${5 + i * 2} 0 R`);
    }
    append(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${count} >>\nendobj\n`);

    // 3 0 obj: Font
    xrefOffsets[3] = runningPos;
    append("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

    // 4 0 obj: Image
    xrefOffsets[4] = runningPos;
    append(`4 0 obj
<< /Type /XObject
   /Subtype /Image
   /Width ${imgWidth}
   /Height ${imgHeight}
   /ColorSpace /DeviceRGB
   /BitsPerComponent 8
   /Filter /DCTDecode
   /Length ${jpegBuffer.length}
>>
stream\n`);
    append(jpegBuffer);
    append("\nendstream\nendobj\n");

    // Pages and content streams
    for (let i = 0; i < count; i++) {
        const p = participants[i];
        const pageObjId = 5 + i * 2;
        const streamObjId = 6 + i * 2;

        const noUrut = String(p.no || (i + 1)).padStart(3, "0");
        const rawNomor = `${noUrut}/AKSARA.07/KR5/${bulanRomawi}/${tahun}`;
        const rawNama = p.nama || "Peserta";

        const cleanNomor = sanitizeText(rawNomor);
        const cleanNama = sanitizeText(rawNama);

        const nomorWidth = getHelveticaBoldWidth(cleanNomor, nomorFontSize);
        const namaWidth = getHelveticaBoldWidth(cleanNama, namaFontSize);

        // Center point aligned with template's visual anchor ('DIBERIKAN KEPADA :' & gold line at 50.65%)
        const centerX = pageWidth * 0.5065;
        const xNomor = Math.max(10, (centerX - (nomorWidth / 2))).toFixed(2);
        const xNama = Math.max(10, (centerX - (namaWidth / 2))).toFixed(2);

        const safeNomor = escapePdf(cleanNomor);
        const safeNama = escapePdf(cleanNama);

        const streamContent = `q
${pageWidth} 0 0 ${pageHeight} 0 0 cm
/Im1 Do
Q
BT
/F1 ${nomorFontSize} Tf
0.1 0.1 0.1 rg
${xNomor} ${yNomor} Td
(${safeNomor}) Tj
ET
BT
/F1 ${namaFontSize} Tf
0.07 0.07 0.07 rg
${xNama} ${yNama} Td
(${safeNama}) Tj
ET`;

        const streamLen = Buffer.byteLength(streamContent, "utf8");

        // Page obj
        xrefOffsets[pageObjId] = runningPos;
        append(`${pageObjId} 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 ${pageWidth} ${pageHeight}]
   /Contents ${streamObjId} 0 R
   /Resources <<
     /Font << /F1 3 0 R >>
     /XObject << /Im1 4 0 R >>
   >>
>>
endobj\n`);

        // Stream obj
        xrefOffsets[streamObjId] = runningPos;
        append(`${streamObjId} 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}
endstream
endobj\n`);
    }

    // XRef
    const xrefOffset = runningPos;
    let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= totalObjects; i++) {
        xref += String(xrefOffsets[i]).padStart(10, "0") + " 00000 n \n";
    }
    const trailer = `trailer
<< /Size ${totalObjects + 1}
   /Root 1 0 R
>>
startxref
${xrefOffset}
%%EOF\n`;
    append(xref + trailer);

    return Buffer.concat(chunks);
}

export function generateSingleCertificatePdf({ jpegBuffer, nomor, nama }) {
    const pageWidth = 841.89;
    const pageHeight = 595.28;

    let imgWidth = 1491;
    let imgHeight = 1055;
    let offset = 2;
    while (offset < jpegBuffer.length) {
        if (jpegBuffer[offset] !== 0xFF) break;
        const marker = jpegBuffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
            imgHeight = jpegBuffer.readUInt16BE(offset + 5);
            imgWidth = jpegBuffer.readUInt16BE(offset + 7);
            break;
        }
        offset += 2 + jpegBuffer.readUInt16BE(offset + 2);
    }

    const cleanNomor = sanitizeText(nomor);
    const cleanNama = sanitizeText(nama || "Peserta");

    const nomorFontSize = 13;
    const namaFontSize = 24;

    const nomorWidth = getHelveticaBoldWidth(cleanNomor, nomorFontSize);
    const namaWidth = getHelveticaBoldWidth(cleanNama, namaFontSize);

    // Center point aligned with template's visual anchor ('DIBERIKAN KEPADA :' & gold line at 50.65%)
    const centerX = pageWidth * 0.5065;
    const xNomor = Math.max(10, (centerX - (nomorWidth / 2))).toFixed(2);
    const xNama = Math.max(10, (centerX - (namaWidth / 2))).toFixed(2);

    const safeNomor = escapePdf(cleanNomor);
    const safeNama = escapePdf(cleanNama);

    const yNomor = (pageHeight * (1 - 0.328)).toFixed(2);
    const yNama = (pageHeight * (1 - 0.438)).toFixed(2);

    const streamContent = `q
${pageWidth} 0 0 ${pageHeight} 0 0 cm
/Im1 Do
Q
BT
/F1 ${nomorFontSize} Tf
0.1 0.1 0.1 rg
${xNomor} ${yNomor} Td
(${safeNomor}) Tj
ET
BT
/F1 ${namaFontSize} Tf
0.07 0.07 0.07 rg
${xNama} ${yNama} Td
(${safeNama}) Tj
ET`;

    const streamLen = Buffer.byteLength(streamContent, "utf8");

    const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    const obj3 = `3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 ${pageWidth} ${pageHeight}]
   /Contents 4 0 R
   /Resources <<
     /Font << /F1 5 0 R >>
     /XObject << /Im1 6 0 R >>
   >>
>>
endobj\n`;
    const obj4 = `4 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}
endstream
endobj\n`;
    const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n";
    const obj6Header = `6 0 obj
<< /Type /XObject
   /Subtype /Image
   /Width ${imgWidth}
   /Height ${imgHeight}
   /ColorSpace /DeviceRGB
   /BitsPerComponent 8
   /Filter /DCTDecode
   /Length ${jpegBuffer.length}
>>
stream\n`;
    const obj6Footer = "\nendstream\nendobj\n";

    const parts = [
        Buffer.from(header, "utf8"),
        Buffer.from(obj1, "utf8"),
        Buffer.from(obj2, "utf8"),
        Buffer.from(obj3, "utf8"),
        Buffer.from(obj4, "utf8"),
        Buffer.from(obj5, "utf8"),
        Buffer.from(obj6Header, "utf8"),
        jpegBuffer,
        Buffer.from(obj6Footer, "utf8")
    ];

    const xrefOffsets = [0];
    let runningPos = Buffer.byteLength(header, "utf8");
    for (const t of [obj1, obj2, obj3, obj4, obj5]) {
        xrefOffsets.push(runningPos);
        runningPos += Buffer.byteLength(t, "utf8");
    }
    xrefOffsets.push(runningPos);
    runningPos += Buffer.byteLength(obj6Header, "utf8") + jpegBuffer.length + Buffer.byteLength(obj6Footer, "utf8");

    const xrefOffset = runningPos;
    let xref = `xref\n0 7\n0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) {
        xref += String(xrefOffsets[i]).padStart(10, "0") + " 00000 n \n";
    }
    const trailer = `trailer
<< /Size 7
   /Root 1 0 R
>>
startxref
${xrefOffset}
%%EOF\n`;

    parts.push(Buffer.from(xref + trailer, "utf8"));
    return Buffer.concat(parts);
}
