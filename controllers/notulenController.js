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

export const notulenController = {
  // GET /notulen
  getNotulenGenerator: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const today = new Date();
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      const formattedDate = today.toLocaleDateString("id-ID", options);
      const isoDate = today.toISOString().split("T")[0];

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

      const defaultData = latestDoc ? {
        id: latestDoc.id,
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

      res.render("notulen", {
        title: "Pembuat Notulen Rapat Kedinasan - BKN",
        user: user,
        initialData: defaultData,
        todayFormatted: formattedDate
      });
    } catch (err) {
      console.error("Notulen generator error:", err);
      res.status(500).send("Gagal memuat pembuat notulen: " + err.message);
    }
  },

  // POST /api/notulen (Simpan / Perbarui Notulen)
  saveNotulen: async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const {
        id,
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
            notulis_role = $13
          WHERE id = $14
        `, [
          title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division,
          id
        ]);
        savedId = id;
      } else {
        const insertRes = await pool.query(`
          INSERT INTO notulen (
            user_id, title, meeting_date, meeting_time, meeting_place,
            agenda_data, attendees_data, activities_data, action_items, conclusions,
            closing_text, documentation_photos, notulis_name, notulis_role
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `, [
          user.id, title, meetingDate, meetingTime || "-", meetingPlace || "-",
          agendaJson, attendeesJson, activitiesJson, actionItemsJson, conclusionsJson,
          closingText || "", docsJson, notulisName || user.full_name, notulisRole || user.division
        ]);
        savedId = insertRes.rows[0]?.id;
      }

      return res.json({
        success: true,
        message: "Notulen rapat kedinasan berhasil disimpan!",
        id: savedId
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
