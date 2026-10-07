import pool from "../config/database.js";
import aiService from "../services/aiService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ImageRun } from "docx";
import mammoth from "mammoth";

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
      <a href="/manajemenmeeting" class="btn btn-secondary">
        ← Kembali ke Manajemen Meeting
      </a>
      <a href="/notulen?id=${notulenId || ''}" class="btn btn-secondary">
        ✏️ Edit di App Infografis
      </a>
    </div>
    <div style="display: flex; gap: 0.5rem;">
      ${notulenId ? `<a href="/notulen/export-docx/${notulenId}" class="btn btn-secondary" style="color: #1D4ED8; border-color: #BFDBFE; background: #EFF6FF;">
        📥 Unduh Word (.docx)
      </a>` : ''}
      <button type="button" onclick="window.print()" class="btn btn-primary">
        🖨️ Cetak / Unduh PDF (A4)
      </button>
    </div>
  </div>

  <div class="notula-paper">
    <div class="notula-kop">
      <img src="/images/garuda_pancasila.png" alt="Garuda Pancasila" class="notula-garuda">
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

    ${documentationPhotos.length > 0 ? `
      <div style="margin-top: 30px; page-break-before: auto;">
        <div class="notula-box-header" style="border-top: 1px dashed #ccc; padding-top: 15px;">DOKUMENTASI FOTO KEGIATAN:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
          ${documentationPhotos.map((photo, i) => `
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; padding: 4px; background: #f8fafc; text-align: center;">
              <img src="${photo.dataUrl || photo.previewUrl}" style="max-width: 100%; height: 160px; object-fit: cover; border-radius: 4px;" alt="Dokumentasi ${i + 1}">
              ${photo.caption ? `<div style="font-size: 8.5pt; margin-top: 4px; color: #475569;">${photo.caption}</div>` : ''}
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

      // Ambil daftar rapat BKN dari Manajemen Meeting untuk dropdown integrasi
      let meetingsList = [];
      try {
        const mRes = await pool.query("SELECT meeting_id, meeting_nama, tanggal, tipe_meeting FROM meetings ORDER BY meeting_id DESC");
        meetingsList = mRes.rows;
      } catch (mErr) {
        console.warn("Notice: meetings query err:", mErr.message);
      }

      let latestDoc = null;
      try {
        let docRes;
        if (req.query.id) {
          docRes = await pool.query("SELECT * FROM notulen WHERE id = $1", [req.query.id]);
        } else {
          docRes = await pool.query("SELECT * FROM notulen ORDER BY created_at DESC LIMIT 1");
        }
        latestDoc = docRes.rows[0] || null;
      } catch (dbErr) {
        console.warn("Notice: notulen query err:", dbErr.message);
      }

      let selectedMeetingId = req.query.meetingId || latestDoc?.meeting_id || null;

      const defaultData = latestDoc ? {
        id: latestDoc.id,
        meetingId: latestDoc.meeting_id || null,
        title: latestDoc.title,
        meetingDate: latestDoc.meeting_date,
        formattedDate: formattedDate,
        meetingTime: latestDoc.meeting_time,
        meetingPlace: latestDoc.meeting_place,
        agenda: typeof latestDoc.agenda_data === "string" ? JSON.parse(latestDoc.agenda_data) : latestDoc.agenda_data,
        attendees: typeof latestDoc.attendees_data === "string" ? JSON.parse(latestDoc.attendees_data) : latestDoc.attendees_data,
        activities: typeof latestDoc.activities_data === "string" ? JSON.parse(latestDoc.activities_data) : latestDoc.activities_data,
        actionItems: typeof latestDoc.action_items === "string" ? JSON.parse(latestDoc.action_items) : latestDoc.action_items,
        conclusions: typeof latestDoc.conclusions === "string" ? JSON.parse(latestDoc.conclusions) : latestDoc.conclusions,
        closingText: latestDoc.closing_text,
        documentationPhotos: latestDoc.documentation_photos ? (typeof latestDoc.documentation_photos === "string" ? JSON.parse(latestDoc.documentation_photos) : latestDoc.documentation_photos) : [],
        notulisName: latestDoc.notulis_name || user.full_name,
        notulisRole: latestDoc.notulis_role || user.division
      } : {
        id: null,
        meetingId: null,
        title: "BKN MENYAPA ASN : PENGUATAN IMPLEMENTASI MANAJEMEN TALENTA MELALUI SIMATA DAN MYASN",
        meetingDate: isoDate,
        formattedDate: formattedDate,
        meetingTime: "09.00 - 11.30 WIB",
        meetingPlace: "Daring melalui Zoom Meeting",
        agenda: [
          "Mengikuti kegiatan BKN Menyapa ASN dengan tema penguatan implementasi manajemen talenta melalui SIMATA dan MyASN.",
          "Mendengarkan sambutan dan arahan Kepala BKN mengenai urgensi manajemen talenta, meritokrasi, integritas, dan penempatan talenta sesuai kebutuhan organisasi.",
          "Mendengarkan paparan mengenai pengelolaan talenta berbasis data, pengukuran kinerja dan potensi, serta pemanfaatan ekosistem data yang terintegrasi.",
          "Mendengarkan paparan dan demo layanan MyASN/SIMATA, termasuk cara melihat kotak talenta dan melakukan pemutakhiran data.",
          "Mengikuti sesi tanya jawab mengenai pemutakhiran data, penghargaan, sertifikasi, penugasan tim, umpan balik 360, visibilitas kotak talenta, serta implementasi manajemen talenta di instansi.",
          "Mencatat arahan dan tindak lanjut bagi ASN serta pengelola kepegawaian untuk memastikan data talenta lengkap, valid, dan mutakhir."
        ],
        attendees: [
          "Kepala BKN, Prof. Dr. Zudan Arif Fakrulloh, S.H., M.H.",
          "Direktur Pengembangan Talenta dan Karir ASN, Dr. Samsul Hidayat, S.S., M.PSDM.",
          "Direktur Pengelolaan Sistem Informasi dan Layanan Digitalisasi Manajemen ASN, Bapak Wahyu Firdaus, S.T.",
          "Tim teknis layanan MyASN/SIMATA.",
          "Para pejabat pimpinan tinggi pratama di lingkungan BKN, Kepala Kantor Regional BKN, pengelola/pembina kepegawaian, serta ASN dan perwakilan instansi pusat dan daerah."
        ],
        activities: [
          {
            sectionTitle: "1. Sambutan dan Arahan Kepala BKN",
            speaker: "Prof. Dr. Zudan Arif Fakrulloh, S.H., M.H. (Kepala BKN)",
            points: [
              "Menyampaikan pentingnya pemutakhiran data ASN secara mandiri untuk mendukung akurasi profil talenta nasional.",
              "Menekankan bahwa sistem merit hanya dapat berjalan optimal apabila basis data kinerja dan kompetensi terintegrasi penuh."
            ]
          },
          {
            sectionTitle: "2. Paparan Teknis SIMATA dan MyASN",
            speaker: "Direktur Pengembangan Talenta dan Karir ASN",
            points: [
              "Penjelasan tata cara pemetaan 9 Box kuadran talenta aparatur sipil negara.",
              "Mekanisme penilaian perilaku kerja dan integrasi riwayat pelatihan/sertifikasi."
            ]
          }
        ],
        actionItems: [
          "Melengkapi berkas eviden kinerja tahunan pada portal MyASN sebelum akhir bulan.",
          "Melakukan verifikasi berkas usulan kenaikan jenjang kepegawaian secara berkala.",
          "Mengikuti sosialisasi teknis lanjutan terkait implementasi SI-MATA di tingkat Kantor Regional."
        ],
        conclusions: [
          "Penguatan manajemen talenta berbasis meritokrasi mutlak membutuhkan akurasi data mandiri dari seluruh pegawai.",
          "Kanreg V BKN siap mengawal percepatan integrasi data kepegawaian wilayah kerja DKI Jakarta, Jawa Barat, dan Banten."
        ],
        closingText: "Kegiatan pertemuan kedinasan ditutup pada pukul 11.30 WIB dengan komitmen penuh untuk percepatan tindak lanjut manajemen talenta di lingkungan instansi.",
        documentationPhotos: [],
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

      res.render("notulen", {
        title: "Pembuat Notulen Rapat Kedinasan - BKN",
        user: user,
        initialData: defaultData,
        todayFormatted: formattedDate,
        meetings: meetingsList,
        selectedMeetingId: selectedMeetingId
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
        notulisRole
      } = req.body;

      if (!title || !meetingDate) {
        return res.status(400).json({ success: false, message: "Judul rapat dan tanggal rapat wajib diisi." });
      }

      const targetMeetingId = meetingId ? parseInt(meetingId, 10) : null;
      const agendaJson = JSON.stringify(Array.isArray(agenda) ? agenda : []);
      const attendeesJson = JSON.stringify(Array.isArray(attendees) ? attendees : []);
      const activitiesJson = JSON.stringify(Array.isArray(activities) ? activities : []);
      const actionItemsJson = JSON.stringify(Array.isArray(actionItems) ? actionItems : []);
      const conclusionsJson = JSON.stringify(Array.isArray(conclusions) ? conclusions : []);
      const docsJson = JSON.stringify(Array.isArray(documentationPhotos) ? documentationPhotos : []);

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
            meeting_id = COALESCE($14, meeting_id)
          WHERE id = $15
        `, [
          title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId,
          id
        ]);
        savedId = id;
      } else {
        const insertRes = await pool.query(`
          INSERT INTO notulen (
            user_id, title, meeting_date, meeting_time, meeting_place,
            agenda_data, attendees_data, activities_data, action_items, conclusions,
            closing_text, documentation_photos, notulis_name, notulis_role, meeting_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `, [
          String(user?.id || "user"), title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          targetMeetingId
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
            notulisName, notulisRole
          },
          user,
          notulenId: savedId,
          meetingId: targetMeetingId
        });

        fs.writeFileSync(filePath, htmlContent, "utf-8");

        // Jika rapat tujuan dipilih, simpan nama berkas ke kolom notulen_pdf tabel meetings
        if (targetMeetingId) {
          await pool.query(
            "UPDATE meetings SET notulen_pdf = $1 WHERE meeting_id = $2",
            [fileUrl, targetMeetingId]
          );

          const mQuery = await pool.query(
            "SELECT meeting_nama FROM meetings WHERE meeting_id = $1",
            [targetMeetingId]
          );
          targetMeetingName = mQuery.rows[0]?.meeting_nama || null;
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
          documentationPhotos
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
  }
};

export default notulenController;
