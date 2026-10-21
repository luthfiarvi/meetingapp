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
    .notula-box-header { font-weight: bold; text-transform: uppercase; margin-top: 14px; margin-bottom: 6px; font-size: 11pt; }
    .notula-list { margin: 0 0 14px 20px; padding: 0; }
    .notula-list li { margin-bottom: 4px; text-align: justify; }
    .notula-activity-item { margin-bottom: 12px; }
    .notula-speaker { font-weight: bold; margin-bottom: 3px; }
    .notula-closing { text-align: justify; margin: 14px 0; }
    .notula-signature { width: 280px; margin-left: auto; text-align: left; margin-top: 25px; }
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
      <div class="notula-meta-line">${formattedDate}, Waktu: ${docData.meetingTime || '-'}</div>
      <div class="notula-meta-line">Tempat: ${docData.meetingPlace || '-'}</div>
    </div>

    <div class="notula-box-header">1. AGENDA KEGIATAN</div>
    <ul class="notula-list">
      ${agenda.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <div class="notula-box-header">2. PESERTA / UNSUR YANG HADIR</div>
    <ul class="notula-list">
      ${attendees.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <div class="notula-box-header">3. URAIAN KEGIATAN & PAPARAN</div>
    ${activities.map((act, idx) => `
      <div class="notula-activity-item">
        <div class="notula-speaker">${act.sectionTitle || `${idx + 1}. Paparan`} ${act.speaker ? `(${act.speaker})` : ''}</div>
        <ul class="notula-list">
          ${(act.points || []).map(pt => `<li>${pt}</li>`).join('')}
        </ul>
      </div>
    `).join('')}

    ${kertasKerjaMtHtml}

    <div class="notula-box-header">4. POKOK TINDAK LANJUT</div>
    <ul class="notula-list">
      ${actionItems.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <div class="notula-box-header">5. KESIMPULAN RAPAT</div>
    <ul class="notula-list">
      ${conclusions.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <div class="notula-closing">
      ${docData.closingText || 'Demikian notula rapat kedinasan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.'}
    </div>

    <div class="notula-signature">
      <div>${user.sig_city || 'Jakarta'}, ${formattedDate}</div>
      <div style="margin-top: 4px; font-weight: bold;">Notulis,</div>
      <div style="height: 60px;"></div>
      <div style="font-weight: bold; text-decoration: underline;">${docData.notulisName || user.full_name}</div>
      <div>NIP. ${user.nip || '-'}</div>
      <div style="font-size: 9.5pt; color: #333;">${docData.notulisRole || user.division}</div>
    </div>

    ${processedPhotos.length > 0 ? `
      <div style="margin-top: 30px; page-break-before: auto;">
        <div class="notula-box-header" style="border-top: 1px dashed #ccc; padding-top: 15px;">DOKUMENTASI FOTO KEGIATAN:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
          ${processedPhotos.map(p => `
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; padding: 4px; background: #f8fafc; text-align: center;">
              <img src="${p.src}" style="max-width: 100%; height: 160px; object-fit: cover; border-radius: 4px;" alt="Dokumentasi ${p.index}">
              ${p.caption ? `<div style="font-size: 8.5pt; margin-top: 4px; color: #475569;">${p.caption}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
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
        activities: safeParseJson(latestDoc.activities_data || latestDoc.activities),
        actionItems: safeParseJson(latestDoc.action_items || latestDoc.actionItems),
        conclusions: safeParseJson(latestDoc.conclusions || latestDoc.conclusions),
        closingText: latestDoc.closing_text || latestDoc.closingText || "",
        documentationPhotos: safeParseJson(latestDoc.documentation_photos || latestDoc.documentationPhotos),
        isMt: Boolean(parsedLatestMt && parsedLatestMt.length > 0),
        kertasKerjaMt: parsedLatestMt,
        notulisName: latestDoc.notulis_name || latestDoc.notulisName || user.full_name,
        notulisRole: latestDoc.notulis_role || latestDoc.notulisRole || user.division
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
        closingText: "",
        documentationPhotos: [],
        isMt: false,
        kertasKerjaMt: null,
        notulisName: user.full_name,
        notulisRole: user.division
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
        notulisRole,
        kertasKerjaMt,
        kertas_kerja_mt
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
            kertas_kerja_mt = $15
          WHERE id = $16
        `, [
          title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId,
          mtJson,
          id
        ]);
        savedId = id;
      } else {
        const insertRes = await pool.query(`
          INSERT INTO notulen (
            user_id, title, meeting_date, meeting_time, meeting_place,
            agenda_data, attendees_data, activities_data, action_items, conclusions,
            closing_text, documentation_photos, notulis_name, notulis_role, meeting_id,
            kertas_kerja_mt
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `, [
          String(user?.id || "user"), title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId,
          mtJson
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
            closingText, documentationPhotos: Array.isArray(documentationPhotos) ? documentationPhotos : [],
            kertasKerjaMt: mtArray,
            notulisName, notulisRole
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
          formattedDate,
          agenda,
          attendees,
          activities,
          actionItems,
          conclusions,
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

      // Judul Dokumen
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "NOTULA", bold: true, size: 26, font: "Times New Roman" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `(${docData.title})`, bold: true, size: 22, font: "Times New Roman" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `${formattedDate}, Waktu: ${docData.meeting_time}`, italics: true, size: 20, font: "Times New Roman" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `Tempat: ${docData.meeting_place}`, italics: true, size: 20, font: "Times New Roman" })
          ],
          spacing: { after: 300 }
        })
      );

      // 1. Agenda Kegiatan
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "AGENDA KEGIATAN", bold: true, size: 22, font: "Times New Roman" })
          ],
          border: {
            top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 6, color: "000000" }
          },
          spacing: { before: 200, after: 150 }
        })
      );

      (agenda || []).forEach(item => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { after: 80 }
          })
        );
      });

      // 2. Peserta
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "PESERTA / UNSUR YANG HADIR", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 300, after: 150 }
        })
      );

      (attendees || []).forEach(item => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { after: 80 }
          })
        );
      });

      // 3. Uraian Kegiatan
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "URAIAN KEGIATAN", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 300, after: 150 }
        })
      );

      (activities || []).forEach(act => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: act.sectionTitle, bold: true, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 150, after: 80 }
          })
        );
        (act.points || []).forEach(pt => {
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun({ text: pt, size: 22, font: "Times New Roman" })
              ],
              spacing: { after: 80 }
            })
          );
        });
      });

      // Tabel Kertas Kerja Manajemen Talenta (Khusus Rapat MT)
      const rawMtExport = docData.kertas_kerja_mt;
      const kertasKerjaMtExport = Array.isArray(rawMtExport) ? rawMtExport : (typeof rawMtExport === "string" ? safeParseJson(rawMtExport, null) : null);

      if (kertasKerjaMtExport && kertasKerjaMtExport.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "PENYAMPAIAN KERTAS KERJA EVALUASI MANAJEMEN TALENTA", bold: true, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 300, after: 150 }
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

      // 4. Pokok Tindak Lanjut
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "POKOK TINDAK LANJUT", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 300, after: 150 }
        })
      );

      (actionItems || []).forEach(item => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { after: 80 }
          })
        );
      });

      // 5. Kesimpulan
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "KESIMPULAN", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 300, after: 150 }
        })
      );

      (conclusions || []).forEach(item => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: item, size: 22, font: "Times New Roman" })
            ],
            spacing: { after: 80 }
          })
        );
      });

      // 6. Penutup
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "PENUTUP", bold: true, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: docData.closing_text || "", size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 300 }
        })
      );

      // 7. Dokumentasi Foto Kegiatan (Jika Ada)
      if (documentationPhotos && documentationPhotos.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "DOKUMENTASI FOTO KEGIATAN", bold: true, size: 22, font: "Times New Roman" })
            ],
            spacing: { before: 300, after: 150 }
          })
        );

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
                    spacing: { before: 150, after: 80 }
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
                      spacing: { after: 200 }
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

      // Tanda Tangan
      const sigDateOnly = formattedDate.includes(",") ? formattedDate.split(",")[1].trim() : formattedDate;
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: `${user.sig_city || "Jakarta"}, ${sigDateOnly}`, size: 22, font: "Times New Roman" })
          ],
          spacing: { before: 400 }
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Notulis,", size: 22, font: "Times New Roman" })
          ],
          spacing: { after: 900 }
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: docData.notulis_name || user.full_name, bold: true, underline: {}, size: 22, font: "Times New Roman" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: docData.notulis_role || user.division, size: 20, font: "Times New Roman" })
          ]
        })
      );

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
