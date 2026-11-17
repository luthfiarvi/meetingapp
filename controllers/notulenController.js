import pool from "../config/database.js";
import aiService from "../services/aiService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType } from "docx";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCurrentUser(req) {
  const user = req.user || {};
  return {
    id: user.id || "admin",
    username: user.username || "admin",
    full_name: user.full_name || "Administrator BKN",
    nip: user.nip || "198501012010011001",
    institution: user.institution || "Kantor Regional V BKN Jakarta",
    division: user.division || "Pengelolaan Sistem Informasi Kepegawaian",
    mentor_name: user.mentor_name || "Pembimbing Kepegawaian",
    logo_path: user.logo_path || "/images/Logo_Badan_Kepegawaian_Negara.png",
    avatar_path: user.avatar_path || "/images/default_avatar.png",
    institution_kop: user.institution_kop || "BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V",
    kop_address: user.kop_address || "Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730",
    kop_contact: user.kop_contact || "Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id",
    sig_city: user.sig_city || "Jakarta",
    running_footer: user.running_footer || "Dokumen Resmi Kanreg V BKN",
    signature_path: user.signature_path || null,
    role: user.role || "admin"
  };
}

function safeParseJson(val, fallback = []) {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === "object") return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : (parsed || fallback);
  } catch (e) {
    return fallback;
  }
}

// Helper untuk membaca dan mem-parse dokumen notula dari file HTML fisik jika diperlukan
function parseNotulenHtml(html) {
  if (!html || typeof html !== "string") return null;

  const res = {
    title: "",
    meetingDate: "",
    formattedDate: "",
    meetingTime: "",
    meetingPlace: "",
    agenda: [],
    attendees: [],
    activities: [],
    actionItems: [],
    conclusions: [],
    closingText: "",
    notulisName: "",
    notulisRole: "",
    documentationPhotos: []
  };

  // Title
  const titleM = html.match(/<div class="notula-sub-title">\s*([\s\S]*?)\s*<\/div>/i);
  if (titleM) {
    res.title = titleM[1].replace(/^\(+/, '').replace(/\)+$/, '').trim();
  }

  // Date & Time
  const dateMetaM = html.match(/<div class="notula-meta-line">\s*([^<]*?),\s*Waktu:\s*([^<]*?)\s*<\/div>/i);
  if (dateMetaM) {
    res.formattedDate = dateMetaM[1].trim();
    res.meetingTime = dateMetaM[2].trim();
  }

  // Place
  const placeM = html.match(/<div class="notula-meta-line">\s*Tempat:\s*([^<]*?)\s*<\/div>/i);
  if (placeM) {
    res.meetingPlace = placeM[1].trim();
  }

  const stripTags = (s) => (s || "").replace(/<[^>]*>/g, "").trim();

  // Helper list extractor
  function extractList(headerRegex) {
    const sectionM = html.match(new RegExp(headerRegex + "[\\s\\S]*?<ul class=\"notula-list\">([\\s\\S]*?)<\\/ul>", "i"));
    if (!sectionM) return [];
    const items = [];
    const liMatches = sectionM[1].matchAll(/<li>([\s\S]*?)<\/li>/gi);
    for (const m of liMatches) {
      const txt = stripTags(m[1]);
      if (txt) items.push(txt);
    }
    return items;
  }

  res.agenda = extractList('(?:1\\.\\s*)?AGENDA');
  res.attendees = extractList('(?:2\\.\\s*)?PESERTA');
  res.actionItems = extractList('(?:4\\.\\s*)?(?:POKOK\\s+)?TINDAK\\s+LANJUT');
  res.conclusions = extractList('(?:5\\.\\s*)?KESIMPULAN');

  // Activities (3. URAIAN KEGIATAN)
  const actSectionM = html.match(/(?:3\.\s*)?URAIAN KEGIATAN[\s\S]*?([\s\S]*?)(?:<(?:div|h\d)[^>]*class="(?:notula-box-header|notula-section-heading)"[^>]*>(?:4\.\s*)?(?:POKOK\s+)?TINDAK|<div class="notula-closing"|$)/i);
  if (actSectionM) {
    const actItems = Array.from(actSectionM[1].matchAll(/<div class="notula-activity-item">([\s\S]*?)<\/div>\s*(?=<div class="notula-activity-item"|<div class="notula-box-header"|<div class="notula-section-heading"|$)/gi));
    if (actItems.length > 0) {
      for (const ai of actItems) {
        const block = ai[1];
        const speakerM = block.match(/<div class="(?:notula-speaker|notula-subsection-title)">([\s\S]*?)<\/div>/i);
        const points = [];
        const liMatches = block.matchAll(/<li>([\s\S]*?)<\/li>/gi);
        for (const m of liMatches) {
          const txt = stripTags(m[1]);
          if (txt) points.push(txt);
        }
        res.activities.push({
          sectionTitle: speakerM ? stripTags(speakerM[1]) : "Pembahasan",
          points: points.length > 0 ? points : ["-"]
        });
      }
    } else {
      // Coba cari langsung ul di dalam blok uraian kegiatan
      const rawPoints = [];
      const liMatches = actSectionM[1].matchAll(/<li>([\s\S]*?)<\/li>/gi);
      for (const m of liMatches) {
        const txt = stripTags(m[1]);
        if (txt) rawPoints.push(txt);
      }
      if (rawPoints.length > 0) {
        res.activities.push({
          sectionTitle: "1. Jalannya Rapat & Pembahasan",
          points: rawPoints
        });
      }
    }
  }

  // Closing
  const closingM = html.match(/<div class="(?:notula-closing|previewClosing)">\s*([\s\S]*?)\s*<\/div>/i) ||
                   html.match(/<p[^>]*id="previewClosing"[^>]*>\s*([\s\S]*?)\s*<\/p>/i);
  if (closingM) {
    res.closingText = stripTags(closingM[1]);
  }

  // Signature (Notulis)
  const notulisM = html.match(/<div style="font-weight:\s*bold;\s*text-decoration:\s*underline;">\s*([^<]*?)\s*<\/div>/i);
  if (notulisM) {
    res.notulisName = stripTags(notulisM[1]);
  }
  const roleM = html.match(/<div style="font-size:\s*9\.5pt;\s*color:\s*#333;">\s*([^<]*?)\s*<\/div>/i);
  if (roleM) {
    res.notulisRole = stripTags(roleM[1]);
  }

  // Documentation photos
  const photoMatches = html.matchAll(/<img\s+src="([^"]+)"[^>]*alt="Dokumentasi[^"]*"[^>]*>/gi);
  for (const pm of photoMatches) {
    res.documentationPhotos.push({
      url: pm[1],
      caption: "Dokumentasi Kegiatan"
    });
  }

  // Konversi formattedDate ke ISO date (YYYY-MM-DD) jika memungkinkan
  if (res.formattedDate) {
    const monthMap = {
      "januari": "01", "februari": "02", "maret": "03", "april": "04",
      "mei": "05", "juni": "06", "juli": "07", "agustus": "08",
      "september": "09", "oktober": "10", "november": "11", "desember": "12"
    };
    const tglM = res.formattedDate.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
    if (tglM) {
      const day = tglM[1].padStart(2, '0');
      const moStr = tglM[2].toLowerCase();
      const month = monthMap[moStr] || "01";
      const year = tglM[3];
      res.meetingDate = `${year}-${month}-${day}`;
    }
  }

  return res;
}

// Helper untuk menghasilkan file HTML dokumen notula resmi BKN siap cetak / unduh PDF
function generateNotulenHtmlFile({ docData, user, notulenId, meetingId }) {
  const meetingDateObj = new Date(docData.meetingDate);
  const formattedDate = !isNaN(meetingDateObj)
    ? meetingDateObj.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : docData.meetingDate;

  const agenda = Array.isArray(docData.agenda) ? docData.agenda : [];
  const attendees = Array.isArray(docData.attendees) ? docData.attendees : [];
  const activities = Array.isArray(docData.activities) ? docData.activities : [];
  const actionItems = Array.isArray(docData.actionItems) ? docData.actionItems : [];
  const conclusions = Array.isArray(docData.conclusions) ? docData.conclusions : [];
  const documentationPhotos = Array.isArray(docData.documentationPhotos) ? docData.documentationPhotos : [];

  const rawMt = docData.kertasKerjaMt || docData.kertas_kerja_mt;
  const kertasKerjaMt = Array.isArray(rawMt) ? rawMt : (typeof rawMt === "string" ? safeParseJson(rawMt, null) : null);
  let kertasKerjaMtHtml = "";
  if (kertasKerjaMt && kertasKerjaMt.length > 0) {
    let rowsHtml = "";
    let currentPilar = "";
    kertasKerjaMt.forEach(row => {
      if (row.pilar && row.pilar !== currentPilar) {
        currentPilar = row.pilar;
        rowsHtml += `
          <tr style="background-color: #FDE8D7; font-weight: bold; border: 1px solid #000;">
            <td colspan="6" style="padding: 6px 8px; border: 1px solid #000; font-weight: bold; font-size: 9.5pt;">${row.pilar}</td>
          </tr>
        `;
      }
      rowsHtml += `
        <tr style="border: 1px solid #000;">
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; vertical-align: top; font-size: 9.5pt;">${row.no || "-"}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt; font-weight: 500;">${row.komponen || "-"}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${row.indikator || "-"}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${row.buktiOutput || "-"}</td>
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; vertical-align: top; font-size: 11pt; font-weight: bold;">${row.status === "✓" ? "✓" : "-"}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${row.keterangan || "-"}</td>
        </tr>
      `;
    });

    kertasKerjaMtHtml = `
      <div style="margin-top: 20px; margin-bottom: 25px; page-break-inside: auto;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 11pt; color: #0A2540;">Penyampaian Kertas Kerja Manajemen Talenta</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', serif;">
          <thead>
            <tr style="background-color: #D9E2EC; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 9.5pt;">
              <th style="border: 1px solid #000; padding: 6px 4px; width: 35px;">No</th>
              <th style="border: 1px solid #000; padding: 6px 6px; width: 140px;">Komponen Penilaian</th>
              <th style="border: 1px solid #000; padding: 6px 6px;">Indikator Penilaian</th>
              <th style="border: 1px solid #000; padding: 6px 6px; width: 140px;">Bukti Output</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 45px; text-align: center;">Status</th>
              <th style="border: 1px solid #000; padding: 6px 6px; width: 130px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Lambang Garuda Pancasila - Otomatis konversi ke Base64 agar selalu tampil baik online maupun offline
  let garudaSrc = "/images/garuda_pancasila.png";
  try {
    const garudaPath = path.join(process.cwd(), "public", "images", "garuda_pancasila.png");
    if (fs.existsSync(garudaPath)) {
      const gBuf = fs.readFileSync(garudaPath);
      garudaSrc = `data:image/png;base64,${gBuf.toString("base64")}`;
    }
  } catch (gErr) {}

  // Olah foto dokumentasi agar src tidak pernah 'undefined' dan konversi ke Base64 data URI jika file lokal tersedia di server
  const processedPhotos = documentationPhotos.map((photo, i) => {
    const rawUrl = typeof photo === "string" ? photo : (photo.url || photo.dataUrl || photo.previewUrl || photo.path || "");
    let resolvedSrc = rawUrl;
    if (rawUrl && !rawUrl.startsWith("data:")) {
      try {
        const cleanRelPath = rawUrl.startsWith("/") ? rawUrl.substring(1) : rawUrl;
        const diskPath = path.join(process.cwd(), "public", cleanRelPath);
        if (fs.existsSync(diskPath)) {
          const ext = path.extname(diskPath).toLowerCase().replace(".", "");
          const mime = ext === "png" ? "image/png" : (ext === "webp" ? "image/webp" : "image/jpeg");
          const b64 = fs.readFileSync(diskPath).toString("base64");
          resolvedSrc = `data:${mime};base64,${b64}`;
        }
      } catch (e) {
        resolvedSrc = rawUrl;
      }
    }
    const caption = typeof photo === "object" && photo ? (photo.caption || "") : "";
    return {
      src: resolvedSrc,
      caption: caption,
      index: i + 1
    };
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notula - ${docData.title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #E2E8F0;
      margin: 0;
      padding: 2rem 1rem;
      font-family: 'Times New Roman', Times, serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #000;
    }
    .preview-actions {
      width: 100%;
      max-width: 820px;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.825rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .btn-primary { background: #2563EB; color: white; border: none; box-shadow: 0 4px 10px rgba(37,99,235,0.25); }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary { background: white; color: #1E293B; border: 1px solid #CBD5E1; }
    .btn-secondary:hover { background: #F8FAFC; }
    .notula-paper {
      background: #FFFFFF;
      width: 100%;
      max-width: 820px;
      min-height: 1120px;
      padding: 20mm 25mm;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12);
      line-height: 1.5;
      font-size: 11pt;
    }
    .notula-kop { text-align: center; margin-bottom: 15px; }
    .notula-garuda { width: 68px; height: auto; display: block; margin: 0 auto 8px; }
    .notula-kop-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
    .notula-kop-address { font-size: 8.5pt; line-height: 1.35; }
    .notula-kop-divider { border-bottom: 3px double #000; margin: 10px 0 18px; }
    .notula-title-block { text-align: center; margin-bottom: 18px; }
    .notula-main-title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .notula-sub-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
    .notula-meta-line { font-size: 10.5pt; font-weight: bold; margin-bottom: 3px; }
    .notula-shaded-box {
      background-color: #E2E8F0;
      border: 1.5px solid #000000;
      text-align: center;
      padding: 4px 6px;
      font-weight: bold;
      font-size: 11pt;
      letter-spacing: 0.05em;
      margin: 18px 0 8px 0;
      text-transform: uppercase;
      font-family: 'Times New Roman', Times, serif;
    }
    .pelaksanaan-subheading {
      font-weight: bold;
      font-size: 10.5pt;
      margin: 10px 0 3px 0;
      color: #000000;
    }
    .pelaksanaan-text {
      font-size: 10.5pt;
      line-height: 1.5;
      text-align: justify;
      margin-bottom: 8px;
      white-space: pre-line;
    }
    .notula-list { margin: 0 0 14px 20px; padding: 0; }
    .notula-list li { margin-bottom: 4px; text-align: justify; }
    .notula-num-list { margin: 0 0 12px 22px; padding: 0; }
    .notula-num-list li { font-size: 10.5pt; line-height: 1.45; margin-bottom: 4px; text-align: justify; }
    .notula-subnote { font-size: 9pt; font-style: italic; color: #475569; margin-bottom: 8px; }
    .notula-sig-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
      margin-top: 25px;
      page-break-inside: avoid;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }
    .notula-sig-table td { vertical-align: top; border: none; padding: 0; }
    .notula-closing { text-align: justify; margin: 14px 0; }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .preview-actions { display: none !important; }
      .notula-paper { box-shadow: none !important; padding: 15mm 20mm !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="preview-actions">
    <div style="display: flex; gap: 0.5rem;">
      <a href="/manajemenmeeting${meetingId ? `?meetingId=${meetingId}` : ''}" class="btn btn-secondary">
        ← Kembali ke Manajemen Meeting
      </a>
      <a href="/notulen?id=${notulenId || ''}${meetingId ? `&meetingId=${meetingId}` : ''}" class="btn btn-secondary">
        ✏️ Edit di App Infografis
      </a>
    </div>
    <div style="display: flex; gap: 0.5rem;">
      <button type="button" onclick="window.print()" class="btn btn-primary">
        🖨️ Cetak / Unduh PDF (A4)
      </button>
    </div>
  </div>

  <div class="notula-paper">
    <div class="notula-kop">
      <img src="${garudaSrc}" alt="Garuda Pancasila" class="notula-garuda">
      <div class="notula-kop-title">${user.institution_kop || 'BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V'}</div>
      <div class="notula-kop-address">
        ${user.kop_address || 'Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730'}<br>
        ${user.kop_contact || 'Telepon (021) 87721084 - 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id'}
      </div>
      <div class="notula-kop-divider"></div>
    </div>

    <div class="notula-title-block">
      <div class="notula-main-title">NOTULA</div>
      <div class="notula-sub-title">(${docData.title})</div>
      <div class="notula-meta-line">Hari, Tanggal, Waktu: ${formattedDate}, ${docData.meetingTime || '-'}</div>
      <div class="notula-meta-line">Tempat: ${docData.meetingPlace || '-'}</div>
    </div>

    <div class="notula-shaded-box">AGENDA RAPAT</div>
    <ul class="notula-list">
      ${agenda.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <div class="notula-shaded-box">PESERTA RAPAT</div>
    <ol class="notula-num-list">
      ${attendees.map(item => `<li>${item}</li>`).join('')}
    </ol>

    <div class="notula-shaded-box">PELAKSANAAN</div>
    <div>
      <div class="pelaksanaan-subheading">1. Pembukaan</div>
      <div class="pelaksanaan-text">${docData.pelaksanaanPembukaan || docData.pelaksanaan_pembukaan || (activities.length > 0 && activities[0].points ? activities[0].points.join('\n') : '-')}</div>

      <div class="pelaksanaan-subheading">2. Pembahasan</div>
      <div class="pelaksanaan-text">${docData.pelaksanaanPembahasan || docData.pelaksanaan_pembahasan || (activities.length > 1 ? activities.slice(1).map(a => `${a.sectionTitle}:\n${(a.points || []).join('\n')}`).join('\n\n') : (activities.length === 1 && activities[0].points ? activities[0].points.join('\n') : '-'))}</div>

      ${kertasKerjaMtHtml}

      <div class="pelaksanaan-subheading">3. Diskusi / Tanya Jawab</div>
      <div class="pelaksanaan-text">${docData.pelaksanaanDiskusi || docData.pelaksanaan_diskusi || '-'}</div>

      <div class="pelaksanaan-subheading">4. Rekomendasi/Tindak Lanjut</div>
      <div class="pelaksanaan-text">${docData.pelaksanaanRekomendasi || docData.pelaksanaan_rekomendasi || (actionItems.length > 0 ? actionItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : (conclusions.length > 0 ? conclusions.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : '-'))}</div>
    </div>

    <div class="notula-shaded-box">DOKUMENTASI</div>
    <div class="notula-subnote">(Foto, screenshoot, evidence, link dok pendukung, dll)</div>
    ${processedPhotos.length > 0 ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; margin-bottom: 15px;">
        ${processedPhotos.map(p => `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; padding: 4px; background: #f8fafc; text-align: center;">
            <img src="${p.src}" style="max-width: 100%; height: 160px; object-fit: cover; border-radius: 4px;" alt="Dokumentasi ${p.index}">
            ${p.caption ? `<div style="font-size: 8.5pt; margin-top: 4px; color: #475569;">${p.caption}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="notula-shaded-box">PENUTUP</div>
    <div class="notula-closing">
      ${docData.closingText || 'Demikian notula ini disusun untuk dipergunakan sebagaimana mestinya.'}
    </div>

    <!-- Tanda Tangan 2 Kolom (Kiri: Mengetahui, Kanan: Notulis) -->
    <table class="notula-sig-table">
      <tr>
        <td style="width: 50%; padding-right: 15px;">
          <div>Mengetahui,</div>
          <div style="font-weight: bold; margin-bottom: 4px;">${docData.approverRole || docData.approver_role || '(Nama Jabatan)'}</div>
          <div style="min-height: 60px; display: flex; align-items: center; margin: 8px 0;">
            ${(docData.approver_signature || docData.approverSignature) ? `
              <img src="${docData.approver_signature || docData.approverSignature}" style="max-height: 68px; max-width: 170px; object-fit: contain; margin: 2px 0;" alt="Tanda Tangan Pejabat" />
            ` : ((docData.approvalStatus === 'approved' || docData.approval_status === 'approved') ? `
              <div style="display: inline-block; border: 1.5px solid #059669; background: #ECFDF5; color: #065F46; padding: 4px 10px; border-radius: 6px; font-family: sans-serif; font-size: 8pt; line-height: 1.3;">
                <div style="font-weight: bold; font-size: 8.5pt; color: #047857;">✓ DISAHKAN RESMI</div>
                <div>${docData.approverName || docData.approver_name || 'Pejabat'}</div>
                <div style="font-size: 7.5pt; color: #059669;">${docData.approvedAt || docData.approved_at ? new Date(docData.approvedAt || docData.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : (formattedDate.includes(',') ? formattedDate.split(',')[1].trim() : formattedDate)}</div>
              </div>
            ` : `
              <div style="font-style: italic; color: #666; font-size: 9.5pt;">ttd</div>
            `)}
          </div>
          <div style="font-weight: bold; text-decoration: underline;">${docData.approverName || docData.approver_name || 'Nama'}</div>
          ${(docData.approverNip || docData.approver_nip) ? `<div>${String(docData.approverNip || docData.approver_nip).startsWith('NIP') ? (docData.approverNip || docData.approver_nip) : 'NIP. ' + (docData.approverNip || docData.approver_nip)}</div>` : ''}
        </td>

        <td style="width: 50%; padding-left: 15px;">
          <div>${user.sig_city || 'Jakarta'}, ${formattedDate.includes(',') ? formattedDate.split(',')[1].trim() : formattedDate}</div>
          <div style="font-weight: bold; margin-bottom: 4px;">Notulis,</div>
          <div style="min-height: 60px; display: flex; align-items: center; margin: 8px 0;">
            <div style="font-style: italic; color: #666; font-size: 9.5pt;">ttd</div>
          </div>
          <div style="font-weight: bold; text-decoration: underline;">${docData.notulisName || docData.notulis_name || user.full_name}</div>
          ${(docData.notulisNip || docData.notulis_nip || user.nip) ? `<div>${String(docData.notulisNip || docData.notulis_nip || user.nip).startsWith('NIP') ? (docData.notulisNip || docData.notulis_nip || user.nip) : 'NIP. ' + (docData.notulisNip || docData.notulis_nip || user.nip)}</div>` : ''}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export const notulenController = {
  // GET /notulen
  getNotulenGenerator: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const today = new Date();
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      const formattedDate = today.toLocaleDateString("id-ID", options);
      const isoDate = today.toISOString().split("T")[0];

      // Ambil daftar rapat BKN dari Manajemen Meeting untuk dropdown integrasi (hanya milik user atau semua jika admin)
      let meetingsList = [];
      try {
        let mQuery = `
          SELECT m.meeting_id, m.meeting_nama, m.tanggal, m.tipe_meeting,
                 COALESCE(m.pembuat, z.user_id, z.nip, 'admin') AS creator_user_id
          FROM meetings m
          LEFT JOIN zoom_requests z ON (
              m.meeting_nama = z.judul_rapat 
              AND m.tanggal = z.tanggal_rapat
          )
        `;
        const mParams = [];
        if (user.role !== "admin") {
          mQuery += ` WHERE (m.pembuat = $1 OR z.user_id = $1 OR (z.nip IS NOT NULL AND z.nip <> '' AND z.nip = $2))`;
          mParams.push(user.id, user.nip || user.id);
        }
        mQuery += ` ORDER BY m.meeting_id DESC`;
        const mRes = await pool.query(mQuery, mParams);
        meetingsList = mRes.rows;
      } catch (mErr) {
        console.warn("Notice: meetings query err (fallback):", mErr.message);
        try {
          const fbRes = await pool.query("SELECT meeting_id, meeting_nama, tanggal, tipe_meeting FROM meetings ORDER BY meeting_id DESC");
          meetingsList = fbRes.rows;
        } catch (fbErr) {
          meetingsList = [];
        }
      }

      // Ambil daftar pegawai / pejabat untuk dropdown Pihak yang Mengetahui (Pengesahan)
      let approverList = [];
      try {
        const uRes = await pool.query(`
          SELECT id, username, full_name, nip, division, role 
          FROM users 
          ORDER BY CASE WHEN role = 'pimpinan' THEN 1 WHEN role = 'admin' THEN 2 ELSE 3 END, full_name ASC
        `);
        approverList = uRes.rows;
      } catch (uErr) {
        approverList = [];
      }

      // Ambil notula yang menunggu pengesahan oleh user login saat ini (atau semua jika admin/pimpinan)
      let pendingApprovals = [];
      try {
        const paRes = await pool.query(`
          SELECT n.id, n.title, n.meeting_date, n.notulis_name, n.created_at, n.meeting_id, n.approval_status
          FROM notulen n
          WHERE (n.approver_id = $1 OR ($2 IN ('admin', 'pimpinan') AND n.approval_status = 'pending_approval'))
            AND n.approval_status = 'pending_approval'
          ORDER BY n.id DESC
        `, [user.id, user.role]);
        pendingApprovals = paRes.rows;
      } catch (paErr) {
        pendingApprovals = [];
      }

      const queryMeetingId = req.query.meetingId ? parseInt(req.query.meetingId, 10) : null;
      const queryNotulenId = (req.query.id || req.query.notulenId) ? parseInt(req.query.id || req.query.notulenId, 10) : null;
      let selectedMeetingId = queryMeetingId || null;
      let latestDoc = null;

      try {
        // 1. Jika queryMeetingId diberikan, utamakan cari notulen yang terhubung ke rapat tersebut
        if (queryMeetingId) {
          const mDocRes = await pool.query(
            "SELECT * FROM notulen WHERE meeting_id = $1 ORDER BY id DESC LIMIT 1",
            [queryMeetingId]
          ).catch(() => ({ rows: [] }));
          if (mDocRes.rows.length > 0) {
            latestDoc = mDocRes.rows[0];
          }
        }

        // 2. Jika belum ketemu dan ada queryNotulenId, periksa apakah notulen id tersebut sesuai
        if (!latestDoc && queryNotulenId) {
          const idDocRes = await pool.query(
            "SELECT * FROM notulen WHERE id = $1",
            [queryNotulenId]
          ).catch(() => ({ rows: [] }));
          if (idDocRes.rows.length > 0) {
            const foundRow = idDocRes.rows[0];
            // Jika ada queryMeetingId, jangan gunakan row jika meeting_id berbeda rapat
            if (!queryMeetingId || !foundRow.meeting_id || String(foundRow.meeting_id) === String(queryMeetingId)) {
              latestDoc = foundRow;
              if (!selectedMeetingId && foundRow.meeting_id) {
                selectedMeetingId = foundRow.meeting_id;
              }
            }
          }
        }

        // 3. Jika tanpa parameter khusus, jangan muat dokumen lama agar form notulen baru tetap bersih
        if (!latestDoc && !queryMeetingId && !queryNotulenId) {
          latestDoc = null;
        }
      } catch (dbErr) {
        console.warn("Notice: notulen query err:", dbErr.message);
      }

      if (!selectedMeetingId && latestDoc?.meeting_id) {
        selectedMeetingId = latestDoc.meeting_id;
      }

      // Cek apakah data notulen di database kosong atau perlu di-hydrate dari file HTML fisik
      let fallbackParsed = null;
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "notulen");
        if (fs.existsSync(uploadDir)) {
          let targetHtmlPath = null;
          const allFiles = fs.readdirSync(uploadDir).filter(f => f.endsWith(".html"));

          // 1. Cek dari kolom notulen tabel meetings jika selectedMeetingId ada
          if (selectedMeetingId) {
            try {
              const mtgRes = await pool.query(
                "SELECT notulen, notulen_pdf FROM meetings WHERE meeting_id = $1",
                [selectedMeetingId]
              );
              const mRow = mtgRes.rows[0];
              const possibleFile = mRow?.notulen_pdf || mRow?.notulen;
              if (possibleFile && typeof possibleFile === "string" && possibleFile.endsWith(".html")) {
                const cleanRel = possibleFile.startsWith("/") ? possibleFile.substring(1) : possibleFile;
                const fullP = path.join(process.cwd(), "public", cleanRel);
                if (fs.existsSync(fullP)) targetHtmlPath = fullP;
              }
            } catch (mErr) {}
          }

          // 2. Jika belum ketemu, cari file matching notulen_rapat_${selectedMeetingId}_*.html (pilih timestamp paling baru)
          if (!targetHtmlPath && selectedMeetingId) {
            const matchFiles = allFiles
              .filter(f => f.startsWith(`notulen_rapat_${selectedMeetingId}_`))
              .sort((a, b) => {
                const tA = parseInt(a.replace(/[^0-9]/g, '').slice(-13) || '0', 10);
                const tB = parseInt(b.replace(/[^0-9]/g, '').slice(-13) || '0', 10);
                return tB - tA;
              });
            if (matchFiles.length > 0) {
              targetHtmlPath = path.join(uploadDir, matchFiles[0]);
            }
          }

          // 3. Jika belum ketemu, cari file HTML di folder uploads/notulen yang mereferensikan queryMeetingId atau queryNotulenId
          if (!targetHtmlPath && (queryMeetingId || queryNotulenId)) {
            const searchId = queryMeetingId || queryNotulenId;
            for (const f of allFiles) {
              try {
                const p = path.join(uploadDir, f);
                const text = fs.readFileSync(p, "utf-8");
                if (
                  text.includes(`meetingId=${searchId}`) ||
                  text.includes(`id=${searchId}`) ||
                  text.includes(`notulen_rapat_${searchId}_`)
                ) {
                  targetHtmlPath = p;
                  const mMtg = f.match(/notulen_rapat_(\d+)_/);
                  if (mMtg && !selectedMeetingId) {
                    selectedMeetingId = parseInt(mMtg[1], 10);
                  }
                  break;
                }
              } catch (e) {}
            }
          }

          if (targetHtmlPath && fs.existsSync(targetHtmlPath)) {
            const htmlContent = fs.readFileSync(targetHtmlPath, "utf-8");
            fallbackParsed = parseNotulenHtml(htmlContent);
            const mFileMtg = path.basename(targetHtmlPath).match(/notulen_rapat_(\d+)_/);
            if (mFileMtg && (!selectedMeetingId || selectedMeetingId === queryNotulenId)) {
              selectedMeetingId = parseInt(mFileMtg[1], 10);
            }
          }
        }
      } catch (fErr) {
        console.warn("Notice: fallback parse err:", fErr.message);
      }

      // Jika latestDoc belum ada ATAU agenda_data di database kosong/kurang lengkap, tapi file HTML punya data lengkap:
      const docAgenda = safeParseJson(latestDoc?.agenda_data);
      const isDummyTitle = latestDoc?.title && latestDoc.title.toUpperCase().includes("BKN MENYAPA ASN");
      if (fallbackParsed && (queryMeetingId || queryNotulenId) && (!latestDoc || docAgenda.length === 0 || isDummyTitle)) {
        if (!latestDoc) {
          latestDoc = {
            id: req.query.id || null,
            meeting_id: selectedMeetingId,
            title: fallbackParsed.title,
            meeting_date: fallbackParsed.meetingDate || isoDate,
            formattedDate: fallbackParsed.formattedDate,
            meeting_time: fallbackParsed.meetingTime,
            meeting_place: fallbackParsed.meetingPlace,
            agenda_data: fallbackParsed.agenda,
            attendees_data: fallbackParsed.attendees,
            activities_data: fallbackParsed.activities,
            action_items: fallbackParsed.actionItems,
            conclusions: fallbackParsed.conclusions,
            closing_text: fallbackParsed.closingText,
            documentation_photos: fallbackParsed.documentationPhotos,
            notulis_name: fallbackParsed.notulisName,
            notulis_role: fallbackParsed.notulisRole
          };
          try {
            const insRes = await pool.query(`
              INSERT INTO notulen (
                user_id, title, meeting_date, meeting_time, meeting_place,
                agenda_data, attendees_data, activities_data, action_items, conclusions,
                closing_text, documentation_photos, notulis_name, notulis_role, meeting_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              RETURNING id
            `, [
              String(user.id || 'admin'), fallbackParsed.title, fallbackParsed.meetingDate || isoDate,
              fallbackParsed.meetingTime || '-', fallbackParsed.meetingPlace || '-',
              JSON.stringify(fallbackParsed.agenda), JSON.stringify(fallbackParsed.attendees),
              JSON.stringify(fallbackParsed.activities), JSON.stringify(fallbackParsed.actionItems),
              JSON.stringify(fallbackParsed.conclusions), fallbackParsed.closingText || '',
              JSON.stringify(fallbackParsed.documentationPhotos), fallbackParsed.notulisName || user.full_name,
              fallbackParsed.notulisRole || user.division, selectedMeetingId
            ]);
            if (insRes.rows.length > 0) {
              latestDoc.id = insRes.rows[0].id;
            }
          } catch (autoInsErr) {
            console.warn("Notice: auto-sync parsed notulen err:", autoInsErr.message);
          }
        } else {
          // Hydrate data yang lengkap dari file HTML ke latestDoc
          latestDoc.title = fallbackParsed.title || latestDoc.title;
          latestDoc.meeting_date = fallbackParsed.meetingDate || latestDoc.meeting_date;
          latestDoc.formattedDate = fallbackParsed.formattedDate || latestDoc.formattedDate;
          latestDoc.meeting_time = fallbackParsed.meetingTime || latestDoc.meeting_time;
          latestDoc.meeting_place = fallbackParsed.meetingPlace || latestDoc.meeting_place;
          latestDoc.agenda_data = (fallbackParsed.agenda && fallbackParsed.agenda.length > 0) ? fallbackParsed.agenda : latestDoc.agenda_data;
          latestDoc.attendees_data = (fallbackParsed.attendees && fallbackParsed.attendees.length > 0) ? fallbackParsed.attendees : latestDoc.attendees_data;
          latestDoc.activities_data = (fallbackParsed.activities && fallbackParsed.activities.length > 0) ? fallbackParsed.activities : latestDoc.activities_data;
          latestDoc.action_items = (fallbackParsed.actionItems && fallbackParsed.actionItems.length > 0) ? fallbackParsed.actionItems : latestDoc.action_items;
          latestDoc.conclusions = (fallbackParsed.conclusions && fallbackParsed.conclusions.length > 0) ? fallbackParsed.conclusions : latestDoc.conclusions;
          latestDoc.closing_text = fallbackParsed.closingText || latestDoc.closing_text;
          if (selectedMeetingId) latestDoc.meeting_id = selectedMeetingId;

          // Sync update ke DB agar permanen dan tidak kosong lagi di sesi mendatang
          try {
            if (latestDoc.id) {
              await pool.query(`
                UPDATE notulen SET
                  title = $1, meeting_date = $2, meeting_time = $3, meeting_place = $4,
                  agenda_data = $5, attendees_data = $6, activities_data = $7,
                  action_items = $8, conclusions = $9, closing_text = $10, meeting_id = $11
                WHERE id = $12
              `, [
                latestDoc.title, latestDoc.meeting_date, latestDoc.meeting_time, latestDoc.meeting_place,
                JSON.stringify(latestDoc.agenda_data), JSON.stringify(latestDoc.attendees_data),
                JSON.stringify(latestDoc.activities_data), JSON.stringify(latestDoc.action_items),
                JSON.stringify(latestDoc.conclusions), latestDoc.closing_text, latestDoc.meeting_id,
                latestDoc.id
              ]);
            }
          } catch (uErr) {
            console.warn("Notice: sync db update err:", uErr.message);
          }
        }
      }

      // Validasi: pastikan rapat tujuan tersedia dalam meetingsList agar dropdown dapat memilihnya
      if (selectedMeetingId && !meetingsList.some(m => String(m.meeting_id) === String(selectedMeetingId))) {
        try {
          const singleMtg = await pool.query(
            "SELECT meeting_id, meeting_nama, tanggal, tipe_meeting FROM meetings WHERE meeting_id = $1",
            [selectedMeetingId]
          );
          if (singleMtg.rows.length > 0) {
            meetingsList.unshift(singleMtg.rows[0]);
          }
        } catch (sErr) {
          console.warn("Notice: could not fetch target meeting:", sErr.message);
        }
      }
      if (!selectedMeetingId && meetingsList.length > 0) {
        selectedMeetingId = meetingsList[0].meeting_id;
      }

      let meetingDateStr = isoDate;
      if (latestDoc && latestDoc.meeting_date) {
        if (latestDoc.meeting_date instanceof Date) {
          meetingDateStr = latestDoc.meeting_date.toISOString().split("T")[0];
        } else {
          meetingDateStr = String(latestDoc.meeting_date).split("T")[0];
        }
      }
      
      let meetingDateFormatted = formattedDate;
      if (latestDoc && latestDoc.formattedDate) {
        meetingDateFormatted = latestDoc.formattedDate;
      } else if (meetingDateStr) {
        const dObj = new Date(meetingDateStr + "T00:00:00");
        if (!isNaN(dObj.getTime())) {
          meetingDateFormatted = dObj.toLocaleDateString("id-ID", options);
        }
      }

      const rawLatestMt = latestDoc ? latestDoc.kertas_kerja_mt : null;
      const parsedLatestMt = rawLatestMt ? (Array.isArray(rawLatestMt) ? rawLatestMt : safeParseJson(rawLatestMt, null)) : null;

      const parsedActivities = safeParseJson(latestDoc?.activities_data || latestDoc?.activities);
      const parsedActions = safeParseJson(latestDoc?.action_items || latestDoc?.actionItems);
      const parsedConclusions = safeParseJson(latestDoc?.conclusions || latestDoc?.conclusions);

      const defaultData = latestDoc ? {
        id: latestDoc.id,
        meetingId: selectedMeetingId || latestDoc.meeting_id || null,
        title: latestDoc.title || "",
        meetingDate: meetingDateStr,
        formattedDate: meetingDateFormatted,
        meetingTime: latestDoc.meeting_time || "09.00 – 11.30 WIB",
        meetingPlace: latestDoc.meeting_place || "Di Tempat",
        agenda: safeParseJson(latestDoc.agenda_data || latestDoc.agenda),
        attendees: safeParseJson(latestDoc.attendees_data || latestDoc.attendees),
        activities: parsedActivities,
        actionItems: parsedActions,
        conclusions: parsedConclusions,
        pelaksanaanPembukaan: latestDoc.pelaksanaan_pembukaan || (parsedActivities.length > 0 && parsedActivities[0]?.points ? parsedActivities[0].points.join('\n') : ''),
        pelaksanaanPembahasan: latestDoc.pelaksanaan_pembahasan || (parsedActivities.length > 1 ? parsedActivities.slice(1).map(a => `${a.sectionTitle}:\n${(a.points || []).join('\n')}`).join('\n\n') : (parsedActivities.length === 1 && parsedActivities[0]?.points ? parsedActivities[0].points.join('\n') : '')),
        pelaksanaanDiskusi: latestDoc.pelaksanaan_diskusi || '',
        pelaksanaanRekomendasi: latestDoc.pelaksanaan_rekomendasi || (parsedActions.length > 0 ? parsedActions.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : (parsedConclusions.length > 0 ? parsedConclusions.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : '')),
        closingText: latestDoc.closing_text || latestDoc.closingText || "",
        documentationPhotos: safeParseJson(latestDoc.documentation_photos || latestDoc.documentationPhotos),
        isMt: Boolean(parsedLatestMt && parsedLatestMt.length > 0),
        kertasKerjaMt: parsedLatestMt,
        notulisName: latestDoc.notulis_name || latestDoc.notulisName || user.full_name,
        notulisNip: latestDoc.notulis_nip || latestDoc.notulisNip || user.nip || "",
        notulisRole: latestDoc.notulis_role || latestDoc.notulisRole || user.division,
        approvalStatus: latestDoc.approval_status || 'draft',
        approverId: latestDoc.approver_id || null,
        approverName: latestDoc.approver_name || '',
        approverNip: latestDoc.approver_nip || '',
        approverRole: latestDoc.approver_role || '',
        approvedAt: latestDoc.approved_at || null,
        approvalNotes: latestDoc.approval_notes || '',
        approverSignature: latestDoc.approver_signature || ''
      } : {
        id: null,
        meetingId: null,
        title: "",
        meetingDate: isoDate,
        formattedDate: formattedDate,
        meetingTime: "09.00 – 11.30 WIB",
        meetingPlace: "Daring melalui Zoom Meeting",
        agenda: [],
        attendees: [],
        activities: [],
        actionItems: [],
        conclusions: [],
        pelaksanaanPembukaan: "",
        pelaksanaanPembahasan: "",
        pelaksanaanDiskusi: "",
        pelaksanaanRekomendasi: "",
        closingText: "",
        documentationPhotos: [],
        isMt: false,
        kertasKerjaMt: null,
        notulisName: user.full_name,
        notulisNip: user.nip || "",
        notulisRole: user.division,
        approvalStatus: 'draft',
        approverId: null,
        approverName: "",
        approverNip: "",
        approverRole: "",
        approvedAt: null,
        approvalNotes: "",
        approverSignature: ""
      };

      // Jika dibuka dengan parameter meetingId tapi tanpa id notula tertentu, prefill dari rapat tersebut
      if (req.query.meetingId && !req.query.id) {
        const chosen = meetingsList.find(m => String(m.meeting_id) === String(req.query.meetingId));
        if (chosen) {
          defaultData.title = chosen.meeting_nama;
          defaultData.meetingId = chosen.meeting_id;
          if (chosen.tanggal) {
            defaultData.meetingDate = chosen.tanggal instanceof Date 
              ? chosen.tanggal.toISOString().split("T")[0] 
              : String(chosen.tanggal).split("T")[0];
          }
          if (chosen.tipe_meeting && (chosen.tipe_meeting.toLowerCase().includes("zoom") || chosen.tipe_meeting.toLowerCase().includes("webinar"))) {
            defaultData.meetingPlace = "Daring melalui Zoom Meeting";
          }
        }
      }

      const isEditing = Boolean(req.query.id || (latestDoc && latestDoc.id));

      res.render("notulen", {
        title: isEditing ? "Edit Notula Rapat Kedinasan - BKN" : "Pembuat Notulen Rapat Kedinasan - BKN",
        user: user,
        initialData: defaultData,
        todayFormatted: formattedDate,
        meetings: meetingsList,
        selectedMeetingId: selectedMeetingId,
        approverList: approverList,
        pendingApprovals: pendingApprovals,
        fromMeetingManagement: Boolean(req.query.meetingId || (latestDoc && latestDoc.meeting_id)),
        isEditing: isEditing
      });
    } catch (err) {
      console.error("Notulen generator error:", err);
      res.status(500).send("Gagal memuat pembuat notulen: " + err.message);
    }
  },

  // POST /api/notulen (Simpan / Perbarui Notulen & Auto-Integrasi ke Manajemen Meeting)
  saveNotulen: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const {
        id,
        meetingId,
        title,
        meetingDate,
        meetingTime,
        meetingPlace,
        agenda,
        attendees,
        activities,
        actionItems,
        conclusions,
        closingText,
        documentationPhotos,
        notulisName,
        notulisNip,
        notulis_nip,
        notulisRole,
        kertasKerjaMt,
        kertas_kerja_mt,
        pelaksanaanPembukaan,
        pelaksanaan_pembukaan,
        pelaksanaanPembahasan,
        pelaksanaan_pembahasan,
        pelaksanaanDiskusi,
        pelaksanaan_diskusi,
        pelaksanaanRekomendasi,
        pelaksanaan_rekomendasi,
        approverId,
        approver_id,
        approverName,
        approver_name,
        approverNip,
        approver_nip,
        approverRole,
        approver_role,
        approvalStatus,
        approval_status
      } = req.body;

      if (!title || !meetingDate) {
        return res.status(400).json({ success: false, message: "Judul rapat dan tanggal rapat wajib diisi." });
      }

      const targetMeetingId = meetingId ? parseInt(meetingId, 10) : null;

      // Cek apakah rapat tujuan tersedia (setiap pegawai yang login berhak mengisi/menyimpan notulen rapat)
      if (targetMeetingId) {
        try {
          const checkMtg = await pool.query(
            "SELECT meeting_id FROM meetings WHERE meeting_id = $1",
            [targetMeetingId]
          );
          if (checkMtg.rows.length === 0) {
            return res.status(404).json({
              success: false,
              message: "Rapat tujuan tidak ditemukan dalam sistem."
            });
          }
        } catch (authErr) {
          console.warn("Notice: meeting existence check warning in saveNotulen:", authErr.message);
        }
      }

      const agendaJson = JSON.stringify(Array.isArray(agenda) ? agenda : []);
      const attendeesJson = JSON.stringify(Array.isArray(attendees) ? attendees : []);
      const activitiesJson = JSON.stringify(Array.isArray(activities) ? activities : []);
      const actionItemsJson = JSON.stringify(Array.isArray(actionItems) ? actionItems : []);
      const conclusionsJson = JSON.stringify(Array.isArray(conclusions) ? conclusions : []);
      const docsJson = JSON.stringify(Array.isArray(documentationPhotos) ? documentationPhotos : []);
      const rawMt = kertasKerjaMt || kertas_kerja_mt;
      const mtArray = (Array.isArray(rawMt) && rawMt.length > 0) ? rawMt : null;
      const mtJson = mtArray ? JSON.stringify(mtArray) : null;
      const finalNotulisNip = (notulisNip !== undefined && notulisNip !== null) ? notulisNip : (notulis_nip || user.nip || null);

      const finalPembukaan = (pelaksanaanPembukaan !== undefined) ? pelaksanaanPembukaan : (pelaksanaan_pembukaan || null);
      const finalPembahasan = (pelaksanaanPembahasan !== undefined) ? pelaksanaanPembahasan : (pelaksanaan_pembahasan || null);
      const finalDiskusi = (pelaksanaanDiskusi !== undefined) ? pelaksanaanDiskusi : (pelaksanaan_diskusi || null);
      const finalRekomendasi = (pelaksanaanRekomendasi !== undefined) ? pelaksanaanRekomendasi : (pelaksanaan_rekomendasi || null);

      const finalApproverId = (approverId !== undefined) ? approverId : (approver_id || null);
      const finalApproverName = (approverName !== undefined) ? approverName : (approver_name || null);
      const finalApproverNip = (approverNip !== undefined) ? approverNip : (approver_nip || null);
      const finalApproverRole = (approverRole !== undefined) ? approverRole : (approver_role || null);
      const finalApprovalStatus = approvalStatus || approval_status || 'draft';

      let savedId;
      if (id) {
        await pool.query(`
          UPDATE notulen SET
            title = $1,
            meeting_date = $2,
            meeting_time = $3,
            meeting_place = $4,
            agenda_data = $5,
            attendees_data = $6,
            activities_data = $7,
            action_items = $8,
            conclusions = $9,
            closing_text = $10,
            documentation_photos = $11,
            notulis_name = $12,
            notulis_role = $13,
            meeting_id = COALESCE($14, meeting_id),
            kertas_kerja_mt = $15,
            notulis_nip = $16,
            pelaksanaan_pembukaan = $17,
            pelaksanaan_pembahasan = $18,
            pelaksanaan_diskusi = $19,
            pelaksanaan_rekomendasi = $20,
            approver_id = COALESCE($21, approver_id),
            approver_name = COALESCE($22, approver_name),
            approver_nip = COALESCE($23, approver_nip),
            approver_role = COALESCE($24, approver_role),
            approval_status = COALESCE($25, approval_status)
          WHERE id = $26
        `, [
          title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId,
          mtJson,
          finalNotulisNip,
          finalPembukaan,
          finalPembahasan,
          finalDiskusi,
          finalRekomendasi,
          finalApproverId,
          finalApproverName,
          finalApproverNip,
          finalApproverRole,
          finalApprovalStatus,
          id
        ]);
        savedId = id;
      } else {
        const insertRes = await pool.query(`
          INSERT INTO notulen (
            user_id, title, meeting_date, meeting_time, meeting_place,
            agenda_data, attendees_data, activities_data, action_items, conclusions,
            closing_text, documentation_photos, notulis_name, notulis_role, meeting_id,
            kertas_kerja_mt, notulis_nip,
            pelaksanaan_pembukaan, pelaksanaan_pembahasan, pelaksanaan_diskusi, pelaksanaan_rekomendasi,
            approver_id, approver_name, approver_nip, approver_role, approval_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          RETURNING id
        `, [
          String(user?.id || "user"), title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId,
          mtJson,
          finalNotulisNip,
          finalPembukaan,
          finalPembahasan,
          finalDiskusi,
          finalRekomendasi,
          finalApproverId,
          finalApproverName,
          finalApproverNip,
          finalApproverRole,
          finalApprovalStatus
        ]);
        savedId = insertRes.rows[0]?.id;
      }

      // Generate berkas dokumen notula fisik di folder uploads/notulen/
      let fileUrl = null;
      let targetMeetingName = null;
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "notulen");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `notulen_rapat_${targetMeetingId || savedId}_${Date.now()}.html`;
        const filePath = path.join(uploadDir, fileName);
        fileUrl = `/uploads/notulen/${fileName}`;

        const htmlContent = generateNotulenHtmlFile({
          docData: {
            title, meetingDate, meetingTime, meetingPlace,
            agenda: Array.isArray(agenda) ? agenda : [],
            attendees: Array.isArray(attendees) ? attendees : [],
            activities: Array.isArray(activities) ? activities : [],
            actionItems: Array.isArray(actionItems) ? actionItems : [],
            conclusions: Array.isArray(conclusions) ? conclusions : [],
            pelaksanaanPembukaan: finalPembukaan,
            pelaksanaanPembahasan: finalPembahasan,
            pelaksanaanDiskusi: finalDiskusi,
            pelaksanaanRekomendasi: finalRekomendasi,
            closingText, documentationPhotos: Array.isArray(documentationPhotos) ? documentationPhotos : [],
            kertasKerjaMt: mtArray,
            notulisName, notulisNip: finalNotulisNip, notulisRole,
            approverId: finalApproverId,
            approverName: finalApproverName,
            approverNip: finalApproverNip,
            approverRole: finalApproverRole,
            approvalStatus: finalApprovalStatus
          },
          user,
          notulenId: savedId,
          meetingId: targetMeetingId
        });

        fs.writeFileSync(filePath, htmlContent, "utf-8");

        // Jika rapat tujuan belum dipilih secara manual, cocokkan otomatis berdasarkan judul dan tanggal rapat
        if (!targetMeetingId) {
          try {
            const autoMatch = await pool.query(
              "SELECT meeting_id, meeting_nama FROM meetings WHERE LOWER(TRIM(meeting_nama)) = LOWER(TRIM($1)) AND tanggal = $2::date LIMIT 1",
              [title, meetingDate]
            );
            if (autoMatch.rows.length > 0) {
              targetMeetingId = autoMatch.rows[0].meeting_id;
              targetMeetingName = autoMatch.rows[0].meeting_nama;
              await pool.query("UPDATE notulen SET meeting_id = $1 WHERE id = $2", [targetMeetingId, savedId]);
            }
          } catch (amErr) {}
        }

        // Jika rapat tujuan dipilih/ditemukan, simpan nama berkas ke kolom notulen / notulen_pdf tabel meetings
        if (targetMeetingId) {
          try {
            await pool.query(
              "UPDATE meetings SET notulen = $1 WHERE meeting_id = $2",
              [fileUrl, targetMeetingId]
            );
          } catch (nErr) {}

          try {
            await pool.query(
              "UPDATE meetings SET notulen_pdf = $1 WHERE meeting_id = $2",
              [fileUrl, targetMeetingId]
            );
          } catch (npErr) {}

          if (!targetMeetingName) {
            const mQuery = await pool.query(
              "SELECT meeting_nama FROM meetings WHERE meeting_id = $1",
              [targetMeetingId]
            );
            targetMeetingName = mQuery.rows[0]?.meeting_nama || null;
          }
        }
      } catch (fileErr) {
        console.warn("⚠️ Gagal generate berkas notulen fisik:", fileErr.message);
      }

      return res.json({
        success: true,
        message: targetMeetingName 
          ? `Notula berhasil disimpan & otomatis terhubung ke rapat "${targetMeetingName}" di Manajemen Meeting!`
          : "Notulen rapat kedinasan berhasil disimpan!",
        id: savedId,
        meetingId: targetMeetingId,
        notulenFile: fileUrl,
        integratedMeetingTitle: targetMeetingName
      });
    } catch (err) {
      console.error("Save notulen error:", err);
      return res.status(500).json({ success: false, message: "Gagal menyimpan notulen: " + err.message });
    }
  },

  // POST /api/notulen/submit-approval (Notulis mengajukan pengesahan ke Pejabat yang Mengetahui)
  submitApproval: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const targetId = req.body.id || req.body.notulenId;
      const { approverId, approverName, approverNip, approverRole } = req.body;
      if (!targetId) {
        return res.status(400).json({ success: false, message: "ID notula wajib disertakan." });
      }
      if (!approverName && !approverId) {
        return res.status(400).json({ success: false, message: "Pihak yang mengetahui (pejabat yang mengesahkan) wajib dipilih pada bagian 7. Pengesahan." });
      }

      await pool.query(`
        UPDATE notulen SET
          approval_status = 'pending_approval',
          approver_id = $1,
          approver_name = $2,
          approver_nip = $3,
          approver_role = $4
        WHERE id = $5
      `, [approverId || null, approverName || 'Pejabat Terkait', approverNip || null, approverRole || 'Pejabat BKN', targetId]);

      // Regenerate file notula fisik agar status pending_approval tersimpan ke berkas
      try {
        const notulenRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [targetId]);
        if (notulenRes.rows.length > 0) {
          const doc = notulenRes.rows[0];
          const uploadDir = path.join(process.cwd(), "public", "uploads", "notulen");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const fileName = `notulen_rapat_${doc.meeting_id || doc.id}_${Date.now()}.html`;
          const filePath = path.join(uploadDir, fileName);
          const fileUrl = `/uploads/notulen/${fileName}`;
          const htmlContent = generateNotulenHtmlFile({
            docData: {
              title: doc.title,
              meetingDate: doc.meeting_date,
              meetingTime: doc.meeting_time,
              meetingPlace: doc.meeting_place,
              agenda: safeParseJson(doc.agenda_data),
              attendees: safeParseJson(doc.attendees_data),
              activities: safeParseJson(doc.activities_data),
              actionItems: safeParseJson(doc.action_items),
              conclusions: safeParseJson(doc.conclusions),
              pelaksanaanPembukaan: doc.pelaksanaan_pembukaan,
              pelaksanaanPembahasan: doc.pelaksanaan_pembahasan,
              pelaksanaanDiskusi: doc.pelaksanaan_diskusi,
              pelaksanaanRekomendasi: doc.pelaksanaan_rekomendasi,
              closingText: doc.closing_text,
              documentationPhotos: safeParseJson(doc.documentation_photos),
              kertasKerjaMt: safeParseJson(doc.kertas_kerja_mt, null),
              notulisName: doc.notulis_name,
              notulisNip: doc.notulis_nip,
              notulisRole: doc.notulis_role,
              approverId: doc.approver_id,
              approverName: doc.approver_name,
              approverNip: doc.approver_nip,
              approverRole: doc.approver_role,
              approvalStatus: 'pending_approval'
            },
            user,
            notulenId: doc.id,
            meetingId: doc.meeting_id
          });
          fs.writeFileSync(filePath, htmlContent, "utf-8");
          if (doc.meeting_id) {
            await pool.query("UPDATE meetings SET notulen = $1, notulen_pdf = $1 WHERE meeting_id = $2", [fileUrl, doc.meeting_id]);
          }
        }
      } catch (e) {
        console.warn("Regenerate notulen html warning:", e.message);
      }

      return res.json({
        success: true,
        message: `Notula berhasil diajukan untuk persetujuan dan pengesahan ke ${approverName || 'Pejabat Terkait'}.`
      });
    } catch (err) {
      console.error("submitApproval error:", err);
      return res.status(500).json({ success: false, message: "Gagal mengajukan persetujuan: " + err.message });
    }
  },

  // POST /api/notulen/approve (Pejabat yang Mengetahui menyetujui & mengesahkan notula secara resmi)
  approveNotulen: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const targetId = req.body.id || req.body.notulenId;
      const { notes } = req.body;
      if (!targetId) {
        return res.status(400).json({ success: false, message: "ID notula wajib disertakan." });
      }

      const notulenRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [targetId]);
      if (notulenRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Dokumen notulen tidak ditemukan." });
      }
      const doc = notulenRes.rows[0];

      // Verifikasi hak akses: approver_id atau admin atau pimpinan
      if (user.role !== 'admin' && user.role !== 'pimpinan' && doc.approver_id && String(doc.approver_id) !== String(user.id)) {
        return res.status(403).json({ success: false, message: "Anda tidak memiliki wewenang untuk mengesahkan notula ini." });
      }

      const approverName = doc.approver_name || user.full_name;
      const approverNip = doc.approver_nip || user.nip;
      const approverRole = doc.approver_role || user.division;

      let signaturePath = doc.approver_signature || null;
      const { signature_base64, use_profile_signature, save_to_profile } = req.body;

      // 1. Jika dikirim data signature baru (base64 image)
      if (signature_base64 && signature_base64.startsWith("data:image/")) {
        try {
          const base64Data = signature_base64.replace(/^data:image\/\w+;base64,/, "");
          const uploadDir = path.join(process.cwd(), "public", "uploads", "ttd");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const filename = `ttd_approver_${user.id}_${Date.now()}.png`;
          fs.writeFileSync(path.join(uploadDir, filename), base64Data, "base64");
          signaturePath = `/uploads/ttd/${filename}`;

          // Simpan ke profil akun pejabat jika dipilih
          if (save_to_profile) {
            await pool.query("UPDATE users SET signature_path = $1 WHERE id = $2", [signaturePath, user.id]);
            if (req.user) req.user.signature_path = signaturePath;
          }
        } catch (sigErr) {
          console.error("Gagal menyimpan file signature approver:", sigErr);
        }
      } else if (use_profile_signature && user.signature_path) {
        signaturePath = user.signature_path;
      } else if (!signaturePath && user.signature_path) {
        signaturePath = user.signature_path;
      }

      await pool.query(`
        UPDATE notulen SET
          approval_status = 'approved',
          approved_at = NOW(),
          approver_name = $1,
          approver_nip = $2,
          approver_role = $3,
          approval_notes = $4,
          approver_signature = $5
        WHERE id = $6
      `, [approverName, approverNip, approverRole, notes || null, signaturePath, targetId]);

      // Regenerate berkas fisik notula dengan cap sah resmi
      let fileUrl = null;
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "notulen");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const fileName = `notulen_rapat_${doc.meeting_id || doc.id}_${Date.now()}.html`;
        const filePath = path.join(uploadDir, fileName);
        fileUrl = `/uploads/notulen/${fileName}`;

        const htmlContent = generateNotulenHtmlFile({
          docData: {
            title: doc.title,
            meetingDate: doc.meeting_date,
            meetingTime: doc.meeting_time,
            meetingPlace: doc.meeting_place,
            agenda: safeParseJson(doc.agenda_data),
            attendees: safeParseJson(doc.attendees_data),
            activities: safeParseJson(doc.activities_data),
            actionItems: safeParseJson(doc.action_items),
            conclusions: safeParseJson(doc.conclusions),
            pelaksanaanPembukaan: doc.pelaksanaan_pembukaan,
            pelaksanaanPembahasan: doc.pelaksanaan_pembahasan,
            pelaksanaanDiskusi: doc.pelaksanaan_diskusi,
            pelaksanaanRekomendasi: doc.pelaksanaan_rekomendasi,
            closingText: doc.closing_text,
            documentationPhotos: safeParseJson(doc.documentation_photos),
            kertasKerjaMt: safeParseJson(doc.kertas_kerja_mt, null),
            notulisName: doc.notulis_name,
            notulisNip: doc.notulis_nip,
            notulisRole: doc.notulis_role,
            approvalStatus: 'approved',
            approverId: doc.approver_id || user.id,
            approverName: approverName,
            approverNip: approverNip,
            approverRole: approverRole,
            approvedAt: new Date(),
            approverSignature: signaturePath
          },
          user,
          notulenId: doc.id,
          meetingId: doc.meeting_id
        });

        fs.writeFileSync(filePath, htmlContent, "utf-8");

        // Hubungkan ke rapat di meetings
        if (doc.meeting_id) {
          await pool.query("UPDATE meetings SET notulen = $1, notulen_pdf = $1 WHERE meeting_id = $2", [fileUrl, doc.meeting_id]);
        }
      } catch (fErr) {
        console.warn("⚠️ Gagal regenerate file disahkan:", fErr.message);
      }

      return res.json({
        success: true,
        message: "Notula resmi telah disetujui & disahkan! Dokumen final telah diterbitkan ke Manajemen Meeting.",
        fileUrl
      });
    } catch (err) {
      console.error("approveNotulen error:", err);
      return res.status(500).json({ success: false, message: "Gagal mengesahkan notula: " + err.message });
    }
  },

  // POST /api/notulen/reject (Pejabat mengembalikan notula ke Notulis untuk revisi)
  rejectNotulen: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const targetId = req.body.id || req.body.notulenId;
      const { notes } = req.body;
      if (!targetId) {
        return res.status(400).json({ success: false, message: "ID notula wajib disertakan." });
      }

      const notulenRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [targetId]);
      if (notulenRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Dokumen notulen tidak ditemukan." });
      }
      const doc = notulenRes.rows[0];

      if (user.role !== 'admin' && doc.approver_id && String(doc.approver_id) !== String(user.id)) {
        return res.status(403).json({ success: false, message: "Anda tidak berhak merevisi notula ini." });
      }

      await pool.query(`
        UPDATE notulen SET
          approval_status = 'rejected',
          approval_notes = $1
        WHERE id = $2
      `, [notes || "Perlu revisi pada beberapa bagian catatan.", targetId]);

      return res.json({
        success: true,
        message: "Notula telah dikembalikan ke Notulis dengan catatan revisi."
      });
    } catch (err) {
      console.error("rejectNotulen error:", err);
      return res.status(500).json({ success: false, message: "Gagal memproses pengembalian notula: " + err.message });
    }
  },

  // GET /notulen/preview/:id (Pratinjau Standar Tata Naskah BKN)
  getNotulenPreview: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [id]);
      if (docRes.rows.length === 0) {
        return res.status(404).send("Dokumen notulen tidak ditemukan.");
      }

      const doc = docRes.rows[0];
      const agenda = typeof doc.agenda_data === "string" ? JSON.parse(doc.agenda_data) : doc.agenda_data;
      const attendees = typeof doc.attendees_data === "string" ? JSON.parse(doc.attendees_data) : doc.attendees_data;
      const activities = typeof doc.activities_data === "string" ? JSON.parse(doc.activities_data) : doc.activities_data;
      const actionItems = typeof doc.action_items === "string" ? JSON.parse(doc.action_items) : doc.action_items;
      const conclusions = typeof doc.conclusions === "string" ? JSON.parse(doc.conclusions) : doc.conclusions;
      const documentationPhotos = doc.documentation_photos ? (typeof doc.documentation_photos === "string" ? JSON.parse(doc.documentation_photos) : doc.documentation_photos) : [];
      const rawMt = doc.kertas_kerja_mt;
      const kertasKerjaMt = Array.isArray(rawMt) ? rawMt : (typeof rawMt === "string" ? safeParseJson(rawMt, null) : null);

      const meetingDateObj = new Date(doc.meeting_date);
      const formattedDate = !isNaN(meetingDateObj)
        ? meetingDateObj.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : doc.meeting_date;

      res.render("notulen_preview", {
        title: `Notula - ${doc.title}`,
        user: user,
        doc: {
          ...doc,
          notulisName: doc.notulis_name,
          notulisNip: doc.notulis_nip || user.nip || "",
          notulisRole: doc.notulis_role,
          formattedDate,
          agenda,
          attendees,
          activities,
          actionItems,
          conclusions,
          pelaksanaanPembukaan: doc.pelaksanaan_pembukaan,
          pelaksanaanPembahasan: doc.pelaksanaan_pembahasan,
          pelaksanaanDiskusi: doc.pelaksanaan_diskusi,
          pelaksanaanRekomendasi: doc.pelaksanaan_rekomendasi,
          approvalStatus: doc.approval_status || 'draft',
          approverId: doc.approver_id,
          approverName: doc.approver_name,
          approverNip: doc.approver_nip,
          approverRole: doc.approver_role,
          approvedAt: doc.approved_at,
          approvalNotes: doc.approval_notes,
          documentationPhotos,
          kertasKerjaMt
        }
      });
    } catch (err) {
      console.error("Notulen preview error:", err);
      res.status(500).send("Gagal memuat pratinjau notulen: " + err.message);
    }
  },

  // DELETE /api/notulen/:id
  deleteNotulen: async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM notulen WHERE id = $1", [id]);
      return res.json({ success: true, message: "Notulen berhasil dihapus." });
    } catch (err) {
      console.error("Delete notulen error:", err);
      return res.status(500).json({ success: false, message: "Gagal menghapus notulen." });
    }
  },

  // POST /api/notulen/ai-generate (Ekstraksi Cerdas Catatan Rapat)
  aiGenerateNotulen: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { rawText } = req.body;
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({ success: false, message: "Catatan atau transkrip rapat masih kosong." });
      }

      const generated = await aiService.generateNotulenFromText(rawText, user);
      return res.json({
        success: true,
        message: "Dokumen Notula Kedinasan berhasil disusun otomatis!",
        data: generated
      });
    } catch (err) {
      console.error("aiGenerateNotulen error:", err);
      return res.status(500).json({ success: false, message: "Gagal memproses AI Notulen: " + err.message });
    }
  },

  // POST /api/notulen/parse-transcript-file (Upload DOCX/TXT Transkrip)
  parseTranscriptFile: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Tidak ada berkas yang diunggah." });
      }

      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      let extractedText = "";

      if (ext === ".docx" || ext === ".doc") {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else if (ext === ".pdf") {
        const fileBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
        const result = await parser.getText();
        extractedText = result.text || "";
        if (parser.destroy) {
          try { await parser.destroy(); } catch (e) {}
        }
      } else {
        extractedText = fs.readFileSync(filePath, "utf8");
      }

      try {
        fs.unlinkSync(filePath);
      } catch (cleanErr) {}

      if (!extractedText || !extractedText.trim()) {
        return res.status(400).json({ success: false, message: "Berkas tidak memuat teks yang dapat dibaca." });
      }

      return res.json({
        success: true,
        message: "Berkas transkrip berhasil diekstraksi!",
        text: extractedText.trim()
      });
    } catch (err) {
      console.error("parseTranscriptFile error:", err);
      return res.status(500).json({ success: false, message: "Gagal membaca berkas transkrip: " + err.message });
    }
  },

  // GET /notulen/export-docx/:id (Ekspor Resmi ke Microsoft Word .docx)
  exportDocx: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [id]);
      if (docRes.rows.length === 0) {
        return res.status(404).send("Dokumen notulen tidak ditemukan.");
      }

      const docData = docRes.rows[0];
      const agenda = typeof docData.agenda_data === "string" ? JSON.parse(docData.agenda_data) : docData.agenda_data;
      const attendees = typeof docData.attendees_data === "string" ? JSON.parse(docData.attendees_data) : docData.attendees_data;
      const activities = typeof docData.activities_data === "string" ? JSON.parse(docData.activities_data) : docData.activities_data;
      const actionItems = typeof docData.action_items === "string" ? JSON.parse(docData.action_items) : docData.action_items;
      const conclusions = typeof docData.conclusions === "string" ? JSON.parse(docData.conclusions) : docData.conclusions;

      const meetingDateObj = new Date(docData.meeting_date);
      const formattedDate = !isNaN(meetingDateObj)
        ? meetingDateObj.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : docData.meeting_date;

      const docChildren = [];

      // Lambang Garuda
      const garudaPath = path.join(__dirname, "..", "public", "images", "garuda_pancasila.png");
      if (fs.existsSync(garudaPath)) {
        try {
          const garudaImg = fs.readFileSync(garudaPath);
          docChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: garudaImg,
                  transformation: { width: 75, height: 75 },
                  type: "png"
                })
              ],
              spacing: { after: 200 }
            })
          );
        } catch (e) {
          console.warn("Garuda image embed notice:", e.message);
        }
      }

      // Kop Surat Lembaga
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: user.institution_kop || "BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 60 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: user.kop_address || "Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730", size: 18, font: "Times New Roman" })
          ],
          spacing: { after: 200 }
        })
      );

      // Judul Dokumen Sesuai Format Baru Notula BKN
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "NOTULA", bold: true, size: 26, font: "Times New Roman" })
          ],
          spacing: { after: 60 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `(${docData.title || "JUDUL KEGIATAN"})`, bold: true, size: 24, font: "Times New Roman" })
          ],
          spacing: { after: 140 }
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: `Hari, Tanggal, Waktu : ${formattedDate}, ${docData.meeting_time || "09.00 – 11.30 WIB"}`, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 60 }
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: `Tempat               : ${docData.meeting_place || "Daring melalui Zoom Meeting"}`, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 250 }
        })
      );

      // Helper untuk membuat Kotak Judul Berwarna Abu-Abu (Shaded Box) sesuai template resmi BKN
      function createDocxShadedHeader(titleText) {
        return new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: "D9D9D9" },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
                    left: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
                    right: { style: BorderStyle.SINGLE, size: 4, color: "888888" }
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: titleText, bold: true, size: 22, font: "Times New Roman" })
                      ],
                      spacing: { before: 80, after: 80 }
                    })
                  ]
                })
              ]
            })
          ],
          width: { size: 100, type: WidthType.PERCENTAGE }
        });
      }

      // 1. AGENDA RAPAT
      docChildren.push(createDocxShadedHeader("AGENDA RAPAT"));
      (agenda && agenda.length > 0 ? agenda : ["-"]).forEach(item => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 40, after: 60 }
          })
        );
      });

      // 2. PESERTA RAPAT
      docChildren.push(new Paragraph({ spacing: { before: 140 } }));
      docChildren.push(createDocxShadedHeader("PESERTA RAPAT"));
      (attendees && attendees.length > 0 ? attendees : ["-"]).forEach((item, idx) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 40, after: 60 }
          })
        );
      });

      // 3. PELAKSANAAN (4 Tahapan Resmi BKN)
      docChildren.push(new Paragraph({ spacing: { before: 140 } }));
      docChildren.push(createDocxShadedHeader("PELAKSANAAN"));

      // 3.1 Pembukaan
      const pembukaanText = docData.pelaksanaan_pembukaan || (activities && activities[0]?.points ? activities[0].points.join("\n") : "-");
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "1. Pembukaan", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: pembukaanText, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 120 }
        })
      );

      // 3.2 Pembahasan
      const pembahasanText = docData.pelaksanaan_pembahasan || (activities && activities.length > 1 ? activities.slice(1).map(a => `${a.sectionTitle}:\n${(a.points || []).join("\n")}`).join("\n\n") : (activities && activities.length === 1 && activities[0].points ? activities[0].points.join("\n") : "-"));
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "2. Pembahasan", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: pembahasanText, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 120 }
        })
      );

      // Tabel Kertas Kerja Manajemen Talenta (Khusus Rapat MT)
      const rawMtExport = docData.kertas_kerja_mt;
      const kertasKerjaMtExport = Array.isArray(rawMtExport) ? rawMtExport : (typeof rawMtExport === "string" ? safeParseJson(rawMtExport, null) : null);

      if (kertasKerjaMtExport && kertasKerjaMtExport.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Penyampaian Kertas Kerja Evaluasi Manajemen Talenta", bold: true, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 140, after: 100 }
          })
        );

        const tableRows = [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                width: { size: 600, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, size: 18, font: "Times New Roman" })] })]
              }),
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Komponen Penilaian", bold: true, size: 18, font: "Times New Roman" })] })]
              }),
              new TableCell({
                width: { size: 2900, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Indikator Penilaian", bold: true, size: 18, font: "Times New Roman" })] })]
              }),
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Bukti Output", bold: true, size: 18, font: "Times New Roman" })] })]
              }),
              new TableCell({
                width: { size: 700, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, size: 18, font: "Times New Roman" })] })]
              }),
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                shading: { fill: "D9E2EC" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Keterangan", bold: true, size: 18, font: "Times New Roman" })] })]
              })
            ]
          })
        ];

        let currPilar = "";
        kertasKerjaMtExport.forEach(row => {
          if (row.pilar && row.pilar !== currPilar) {
            currPilar = row.pilar;
            tableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 6,
                    shading: { fill: "FDE8D7" },
                    children: [new Paragraph({ children: [new TextRun({ text: row.pilar, bold: true, size: 18, font: "Times New Roman" })] })]
                  })
                ]
              })
            );
          }

          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 600, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.no || "-"), size: 18, font: "Times New Roman" })] })]
                }),
                new TableCell({
                  width: { size: 2000, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: String(row.komponen || "-"), size: 18, font: "Times New Roman" })] })]
                }),
                new TableCell({
                  width: { size: 2900, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: String(row.indikator || "-"), size: 18, font: "Times New Roman" })] })]
                }),
                new TableCell({
                  width: { size: 2000, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: String(row.buktiOutput || "-"), size: 18, font: "Times New Roman" })] })]
                }),
                new TableCell({
                  width: { size: 700, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.status === "✓" ? "✓" : "-", bold: true, size: 18, font: "Times New Roman" })] })]
                }),
                new TableCell({
                  width: { size: 2000, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: String(row.keterangan || "-"), size: 18, font: "Times New Roman" })] })]
                })
              ]
            })
          );
        });

        docChildren.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        );
      }

      // 3.3 Diskusi / Tanya Jawab
      const diskusiText = docData.pelaksanaan_diskusi || "-";
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "3. Diskusi / Tanya Jawab", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: diskusiText, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 120 }
        })
      );

      // 3.4 Rekomendasi/Tindak Lanjut
      const rekomendasiText = docData.pelaksanaan_rekomendasi || (actionItems && actionItems.length > 0 ? actionItems.map((item, idx) => `${idx + 1}. ${item}`).join("\n") : (conclusions && conclusions.length > 0 ? conclusions.map((item, idx) => `${idx + 1}. ${item}`).join("\n") : "-"));
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "4. Rekomendasi/Tindak Lanjut", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: rekomendasiText, size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 120 }
        })
      );

      // 4. DOKUMENTASI
      docChildren.push(new Paragraph({ spacing: { before: 140 } }));
      docChildren.push(createDocxShadedHeader("DOKUMENTASI"));
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "(Foto, screenshoot, evidence, link dok pendukung, dll)", italics: true, size: 20, color: "555555", font: "Times New Roman" })
          ],
          spacing: { before: 60, after: 120 }
        })
      );

      // Embed Foto Dokumentasi Jika Ada
      const rawPhotos = docData.documentation_photos;
      const documentationPhotos = Array.isArray(rawPhotos) ? rawPhotos : (typeof rawPhotos === "string" ? safeParseJson(rawPhotos, []) : []);
      if (documentationPhotos && documentationPhotos.length > 0) {
        for (let idx = 0; idx < documentationPhotos.length; idx++) {
          const photo = documentationPhotos[idx];
          const rawUrl = typeof photo === "string" ? photo : (photo.url || photo.dataUrl || photo.previewUrl || photo.path || "");
          if (rawUrl) {
            try {
              const cleanRelPath = rawUrl.startsWith("/") ? rawUrl.substring(1) : rawUrl;
              const diskPath = path.join(process.cwd(), "public", cleanRelPath);
              if (fs.existsSync(diskPath)) {
                const imgBuffer = fs.readFileSync(diskPath);
                const ext = path.extname(diskPath).toLowerCase().replace(".", "");
                docChildren.push(
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: imgBuffer,
                        transformation: { width: 380, height: 230 },
                        type: ext === "png" ? "png" : "jpg"
                      })
                    ],
                    spacing: { before: 100, after: 60 }
                  })
                );
                const caption = typeof photo === "object" && photo ? (photo.caption || "") : "";
                if (caption) {
                  docChildren.push(
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: caption, italics: true, size: 18, font: "Times New Roman" })
                      ],
                      spacing: { after: 140 }
                    })
                  );
                }
              }
            } catch (imgErr) {
              console.warn("Embed docx photo warning:", imgErr.message);
            }
          }
        }
      }

      // 5. PENUTUP
      docChildren.push(new Paragraph({ spacing: { before: 140 } }));
      docChildren.push(createDocxShadedHeader("PENUTUP"));
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: docData.closing_text || "Demikian notula ini disusun untuk dipergunakan sebagaimana mestinya.", size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 100, after: 300 }
        })
      );

      // 6. TANDA TANGAN 2 KOLOM (KIRI: Mengetahui, KANAN: Notulis)
      const sigDateOnly = formattedDate.includes(",") ? formattedDate.split(",")[1].trim() : formattedDate;
      const isApproved = docData.approval_status === "approved";
      const approvedDateText = docData.approved_at
        ? new Date(docData.approved_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
        : sigDateOnly;

      const sigTable = new Table({
        rows: [
          new TableRow({
            children: [
              // Kolom Kiri: Mengetahui
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Mengetahui,", size: 22, font: "Times New Roman" })],
                    spacing: { after: 40 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: docData.approver_role || "(Nama Jabatan)", bold: true, size: 22, font: "Times New Roman" })],
                    spacing: { after: 100 }
                  }),
                  ...((() => {
                    if (docData.approver_signature) {
                      try {
                        const cleanSigPath = docData.approver_signature.replace(/^\//, '').split('?')[0];
                        const diskSigPath = path.join(process.cwd(), 'public', cleanSigPath);
                        if (fs.existsSync(diskSigPath)) {
                          const sigData = fs.readFileSync(diskSigPath);
                          return [
                            new Paragraph({
                              children: [
                                new ImageRun({
                                  data: sigData,
                                  transformation: { width: 140, height: 60 }
                                })
                              ],
                              spacing: { before: 80, after: 80 }
                            })
                          ];
                        }
                      } catch (sigErr) {
                        console.warn("Sig embed docx error:", sigErr.message);
                      }
                    }
                    if (isApproved) {
                      return [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "✓ DISAHKAN RESMI (DIGITAL)", bold: true, size: 18, color: "047857", font: "Times New Roman" })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: docData.approver_name || "Pejabat", size: 18, color: "065F46", font: "Times New Roman" })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: approvedDateText, italics: true, size: 16, color: "059669", font: "Times New Roman" })
                          ],
                          spacing: { after: 100 }
                        })
                      ];
                    }
                    return [
                      new Paragraph({
                        children: [new TextRun({ text: "ttd", italics: true, size: 20, color: "777777", font: "Times New Roman" })],
                        spacing: { before: 200, after: 300 }
                      })
                    ];
                  })()),
                  new Paragraph({
                    children: [new TextRun({ text: docData.approver_name || "Nama", bold: true, underline: {}, size: 22, font: "Times New Roman" })]
                  }),
                  ...(docData.approver_nip ? [
                    new Paragraph({
                      children: [new TextRun({
                        text: String(docData.approver_nip).startsWith("NIP")
                          ? String(docData.approver_nip)
                          : `NIP. ${docData.approver_nip}`,
                        size: 20,
                        font: "Times New Roman"
                      })]
                    })
                  ] : [])
                ]
              }),

              // Kolom Kanan: Notulis
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: `${user.sig_city || "Jakarta"}, ${sigDateOnly}`, size: 22, font: "Times New Roman" })],
                    spacing: { after: 40 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Notulis,", bold: true, size: 22, font: "Times New Roman" })],
                    spacing: { after: 100 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "ttd", italics: true, size: 20, color: "777777", font: "Times New Roman" })],
                    spacing: { before: 200, after: 300 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: docData.notulis_name || user.full_name, bold: true, underline: {}, size: 22, font: "Times New Roman" })]
                  }),
                  ...((docData.notulis_nip || user.nip) ? [
                    new Paragraph({
                      children: [new TextRun({
                        text: String(docData.notulis_nip || user.nip).startsWith("NIP")
                          ? String(docData.notulis_nip || user.nip)
                          : `NIP. ${docData.notulis_nip || user.nip}`,
                        size: 20,
                        font: "Times New Roman"
                      })]
                    })
                  ] : []),
                  new Paragraph({
                    children: [new TextRun({ text: docData.notulis_role || user.division, size: 20, font: "Times New Roman" })]
                  })
                ]
              })
            ]
          })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
      });

      docChildren.push(sigTable);

      const wordDoc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children: docChildren
        }]
      });

      const buffer = await Packer.toBuffer(wordDoc);
      const safeTitle = (docData.title || "Notula-BKN").replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 40);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="Notula-${safeTitle}.docx"`);
      return res.send(buffer);
    } catch (err) {
      console.error("exportDocx error:", err);
      res.status(500).send("Gagal membuat dokumen Word: " + err.message);
    }
  },

  generateHtmlDoc: generateNotulenHtmlFile
};

// Fungsi perbaikan otomatis untuk file HTML notulen yang sudah ada jika terdapat broken image (src="undefined")
export async function repairExistingNotulenHtmlFiles() {
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "notulen");
    if (!fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir).filter(f => f.endsWith(".html"));
    for (const file of files) {
      const fullPath = path.join(uploadDir, file);
      let content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes('src="undefined"') || content.includes("src='undefined'")) {
        const m = file.match(/notulen_rapat_([0-9]+)_/);
        const targetId = m ? m[1] : null;
        if (targetId) {
          const r = await pool.query(
            "SELECT * FROM notulen WHERE meeting_id = $1 OR id = $1 ORDER BY id DESC LIMIT 1",
            [targetId]
          );
          if (r.rows.length > 0) {
            const doc = r.rows[0];
            let userObj = {
              full_name: doc.notulis_name || "Pegawai BKN",
              institution: "Kantor Regional V BKN Jakarta",
              division: doc.notulis_role || "Pengembang Sistem",
              sig_city: "Jakarta"
            };
            try {
              const uRes = await pool.query("SELECT * FROM users WHERE id = $1", [doc.user_id]);
              if (uRes.rows.length > 0) userObj = { ...userObj, ...uRes.rows[0] };
            } catch (ue) {}

            const regeneratedHtml = generateNotulenHtmlFile({
              docData: {
                title: doc.title,
                meetingDate: doc.meeting_date,
                meetingTime: doc.meeting_time,
                meetingPlace: doc.meeting_place,
                agenda: typeof doc.agenda_data === "string" ? JSON.parse(doc.agenda_data) : doc.agenda_data,
                attendees: typeof doc.attendees_data === "string" ? JSON.parse(doc.attendees_data) : doc.attendees_data,
                activities: typeof doc.activities_data === "string" ? JSON.parse(doc.activities_data) : doc.activities_data,
                actionItems: typeof doc.action_items === "string" ? JSON.parse(doc.action_items) : doc.action_items,
                conclusions: typeof doc.conclusions === "string" ? JSON.parse(doc.conclusions) : doc.conclusions,
                closingText: doc.closing_text,
                documentationPhotos: doc.documentation_photos ? (typeof doc.documentation_photos === "string" ? JSON.parse(doc.documentation_photos) : doc.documentation_photos) : [],
                notulisName: doc.notulis_name,
                notulisRole: doc.notulis_role
              },
              user: userObj,
              notulenId: doc.id,
              meetingId: doc.meeting_id
            });
            fs.writeFileSync(fullPath, regeneratedHtml, "utf-8");
            console.log(`[Notulen Repair] Berhasil memperbaiki foto dokumentasi pada file ${file}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Notulen Repair Warning]:", err.message);
  }
}

// Jalankan auto-repair 2 detik setelah server berjalan
setTimeout(() => {
  repairExistingNotulenHtmlFiles().catch(() => {});
}, 2000);

export default notulenController;
