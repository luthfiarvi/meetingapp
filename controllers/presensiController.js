import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import {
    createPresensi,
    getPresensiByMeeting,
    getMeetingById,
    saveSertifikat,
    getNextSertifikatNumber
} from "../models/presensiModel.js";

// Helper function: Convert Base64 signature to physical PNG file (Nama file: NIP & ID Rapat)
function saveSignatureToFile(signatureData, meeting_id, nip) {
    if (!signatureData) return "";

    // If it's already a saved path or filename, extract just the filename
    if (typeof signatureData === "string" && (signatureData.startsWith("/uploads/") || signatureData.endsWith(".png"))) {
        return path.basename(signatureData);
    }

    try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "ttd");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Format NIP dan ID Rapat fleksibel sesuai rapat yang diikuti
        const cleanNip = nip && String(nip).trim() ? String(nip).trim().replace(/[^a-zA-Z0-9]/g, "") : "tanpanip";
        const cleanMeetingId = meeting_id ? String(meeting_id).trim().replace(/[^a-zA-Z0-9]/g, "") : "0";
        
        // Contoh: ttd_199510102022031005_1.png
        const fileName = `ttd_${cleanNip}_${cleanMeetingId}.png`;
        const fullPath = path.join(uploadDir, fileName);

        const base64Image = signatureData.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(fullPath, Buffer.from(base64Image, "base64"));

        // Mengembalikan NAMA FILE SAJA (NIP & ID Rapat)
        return fileName;
    } catch (err) {
        console.error("Error saving signature file:", err);
        return signatureData; // fallback
    }
}

// ============================================================
// Helper: konversi bulan (1-12) ke angka Romawi
// ============================================================
function toRomanMonth(month) {
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    return romans[(month - 1)] || String(month);
}

// ============================================================
// Helper function: Generate file HTML sertifikat dari template
// ============================================================
async function generateSertifikat({ meeting_id, nama, nip, meetingNama, meetingTanggal }) {
    try {
        const templatePath = path.join(process.cwd(), "public", "uploads", "sertif", "template.html");

        if (!fs.existsSync(templatePath)) {
            console.warn("[SERTIF] Template tidak ditemukan:", templatePath);
            return null;
        }

        // Baca template
        let templateHtml = fs.readFileSync(templatePath, "utf-8");

        // Buat folder subdirektori per meeting jika belum ada
        const sertifDir = path.join(process.cwd(), "public", "uploads", "sertif", String(meeting_id));
        if (!fs.existsSync(sertifDir)) {
            fs.mkdirSync(sertifDir, { recursive: true });
        }

        // ── Siapkan data peserta ──
        const cleanNip  = nip  && String(nip).trim()  ? String(nip).trim()  : "-";
        const cleanNama = nama && String(nama).trim() ? String(nama).trim() : "Peserta";
        const temaWebinar = meetingNama || "Webinar BKN";

        // ── Format tanggal Indonesia ──
        let tanggalStr = "-";
        if (meetingTanggal) {
            const d = new Date(meetingTanggal);
            tanggalStr = d.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }

        // ── Nomor sertifikat format: [urutan]/AKSARA.ASN.05/KRV/[bulan_romawi]/[tahun] ──
        const now         = new Date();
        const tahun       = now.getFullYear();
        const bulanRomawi = toRomanMonth(now.getMonth() + 1);
        const nomorUrut   = await getNextSertifikatNumber();
        const nomorSertifikat = `${nomorUrut}/AKSARA.ASN.05/KRV/${bulanRomawi}/${tahun}`;

        // ── Nama file unik ──
        const timestamp = Date.now();
        const nipClean  = cleanNip.replace(/[^a-zA-Z0-9]/g, "") || "tanpanip";
        const fileName  = `sertif_${nipClean}_${timestamp}.html`;

        // ── URL publik sertifikat (untuk QR Download) ──
        const sertifUrl     = `/uploads/sertif/${meeting_id}/${fileName}`;
        const baseUrl       = process.env.BASE_URL || "http://localhost:3000";
        const fullSertifUrl = `${baseUrl}${sertifUrl}`;

        // ── Generate QR code: Download Link (kiri bawah) ──
        const qrDownloadSrc = await QRCode.toDataURL(fullSertifUrl, {
            width: 240,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
        });

        // ── Generate QR code: TTD Kakanreg (tengah bawah) ──
        const ttdContent = [
            "Ditandatangani secara elektronik oleh:",
            "Myrna Amir, S.E., M.M.",
            "Kepala Kantor Regional V",
            "Badan Kepegawaian Negara",
            `Jakarta, ${tanggalStr}`
        ].join("\n");
        const qrTtdSrc = await QRCode.toDataURL(ttdContent, {
            width: 200,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
        });

        // ── Replace semua placeholder ──
        templateHtml = templateHtml
            .replaceAll("{{NAMA}}",              cleanNama)
            .replaceAll("{{NIP}}",               cleanNip)
            .replaceAll("{{NOMOR_SERTIFIKAT}}",  nomorSertifikat)
            .replaceAll("{{TEMA_WEBINAR}}",      temaWebinar)
            .replaceAll("{{TANGGAL}}",           tanggalStr)
            .replaceAll("{{TAHUN}}",             String(tahun))
            .replaceAll("{{QR_DOWNLOAD_SRC}}",   qrDownloadSrc)
            .replaceAll("{{QR_TTD_SRC}}",        qrTtdSrc);

        // ── Tulis file HTML sertifikat ──
        const filePath = path.join(sertifDir, fileName);
        fs.writeFileSync(filePath, templateHtml, "utf-8");

        // ── Simpan ke database ──
        await saveSertifikat({
            nama: cleanNama,
            nip:  cleanNip,
            meeting_id,
            file_path: sertifUrl
        });

        console.log(`[SERTIF] ✅ Generated: ${sertifUrl}`);
        return sertifUrl;

    } catch (err) {
        console.error("[SERTIF] Error generating sertifikat:", err);
        return null;
    }
}
export const formPresensi = async (req, res) => {
    const { meeting_id } = req.params;
    const status = req.query.status;

    res.render("presensi", {
        meeting_id,
        error: null,
        success: status === "success" ? "Presensi berhasil disimpan!" : null
    });
};

export const inputPresensi = async (req, res) => {
    try {
        const {
            meeting_id,
            nama,
            nip,
            instansi,
            jabatan,
            email,
            keterangan,
            tanda_tangan
        } = req.body;

        const isAjax = req.xhr || 
            req.headers.accept?.includes("application/json") || 
            req.headers["content-type"]?.includes("application/json") ||
            req.headers["x-requested-with"] === "XMLHttpRequest";

        if (!meeting_id || !nama || !tanda_tangan) {
            if (isAjax) {
                return res.status(400).json({
                    success: false,
                    message: "Nama dan tanda tangan wajib diisi."
                });
            }
            return res.status(400).render("presensi", {
                meeting_id,
                error: "Nama dan tanda tangan wajib diisi."
            });
        }

        // 1. Simpan tanda tangan sebagai file gambar fisik di server (Nama file memuat NIP)
        const signatureFileName = saveSignatureToFile(tanda_tangan, meeting_id, nip);

        // 2. Simpan nama file tersebut ke database (PostgreSQL)
        const newPresensi = await createPresensi({
            meeting_id,
            nama,
            nip,
            instansi,
            jabatan,
            email,
            keterangan,
            tanda_tangan: signatureFileName
        });

        // 3. Cek tipe meeting: apakah Webinar?
        let isWebinar = false;
        let sertifUrl = null;

        try {
            const meeting = await getMeetingById(meeting_id);
            if (meeting && meeting.tipe_meeting &&
                meeting.tipe_meeting.toLowerCase().trim() === "webinar") {
                isWebinar = true;
                sertifUrl = await generateSertifikat({
                    meeting_id,
                    nama,
                    nip,
                    meetingNama: meeting.meeting_nama,
                    meetingTanggal: meeting.tanggal
                });
            }
        } catch (sertifErr) {
            console.error("[SERTIF] Gagal proses sertifikat:", sertifErr);
            // Jangan gagalkan presensi jika sertifikat error
        }

        if (isAjax) {
            return res.status(200).json({
                success: true,
                message: "Presensi berhasil disimpan!",
                data: {
                    nama: newPresensi?.nama || nama,
                    waktu_presensi: newPresensi?.waktu_presensi || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    isWebinar,
                    sertifUrl
                }
            });
        }

        return res.redirect(`/presensi/${meeting_id}?status=success`);

    } catch (err) {
        console.error("Error input presensi:", err);

        const isAjax = req.xhr || 
            req.headers.accept?.includes("application/json") || 
            req.headers["content-type"]?.includes("application/json") ||
            req.headers["x-requested-with"] === "XMLHttpRequest";

        if (isAjax) {
            return res.status(500).json({
                success: false,
                message: "Terjadi kesalahan saat menyimpan presensi."
            });
        }

        res.status(500).render("presensi", {
            meeting_id: req.body?.meeting_id,
            error: "Terjadi kesalahan saat menyimpan presensi."
        });
    }
};

export const daftarPresensi = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        const dataPresensi = await getPresensiByMeeting(meeting_id);

        res.render("daftarPresensi", {
            meeting_id,
            dataPresensi
        });
    } catch (err) {
        console.error("Error daftar presensi:", err);
        res.status(500).send("Gagal mengambil data presensi");
    }
};
export const showPresensi = async (req, res) => {
    try {
        const { meeting_id } = req.params;

        const dataPresensi = await getPresensiByMeeting(meeting_id);

        res.json(dataPresensi);

    } catch (err) {
        console.error("Error menampilkan presensi:", err);
        res.status(500).json({
            message: "Gagal mengambil data presensi"
        });
    }
};
