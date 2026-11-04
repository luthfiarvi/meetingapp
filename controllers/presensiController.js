import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { getMeetingById } from "../models/meetingModel.js";
import {
    createPresensi,
    getPresensiByMeeting,
    saveSertifikat,
    getNextSertifikatNumber,
    getSertifikatByMeeting
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
export function toRomanMonth(month) {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[(month - 1)] || String(month);
}

// ============================================================
// Helper: Buat format nomor sertifikat default berdasarkan nama & tanggal rapat
// Contoh hasil default: [NOMOR]/AKSARA.07/KR5/X/2026
// ============================================================
export function generateDefaultFormatNomor(meetingNama, meetingTanggal) {
    const d = meetingTanggal ? new Date(meetingTanggal) : new Date();
    const bulanRomawi = toRomanMonth(d.getMonth() + 1);
    const tahun = d.getFullYear() || 2026;

    let kodeKegiatan = "WEBINAR.KR5";
    if (meetingNama) {
        const aksaraMatch = meetingNama.match(/AKSARA\s*(?:vol\.?\s*|volume\s*|\.|\-)?\s*(\d+)/i);
        if (aksaraMatch && aksaraMatch[1]) {
            const volNum = String(aksaraMatch[1]).padStart(2, '0');
            kodeKegiatan = `AKSARA.${volNum}`;
        } else if (/AKSARA/i.test(meetingNama)) {
            kodeKegiatan = "AKSARA";
        }
    }

    return `[NOMOR]/${kodeKegiatan}/KR5/${bulanRomawi}/${tahun}`;
}

// ============================================================
// Helper: Hitung nomor sertifikat final dari pola, nomor urut, dan konteks meeting
// ============================================================
export function formatNomorSertifikat(pattern, nomorUrutStr, meetingNama, meetingTanggal) {
    let fmt = (pattern && String(pattern).trim()) || generateDefaultFormatNomor(meetingNama, meetingTanggal);

    const d = meetingTanggal ? new Date(meetingTanggal) : new Date();
    const bulanRomawi = toRomanMonth(d.getMonth() + 1);
    const tahun = d.getFullYear() || 2026;

    // Evaluasi token bulan dan tahun
    fmt = fmt.replaceAll(/\[BULAN\]|\{BULAN\}|\<BULAN\>/gi, bulanRomawi);
    fmt = fmt.replaceAll(/\[TAHUN\]|\{TAHUN\}|\<TAHUN\>/gi, String(tahun));

    // Evaluasi token nomor urut (contoh: 001, 002...)
    if (/\[NOMOR\]|\{NOMOR\}|\<NOMOR\>/i.test(fmt)) {
        fmt = fmt.replaceAll(/\[NOMOR\]|\{NOMOR\}|\<NOMOR\>/gi, nomorUrutStr);
    } else if (fmt.startsWith("/")) {
        fmt = `${nomorUrutStr}${fmt}`;
    } else {
        fmt = `${nomorUrutStr}/${fmt}`;
    }

    return fmt;
}

// ============================================================
// Helper function: Generate file HTML sertifikat dari template
// ============================================================
export async function generateSertifikat({ meeting_id, nama, nip, meetingNama, meetingTanggal, meetingData = null, overrideFilePath = null, nomorUrut = null }) {
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

        // ── Muat konfigurasi kustom sertifikat meeting jika belum ada ──
        if (!meetingData) {
            try {
                meetingData = await getMeetingById(meeting_id);
            } catch (_) {}
        }

        // ── Siapkan data peserta ──
        const cleanNip = nip && String(nip).trim() ? String(nip).trim() : "-";
        const cleanNama = nama && String(nama).trim() ? String(nama).trim() : "Peserta";
        const temaWebinar = meetingData?.meeting_nama || meetingNama || "Webinar BKN";
        const effectiveDate = meetingData?.tanggal || meetingTanggal;

        // ── Format tanggal Indonesia ──
        let tanggalStr = "-";
        let tahun = 2026;
        if (effectiveDate) {
            const d = new Date(effectiveDate);
            tanggalStr = d.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
            tahun = d.getFullYear() || 2026;
        } else {
            tahun = new Date().getFullYear() || 2026;
        }

        // ── Nomor sertifikat dinamis dengan antrean urut atomic (001, 002...) & format editable ──
        const effectiveNomorUrut = nomorUrut || (await getNextSertifikatNumber(meeting_id));
        const nomorSertifikat = formatNomorSertifikat(
            meetingData?.sertifikat_format_nomor,
            effectiveNomorUrut,
            temaWebinar,
            effectiveDate
        );

        // ── Path & Nama File ──
        let fileName = "";
        let sertifUrl = "";
        if (overrideFilePath) {
            sertifUrl = overrideFilePath;
            fileName = path.basename(overrideFilePath);
        } else {
            const timestamp = Date.now();
            const nipClean = cleanNip.replace(/[^a-zA-Z0-9]/g, "") || "tanpanip";
            fileName = `sertif_${nipClean}_${timestamp}.html`;
            sertifUrl = `/uploads/sertif/${meeting_id}/${fileName}`;
        }

        // ── URL publik sertifikat (untuk QR Download) ──
        const baseUrl = process.env.BASE_URL || "http://localhost:3000";
        const fullSertifUrl = `${baseUrl}${sertifUrl}`;

        const sertifikatBg = meetingData?.sertifikat_bg || meetingData?.mm_sertifikat_bg || "/images/bg-sertifikat.png";
        const signerName = meetingData?.sertifikat_signer || "Myrna Amir, S.E., M.M.";
        const signerRole = meetingData?.sertifikat_signer_role || "Kepala Kantor Regional V";
        const penyelenggara = meetingData?.sertifikat_penyelenggara || "Kantor Regional V BKN";
        const instansiFull = "Badan Kepegawaian Negara";

        const enableTtd = true;
        const layoutMode = meetingData?.sertifikat_layout_mode === "full" ? "mode-full" : "mode-name-only";
        const certClasses = `${layoutMode} with-ttd`.trim();

        // ── Generate QR code: Download Link (kiri bawah) ──
        const qrDownloadSrc = await QRCode.toDataURL(fullSertifUrl, {
            width: 240,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
        });

        // ── Generate QR code: TTD Kakanreg / Pejabat Penandatangan ──
        let qrTtdSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        if (enableTtd) {
            const ttdContent = [
                "Ditandatangani secara elektronik oleh:",
                signerName,
                signerRole,
                instansiFull,
                `Jakarta, ${tanggalStr}`
            ].join("\n");
            qrTtdSrc = await QRCode.toDataURL(ttdContent, {
                width: 200,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'M'
            });
        }

        // Cache-buster timestamp pada background gambar agar browser tidak memuat cache lama
        const bgUrlWithCacheBust = (sertifikatBg && !sertifikatBg.startsWith("data:"))
            ? `${sertifikatBg}${sertifikatBg.includes("?") ? "&" : "?"}v=${Date.now()}`
            : sertifikatBg;

        // ── Replace semua placeholder ──
        templateHtml = templateHtml
            .replaceAll("{{CERT_PAGE_CLASSES}}", certClasses)
            .replaceAll("{{BG_SERTIFIKAT_URL}}", bgUrlWithCacheBust)
            .replaceAll("{{SIGNER_NAME}}", signerName)
            .replaceAll("{{SIGNER_ROLE}}", signerRole)
            .replaceAll("{{PENYELENGGARA}}", penyelenggara)
            .replaceAll("{{NAMA}}", cleanNama)
            .replaceAll("{{NIP}}", cleanNip)
            .replaceAll("{{NOMOR_SERTIFIKAT}}", nomorSertifikat)
            .replaceAll("{{TEMA_WEBINAR}}", temaWebinar)
            .replaceAll("{{TANGGAL}}", tanggalStr)
            .replaceAll("{{TAHUN}}", String(tahun))
            .replaceAll("{{QR_DOWNLOAD_SRC}}", qrDownloadSrc)
            .replaceAll("{{QR_TTD_SRC}}", qrTtdSrc);

        // ── Tulis file HTML sertifikat ──
        const filePath = path.join(sertifDir, fileName);
        fs.writeFileSync(filePath, templateHtml, "utf-8");
        try {
            fs.chmodSync(filePath, 0o666);
        } catch (_) {}

        // ── Simpan ke database jika belum terdaftar ──
        if (!overrideFilePath) {
            await saveSertifikat({
                nama: cleanNama,
                nip: cleanNip,
                meeting_id,
                file_path: sertifUrl
            });
        }

        console.log(`[SERTIF] ✅ Generated/Updated: ${sertifUrl}`);
        return sertifUrl;

    } catch (err) {
        console.error("[SERTIF] Error generating sertifikat:", err);
        return null;
    }
}

// Regenerasi seluruh sertifikat yang telah terbit untuk satu meeting (misal template / format nomor diubah)
export const regenerateAllCertificatesForMeeting = async (meeting_id) => {
    try {
        const meetingData = await getMeetingById(meeting_id);
        if (!meetingData) return false;

        const certs = await getSertifikatByMeeting(meeting_id);
        if (!certs || certs.length === 0) return true;

        for (let i = 0; i < certs.length; i++) {
            const cert = certs[i];
            const nomorUrut = String(i + 1).padStart(3, '0');
            await generateSertifikat({
                meeting_id,
                nama: cert.nama,
                nip: cert.nip,
                meetingNama: meetingData.meeting_nama,
                meetingTanggal: meetingData.tanggal,
                meetingData,
                overrideFilePath: cert.file_path,
                nomorUrut
            });
        }
        console.log(`[SERTIF] ✅ Berhasil memperbarui ${certs.length} file sertifikat untuk meeting #${meeting_id}`);
        return true;
    } catch (err) {
        console.error(`[SERTIF] ❌ Error regenerateAllCertificatesForMeeting:`, err.message);
        return false;
    }
};
export const formPresensi = async (req, res) => {
    const meeting_id = req.params.meeting_id || req.query.meeting_id || "";
    const status = req.query.status;

    let meeting = null;
    if (meeting_id) {
        try {
            meeting = await getMeetingById(meeting_id);
        } catch (e) {
            console.warn("Notice: could not load meeting details for presensi:", e.message);
        }
    }

    res.render("presensi", {
        meeting_id,
        meeting,
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
            nip: nip || "-",
            instansi: instansi || "-",
            jabatan: jabatan || "-",
            email: email || "-",
            keterangan: keterangan || "-",
            tanda_tangan: signatureFileName
        });

        // 3. Cek tipe meeting: apakah Webinar?
        let isWebinar = false;
        let sertifUrl = null;

        try {
            const meeting = await getMeetingById(meeting_id);
            const tipeMeeting = meeting?.tipe_meeting ? String(meeting.tipe_meeting).toLowerCase().trim() : "";
            const isWebinarMeeting = tipeMeeting === "webinar" || tipeMeeting === "3" || tipeMeeting.includes("webinar") || /webinar/i.test(meeting?.meeting_nama || "");
            if (isWebinarMeeting) {
                isWebinar = true;
                sertifUrl = await generateSertifikat({
                    meeting_id,
                    nama,
                    nip,
                    meetingNama: meeting.meeting_nama,
                    meetingTanggal: meeting.tanggal,
                    meetingData: meeting
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
        const [dataPresensi, meeting] = await Promise.all([
            getPresensiByMeeting(meeting_id),
            getMeetingById(meeting_id)
        ]);

        let formattedTanggal = "-";
        if (meeting?.tanggal) {
            const d = new Date(meeting.tanggal);
            formattedTanggal = d.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }

        const todayFormatted = new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        res.render("daftarPresensi", {
            meeting_id,
            dataPresensi: dataPresensi || [],
            meeting: meeting || {},
            formattedTanggal,
            todayFormatted
        });
    } catch (err) {
        console.error("Error daftar presensi:", err);
        res.status(500).send("Gagal mengambil data presensi");
    }
};

export const daftarPresensiPdf = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        const [dataPresensi, meeting] = await Promise.all([
            getPresensiByMeeting(meeting_id),
            getMeetingById(meeting_id)
        ]);

        let formattedTanggal = "-";
        if (meeting?.tanggal) {
            const d = new Date(meeting.tanggal);
            formattedTanggal = d.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }

        const todayFormatted = new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        res.render("daftarPresensiPdf", {
            meeting_id,
            dataPresensi: dataPresensi || [],
            meeting: meeting || {},
            formattedTanggal,
            todayFormatted
        });
    } catch (err) {
        console.error("Error export presensi pdf:", err);
        res.status(500).send("Gagal memuat pratinjau presensi PDF");
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

export const listSertifikatApi = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        let certs = await getSertifikatByMeeting(meeting_id);

        let currentMeeting = null;
        // Auto-heal / sinkronisasi otomatis: terbitkan sertifikat untuk peserta presensi yang belum terbit
        try {
            const meeting = await getMeetingById(meeting_id);
            currentMeeting = meeting;
            const tipeMeeting = meeting?.tipe_meeting ? String(meeting.tipe_meeting).toLowerCase().trim() : "";
            const isWebinarMeeting = tipeMeeting === "webinar" || tipeMeeting === "3" || tipeMeeting.includes("webinar") || /webinar/i.test(meeting?.meeting_nama || "");
            
            if (isWebinarMeeting) {
                const attendees = await getPresensiByMeeting(meeting_id);
                const existingNames = new Set((certs || []).map(c => String(c.nama || '').trim().toLowerCase()));
                let hasNew = false;

                for (const att of (attendees || [])) {
                    const attNama = String(att.nama || '').trim().toLowerCase();
                    if (attNama && !existingNames.has(attNama)) {
                        await generateSertifikat({
                            meeting_id,
                            nama: att.nama,
                            nip: att.nip,
                            meetingNama: meeting.meeting_nama,
                            meetingTanggal: meeting.tanggal,
                            meetingData: meeting
                        });
                        existingNames.add(attNama);
                        hasNew = true;
                    }
                }

                if (hasNew) {
                    certs = await getSertifikatByMeeting(meeting_id);
                }
            }
        } catch (syncErr) {
            console.warn("Notice: auto-sync sertifikat:", syncErr.message);
        }

        res.json({ success: true, data: certs, meeting: currentMeeting });
    } catch (err) {
        console.error("Error listing sertifikat:", err);
        res.status(500).json({ success: false, message: "Gagal memuat sertifikat" });
    }
};

export const previewSertifikat = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        let meeting = null;
        try {
            meeting = await getMeetingById(meeting_id);
        } catch (_) {}

        if (!meeting) {
            meeting = {
                meeting_id,
                meeting_nama: "Webinar Akselerasi Kompetensi dan Sinergi ASN (AKSARA)",
                tanggal: new Date(),
                tipe_meeting: "Webinar",
                sertifikat_bg: "/images/bg-aksara-vol7.png",
                sertifikat_signer: "Myrna Amir, S.E., M.M.",
                sertifikat_signer_role: "Kepala Kantor Regional V",
                sertifikat_penyelenggara: "Kantor Regional V BKN",
                sertifikat_enable_ttd: false,
                sertifikat_layout_mode: "name_only"
            };
        }

        const templatePath = path.join(process.cwd(), "public", "uploads", "sertif", "template.html");
        if (!fs.existsSync(templatePath)) {
            return res.status(404).send("Template sertifikat tidak ditemukan di server");
        }

        let templateHtml = fs.readFileSync(templatePath, "utf-8");

        const sampleNama = req.query.nama || "Dr. H. Ahmad Fauzi, S.Kom., M.M.";
        const sampleNip = req.query.nip || "198701012010121001";
        const temaWebinar = meeting.meeting_nama || "Webinar BKN";

        let tanggalStr = "-";
        if (meeting.tanggal) {
            const d = new Date(meeting.tanggal);
            tanggalStr = d.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }

        const now = new Date();
        const tahun = now.getFullYear();
        const bulanRomawi = toRomanMonth(now.getMonth() + 1);
        const nomorSertifikat = formatNomorSertifikat(
            meeting.sertifikat_format_nomor,
            "001",
            temaWebinar,
            meeting.tanggal
        );

        const sertifikatBg = meeting.sertifikat_bg || meeting.mm_sertifikat_bg || "/images/bg-sertifikat.png";
        const bgUrlWithCacheBust = (sertifikatBg && !sertifikatBg.startsWith("data:"))
            ? `${sertifikatBg}${sertifikatBg.includes("?") ? "&" : "?"}v=${Date.now()}`
            : sertifikatBg;
        const signerName = meeting.sertifikat_signer || "Myrna Amir, S.E., M.M.";
        const signerRole = meeting.sertifikat_signer_role || "Kepala Kantor Regional V";
        const penyelenggara = meeting.sertifikat_penyelenggara || "Kantor Regional V BKN";
        const instansiFull = "Badan Kepegawaian Negara";

        const enableTtd = true;
        const layoutMode = meeting.sertifikat_layout_mode === "full" ? "mode-full" : "mode-name-only";
        const certClasses = `${layoutMode} with-ttd`.trim();

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
        const dummyDownloadUrl = `${baseUrl}/presensi/${meeting_id}`;
        const qrDownloadSrc = await QRCode.toDataURL(dummyDownloadUrl, {
            width: 240,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
        });

        let qrTtdSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        if (enableTtd) {
            const ttdContent = [
                "Ditandatangani secara elektronik oleh:",
                signerName,
                signerRole,
                instansiFull,
                `Jakarta, ${tanggalStr}`
            ].join("\n");
            qrTtdSrc = await QRCode.toDataURL(ttdContent, {
                width: 200,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' }
            });
        }

        templateHtml = templateHtml
            .replaceAll("{{CERT_PAGE_CLASSES}}", certClasses)
            .replaceAll("{{BG_SERTIFIKAT_URL}}", bgUrlWithCacheBust)
            .replaceAll("{{SIGNER_NAME}}", signerName)
            .replaceAll("{{SIGNER_ROLE}}", signerRole)
            .replaceAll("{{PENYELENGGARA}}", penyelenggara)
            .replaceAll("{{NAMA}}", sampleNama)
            .replaceAll("{{NIP}}", sampleNip)
            .replaceAll("{{NOMOR_SERTIFIKAT}}", nomorSertifikat)
            .replaceAll("{{TEMA_WEBINAR}}", temaWebinar)
            .replaceAll("{{TANGGAL}}", tanggalStr)
            .replaceAll("{{TAHUN}}", String(tahun))
            .replaceAll("{{QR_DOWNLOAD_SRC}}", qrDownloadSrc)
            .replaceAll("{{QR_TTD_SRC}}", qrTtdSrc);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return res.send(templateHtml);
    } catch (err) {
        console.error("Error previewSertifikat:", err);
        return res.status(500).send("Error preview sertifikat: " + err.message);
    }
};

// ============================================================
// Unduh Semua Sertifikat dalam 1 Berkas PDF Utuh (Batch PDF)
// ============================================================
export const downloadAllSertifikatPdf = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        const meeting = await getMeetingById(meeting_id).catch(() => null);

        let participants = [];
        const certs = await getSertifikatByMeeting(meeting_id).catch(() => []);
        if (certs && certs.length > 0) {
            participants = certs.map((c, i) => ({
                no: i + 1,
                nip: c.nip,
                nama: c.nama
            }));
        } else {
            const presensi = await getPresensiByMeeting(meeting_id).catch(() => []);
            participants = presensi.map((p, i) => ({
                no: i + 1,
                nip: p.nip,
                nama: p.nama
            }));
        }

        if (participants.length === 0) {
            const jsonPath = path.join(process.cwd(), "peserta_aksara.json");
            if (fs.existsSync(jsonPath)) {
                participants = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            }
        }

        if (participants.length === 0) {
            return res.status(404).send("Belum ada data peserta untuk diunduh sebagai sertifikat PDF.");
        }

        let bgPath = path.join(process.cwd(), "public", "images", "bg-aksara-vol7.png");
        if (!fs.existsSync(bgPath)) {
            bgPath = path.join(process.cwd(), "public", "images", "sertif_vol_7_aksara.jpg");
        }
        if (!fs.existsSync(bgPath)) {
            return res.status(500).send("Berkas template background sertifikat tidak ditemukan.");
        }
        const jpegBuffer = fs.readFileSync(bgPath);

        const { generateCombinedCertificatesPdf } = await import("../services/pdfService.js");
        const pdfBuffer = generateCombinedCertificatesPdf({
            jpegBuffer,
            participants,
            bulanRomawi: "X",
            tahun: 2026,
            meetingTitle: meeting?.meeting_nama || "AKSARA Vol. 7"
        });

        const cleanTitle = (meeting?.meeting_nama || "AKSARA_Vol7")
            .replace(/[^a-zA-Z0-9_\-]/g, "_")
            .substring(0, 35);
        const fileName = `Sertifikat_${cleanTitle}_${participants.length}_Peserta.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.setHeader("Cache-Control", "no-cache");

        return res.send(pdfBuffer);
    } catch (err) {
        console.error("Error downloadAllSertifikatPdf:", err);
        return res.status(500).send("Gagal mengunduh sertifikat PDF: " + err.message);
    }
};

// ============================================================
// Unduh Semua Sertifikat dalam format ZIP (File PDF Individual per Peserta)
// Format nama file: <Nama Peserta>_Aksara Vol.7.pdf
// ============================================================
export const downloadAllSertifikatZip = async (req, res) => {
    try {
        const { meeting_id } = req.params;
        const meeting = await getMeetingById(meeting_id).catch(() => null);

        let participants = [];
        const certs = await getSertifikatByMeeting(meeting_id).catch(() => []);
        if (certs && certs.length > 0) {
            participants = certs.map((c, i) => ({
                no: i + 1,
                nip: c.nip,
                nama: c.nama
            }));
        } else {
            const presensi = await getPresensiByMeeting(meeting_id).catch(() => []);
            participants = presensi.map((p, i) => ({
                no: i + 1,
                nip: p.nip,
                nama: p.nama
            }));
        }

        if (participants.length === 0) {
            const jsonPath = path.join(process.cwd(), "peserta_aksara.json");
            if (fs.existsSync(jsonPath)) {
                participants = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            }
        }

        if (participants.length === 0) {
            return res.status(404).send("Belum ada data peserta untuk diunduh sebagai paket ZIP.");
        }

        let bgPath = path.join(process.cwd(), "public", "images", "bg-aksara-vol7.png");
        if (!fs.existsSync(bgPath)) {
            bgPath = path.join(process.cwd(), "public", "images", "sertif_vol_7_aksara.jpg");
        }
        if (!fs.existsSync(bgPath)) {
            return res.status(500).send("Berkas template background sertifikat tidak ditemukan.");
        }
        const jpegBuffer = fs.readFileSync(bgPath);

        const eventName = "Aksara Vol.7";
        const zipName = `Sertifikat_Peserta_${eventName.replace(/\s+/g, '_')}_${meeting_id}.zip`;

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
        res.setHeader("Cache-Control", "no-cache");

        const { streamCertificatesPdfZip } = await import("../services/zipService.js");
        await streamCertificatesPdfZip({
            outStream: res,
            participants,
            jpegBuffer,
            eventName,
            bulanRomawi: "X",
            tahun: 2026
        });
    } catch (err) {
        console.error("Error downloadAllSertifikatZip:", err);
        if (!res.headersSent) {
            return res.status(500).send("Gagal membuat arsip ZIP sertifikat: " + err.message);
        }
    }
};
