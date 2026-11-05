import fs from "fs";
import path from "path";
import pool from "../config/database.js";
import meetingModel from "../models/meetingModel.js";  
import zoomModel from "../models/zoomModel.js";
import { syncApprovedZoomToMeetings } from "../config/zoom_schema.js";
import { regenerateAllCertificatesForMeeting } from "./presensiController.js";

export const formMeeting = (req, res) => {
    const currentUser = req.user || res.locals.user;
    if (currentUser && currentUser.role !== "admin") {
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Pembuatan rapat langsung hanya diizinkan untuk Admin Tim Sidigi. Silakan ajukan permohonan melalui form Request Zoom."));
    }
    res.render("inputrapat");
};

export const showMeeting = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user || { role: "user" };

        // Auto-sinkronisasi pengajuan Zoom yang disetujui (Rapat Biasa & Webinar)
        try {
            await syncApprovedZoomToMeetings();
        } catch (sErr) {
            console.warn("⚠️ [AUTO-SYNC] Warning syncApprovedZoomToMeetings:", sErr.message);
        }

        let meetings = [];
        if (currentUser.role === "pegawai") {
            const uid = currentUser.id || currentUser.username || currentUser.nip;
            meetings = await meetingModel.getPegawaiMeetings(uid);
        } else {
            meetings = await meetingModel.getAllMeeting();
        }
        
        let pendingZoomCount = 0;
        if (currentUser.role === "admin") {
            try {
                const allRequests = await zoomModel.getAllRequests();
                pendingZoomCount = allRequests.filter(r => r.status === "menunggu").length;
            } catch (e) {}
        }

        res.render("meetingmanajemen", { 
            meetings, 
            pendingZoomCount,
            user: currentUser
        });
    } catch (error) {
        console.error("Database Error (showMeeting):", error.message);
        res.render("meetingmanajemen", { 
            meetings: [], 
            pendingZoomCount: 0,
            user: req.user || res.locals.user || { role: "user" }
        });
    }
};

export const inputMeeting = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (currentUser && currentUser.role !== "admin") {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Pembuatan rapat langsung hanya diizinkan untuk Admin Tim Sidigi. Silakan ajukan permohonan melalui form Request Zoom."));
        }

        let { m_nama, deskripsi, tanggal, m_tipe } = req.body;
        
        if (!m_nama || !tanggal) {
            return res.redirect("/manajemenmeeting?error=" + encodeURIComponent("Nama meeting dan tanggal wajib diisi!"));
        }

        // Normalisasi jika tipe meeting dikirim berupa angka ID atau nama teks
        let tipeMeeting = m_tipe || "Rapat Offline";
        if (m_tipe === "1") tipeMeeting = "Rapat Offline";
        else if (m_tipe === "2") tipeMeeting = "Zoom";
        else if (m_tipe === "3") tipeMeeting = "Webinar";
        
        await meetingModel.createMeeting({
            m_nama: m_nama.trim(),
            deskripsi: (deskripsi || "").trim(),
            tanggal,
            m_tipe: tipeMeeting,
            user_id: currentUser?.id || "admin"
        });
        console.log("✅ Data meeting berhasil diinput ke database:", m_nama);

        return res.redirect("/manajemenmeeting?msg=" + encodeURIComponent("Meeting baru berhasil ditambahkan!"));
    } catch (err) {
        console.error("❌ Error in inputMeeting:", err);
        return res.redirect("/manajemenmeeting?error=" + encodeURIComponent("Gagal menambahkan meeting: " + err.message));
    }
};

function parseIndonesianDate(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim();
    if (clean.match(/^\d{4}-\d{2}-\d{2}$/)) return clean;

    const months = {
        januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
        juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const match = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
    if (match) {
        const d = String(match[1]).padStart(2, '0');
        const mKey = match[2].toLowerCase();
        const y = match[3];
        if (months[mKey]) {
            return `${y}-${months[mKey]}-${d}`;
        }
    }

    const dObj = new Date(clean);
    if (!isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return clean;
}

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Helper: Menyimpan file Base64 ke folder uploads di server
export function saveBase64File(base64Data, subfolder, prefix, meetingId, originalFileName = null) {
    if (!base64Data || typeof base64Data !== "string") return null;
    if (!base64Data.startsWith("data:")) return base64Data; // sudah berupa path URL

    try {
        const uploadDir = path.join(projectRoot, "public", "uploads", subfolder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true, mode: 0o777 });
        }

        let ext = ".png";
        const mimeMatch = base64Data.match(/^data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1].toLowerCase() : "";

        if (originalFileName && typeof originalFileName === "string" && path.extname(originalFileName)) {
            ext = path.extname(originalFileName).toLowerCase();
        } else if (mime.includes("jpeg") || mime.includes("jpg")) ext = ".jpg";
        else if (mime.includes("webp")) ext = ".webp";
        else if (mime.includes("gif")) ext = ".gif";
        else if (mime.includes("png")) ext = ".png";
        else if (mime.includes("pdf")) ext = ".pdf";
        else if (mime.includes("powerpoint") || mime.includes("presentation") || mime.includes("ppt")) {
            ext = (mime.includes("presentation") || mime.includes("openxmlformats") || mime.includes("pptx")) ? ".pptx" : ".ppt";
        }
        else if (mime.includes("mp4")) ext = ".mp4";
        else if (mime.includes("webm")) ext = ".webm";
        else if (mime.includes("spreadsheet") || mime.includes("sheet")) ext = ".xlsx";
        else if (mime.includes("excel")) ext = ".xls";
        else if (mime.includes("word") || mime.includes("document")) ext = ".docx";
        else if (mime.includes("csv")) ext = ".csv";
        else if (prefix === "thumb" || prefix === "thumbnail") ext = ".jpg";
        else if (prefix === "notulen") ext = ".pdf";
        else if (prefix === "video") ext = ".mp4";
        else if (prefix === "bahan") ext = ".pdf";

        const fileName = `${prefix}_${meetingId}_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        // Ambil payload base64 secara aman dari data URI
        const commaIdx = base64Data.indexOf(",");
        const base64Content = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data;

        fs.writeFileSync(filePath, Buffer.from(base64Content, "base64"));
        try {
            fs.chmodSync(filePath, 0o666);
        } catch (_) {}

        console.log(`✅ [UPLOAD] Berhasil menyimpan berkas: /uploads/${subfolder}/${fileName}`);
        return `/uploads/${subfolder}/${fileName}`;
    } catch (err) {
        console.error(`❌ [UPLOAD] Gagal menyimpan berkas ${prefix} ke disk:`, err.message);
        // Fallback: simpan base64 data URL langsung ke database agar thumbnail/berkas tidak hilang saat refresh!
        return base64Data;
    }
}

export const updateMeetingController = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user || { role: "user" };
        let {
            meeting_id,
            m_nama,
            deskripsi,
            tanggal,
            m_tipe,
            thumbnail,
            notulen_pdf,
            bahan_rapat,
            bahan_rapat_name,
            video_url,
            absensi,
            zoom_link,
            zoom_meeting_id,
            zoom_passcode,
            sertifikat_bg,
            sertifikat_signer,
            sertifikat_signer_role,
            sertifikat_penyelenggara,
            sertifikat_enable_ttd,
            sertifikat_layout_mode,
            sertifikat_format_nomor
        } = req.body;

        if (!meeting_id) {
            return res.status(400).json({ success: false, message: "Meeting ID wajib diisi" });
        }

        // Validasi sesi pengguna: harus terotentikasi/login untuk mengedit rapat & mengunggah berkas
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Sesi login Anda telah berakhir. Silakan login kembali."
            });
        }

        // Normalisasi tipe meeting
        if (m_tipe === "1") m_tipe = "Rapat Offline";
        else if (m_tipe === "2") m_tipe = "Zoom";
        else if (m_tipe === "3") m_tipe = "Webinar";

        let savedThumbnail = undefined;
        if (thumbnail && thumbnail.startsWith("data:")) {
            savedThumbnail = saveBase64File(thumbnail, "thumbnails", "thumb", meeting_id);
            if (!savedThumbnail) savedThumbnail = thumbnail;
        } else if (thumbnail !== undefined) {
            savedThumbnail = thumbnail;
        }

        let savedPdf = undefined;
        if (notulen_pdf && notulen_pdf.startsWith("data:")) {
            savedPdf = saveBase64File(notulen_pdf, "notulen", "notulen", meeting_id);
            if (!savedPdf) savedPdf = notulen_pdf;
        } else if (notulen_pdf !== undefined) {
            savedPdf = notulen_pdf;
        }

        let savedBahanRapat = undefined;
        if (bahan_rapat && bahan_rapat.startsWith("data:")) {
            savedBahanRapat = saveBase64File(bahan_rapat, "bahan_rapat", "bahan", meeting_id, bahan_rapat_name);
            if (!savedBahanRapat) savedBahanRapat = bahan_rapat;
        } else if (bahan_rapat !== undefined) {
            savedBahanRapat = bahan_rapat;
        }

        let savedVideo = undefined;
        if (video_url && video_url.startsWith("data:")) {
            savedVideo = saveBase64File(video_url, "videos", "video", meeting_id);
            if (!savedVideo) savedVideo = video_url;
        } else if (video_url !== undefined) {
            savedVideo = video_url;
        }

        let savedAbsensi = undefined;
        if (absensi && absensi.startsWith("data:")) {
            savedAbsensi = saveBase64File(absensi, "presensi", "absensi", meeting_id);
            if (!savedAbsensi) savedAbsensi = absensi;
        } else if (absensi !== undefined) {
            savedAbsensi = absensi;
        }

        let savedSertifBg = undefined;
        if (sertifikat_bg && sertifikat_bg.startsWith("data:")) {
            savedSertifBg = saveBase64File(sertifikat_bg, "sertif/bg", "bg_sertif", meeting_id);
            if (!savedSertifBg) savedSertifBg = sertifikat_bg;
        } else if (sertifikat_bg !== undefined) {
            savedSertifBg = sertifikat_bg;
        }

        const safeTanggal = parseIndonesianDate(tanggal);
        const cleanZoomLink = typeof zoom_link === 'string' ? zoom_link.trim() : null;
        const cleanZoomId = typeof zoom_meeting_id === 'string' ? zoom_meeting_id.trim() : null;
        const cleanZoomPass = typeof zoom_passcode === 'string' ? zoom_passcode.trim() : null;

        const updated = await meetingModel.updateMeeting({
            meeting_id,
            m_nama,
            deskripsi,
            tanggal: safeTanggal,
            m_tipe,
            thumbnail: savedThumbnail,
            notulen_pdf: savedPdf,
            bahan_rapat: savedBahanRapat,
            video_url: savedVideo,
            absensi: savedAbsensi,
            zoom_link: cleanZoomLink,
            zoom_meeting_id: cleanZoomId,
            zoom_passcode: cleanZoomPass,
            sertifikat_bg: savedSertifBg,
            sertifikat_signer: sertifikat_signer !== undefined ? sertifikat_signer.trim() : undefined,
            sertifikat_signer_role: sertifikat_signer_role !== undefined ? sertifikat_signer_role.trim() : undefined,
            sertifikat_penyelenggara: sertifikat_penyelenggara !== undefined ? sertifikat_penyelenggara.trim() : undefined,
            sertifikat_enable_ttd: sertifikat_enable_ttd !== undefined ? sertifikat_enable_ttd : undefined,
            sertifikat_layout_mode: sertifikat_layout_mode !== undefined ? sertifikat_layout_mode.trim() : undefined,
            sertifikat_format_nomor: sertifikat_format_nomor !== undefined ? sertifikat_format_nomor.trim() : undefined
        });

        // Jika ada zoom link dan terhubung dengan zoom_requests, sinkronkan juga ke tabel zoom_requests
        if (cleanZoomLink && updated?.zoom_request_id) {
            await pool.query(
                `UPDATE zoom_requests 
                 SET zoom_link = $1, 
                     meeting_id = COALESCE(NULLIF($2, ''), meeting_id), 
                     passcode = COALESCE(NULLIF($3, ''), passcode)
                 WHERE id = $4`,
                [cleanZoomLink, cleanZoomId, cleanZoomPass, updated.zoom_request_id]
            ).catch(() => {});
        } else if (cleanZoomLink && m_nama) {
            await pool.query(
                `UPDATE zoom_requests 
                 SET zoom_link = $1, 
                     meeting_id = COALESCE(NULLIF($2, ''), meeting_id), 
                     passcode = COALESCE(NULLIF($3, ''), passcode)
                 WHERE LOWER(TRIM(judul_rapat)) = LOWER(TRIM($4))`,
                [cleanZoomLink, cleanZoomId, cleanZoomPass, m_nama]
            ).catch(() => {});
        }

        // Regenerasi otomatis seluruh sertifikat yang telah terbit jika template / format nomor / mode diubah
        if (savedSertifBg !== undefined || sertifikat_layout_mode !== undefined || sertifikat_format_nomor !== undefined || sertifikat_signer !== undefined) {
            try {
                await regenerateAllCertificatesForMeeting(meeting_id);
            } catch (rErr) {
                console.warn("⚠️ Warning regenerateAllCertificatesForMeeting:", rErr.message);
            }
        }

        const finalPdf = savedPdf || updated?.notulen_pdf || updated?.notulen || null;
        const finalBahan = savedBahanRapat || updated?.bahan_rapat || null;

        return res.json({
            success: true,
            message: "Meeting berhasil diperbarui!",
            data: {
                ...(updated || {}),
                sertifikat_bg: savedSertifBg || updated?.sertifikat_bg || null,
                sertifikat_enable_ttd: updated?.sertifikat_enable_ttd,
                sertifikat_layout_mode: updated?.sertifikat_layout_mode,
                notulen_pdf: finalPdf,
                notulen: finalPdf,
                bahan_rapat: finalBahan,
                thumbnail: savedThumbnail || updated?.thumbnail || null,
                video_url: savedVideo || updated?.video_url || null,
                absensi: savedAbsensi || updated?.absensi || null
            }
        });
    } catch (err) {
        console.error("Error updateMeetingController:", err);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan server saat memperbarui meeting" });
    }
};

export const getMeetingPhotosController = async (req, res) => {
    try {
        const { meetingId } = req.params;
        if (!meetingId) {
            return res.status(400).json({ success: false, message: "Meeting ID required" });
        }

        let photos = null;

        // 1. Ambil dari tabel meeting_media di PostgreSQL (Prioritas Utama)
        try {
            const mmRes = await pool.query(
                "SELECT documentation_photos FROM meeting_media WHERE meeting_id = $1 LIMIT 1",
                [meetingId]
            );
            if (mmRes.rows.length > 0 && mmRes.rows[0].documentation_photos !== null) {
                const raw = mmRes.rows[0].documentation_photos;
                photos = typeof raw === "string" ? JSON.parse(raw) : raw;
            }
        } catch (_) {}

        // 2. Jika belum ada di meeting_media, cek kolom meetings
        if (photos === null) {
            try {
                const meetingRes = await pool.query(
                    "SELECT documentation_photos FROM meetings WHERE meeting_id = $1 LIMIT 1",
                    [meetingId]
                );
                if (meetingRes.rows.length > 0 && meetingRes.rows[0].documentation_photos !== null) {
                    const raw = meetingRes.rows[0].documentation_photos;
                    photos = typeof raw === "string" ? JSON.parse(raw) : raw;
                }
            } catch (_) {}
        }

        // 3. Jika belum ada, cek di tabel notulen
        if (photos === null && meetingId) {
            try {
                const notulenRes = await pool.query(
                    "SELECT documentation_photos FROM notulen WHERE meeting_id = $1 ORDER BY id DESC LIMIT 1",
                    [meetingId]
                );
                if (notulenRes.rows.length > 0 && notulenRes.rows[0].documentation_photos !== null) {
                    const raw = notulenRes.rows[0].documentation_photos;
                    photos = typeof raw === "string" ? JSON.parse(raw) : raw;
                }
            } catch (_) {}
        }

        // 4. Fallback ke meeting_metadata.json jika DB null
        if (photos === null) {
            const metaFile = path.join(projectRoot, "public", "uploads", "meeting_metadata.json");
            let metaStore = {};
            if (fs.existsSync(metaFile)) {
                try {
                    metaStore = JSON.parse(fs.readFileSync(metaFile, "utf-8") || "{}");
                } catch (_) {}
            }

            const mIdStr = String(meetingId);
            let meeting = null;
            try {
                meeting = await meetingModel.getMeetingById(meetingId);
            } catch (_) {}
            const mNamaKey = (meeting?.meeting_nama || meeting?.m_nama || '').trim().toLowerCase();

            photos = metaStore[mIdStr]?.documentation_photos || (mNamaKey ? metaStore[mNamaKey]?.documentation_photos : null);
        }

        return res.json({
            success: true,
            data: Array.isArray(photos) ? photos : null
        });
    } catch (err) {
        console.error("Error getMeetingPhotosController:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const saveMeetingPhotosController = async (req, res) => {
    try {
        const { meetingId } = req.params;
        let { photos } = req.body;

        if (!meetingId || !Array.isArray(photos)) {
            return res.status(400).json({ success: false, message: "Invalid payload" });
        }

        // Proses setiap foto: jika foto bertipe data: (Base64), simpan berkas fisiknya ke /uploads/evidence/
        const processedPhotos = photos.map((p, idx) => {
            let photoUrl = p.url;
            if (photoUrl && photoUrl.startsWith("data:")) {
                const saved = saveBase64File(photoUrl, "evidence", `doc_${meetingId}_${idx}`, meetingId);
                photoUrl = saved || photoUrl;
            }
            return {
                url: photoUrl,
                caption: p.caption || `Dokumentasi Rapat ${idx + 1}`,
                time: p.time || "WIB"
            };
        });

        // 1. Simpan PERMANEN ke PostgreSQL tabel meeting_media (tabel khusus media)
        try {
            await pool.query(
                `INSERT INTO meeting_media (meeting_id, documentation_photos, updated_at)
                 VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
                 ON CONFLICT (meeting_id) DO UPDATE SET
                     documentation_photos = EXCLUDED.documentation_photos,
                     updated_at = CURRENT_TIMESTAMP`,
                [meetingId, JSON.stringify(processedPhotos)]
            );
            console.log(`✅ [PHOTOS] Tersimpan permanen ke DB meeting_media (${processedPhotos.length} foto) untuk meeting ID: ${meetingId}`);
        } catch (mmErr) {
            console.warn("⚠️ Warning upsert meeting_media:", mmErr.message);
        }

        // 2. Simpan juga ke kolom documentation_photos di meetings jika ada
        try {
            await pool.query(
                `UPDATE meetings 
                 SET documentation_photos = $1::jsonb 
                 WHERE meeting_id = $2`,
                [JSON.stringify(processedPhotos), meetingId]
            );
        } catch (_) {}

        // 3. Sinkronkan juga ke tabel notulen jika ada
        try {
            await pool.query(
                `UPDATE notulen 
                 SET documentation_photos = $1::jsonb 
                 WHERE meeting_id = $2`,
                [JSON.stringify(processedPhotos), meetingId]
            );
        } catch (_) {}

        // 3. Simpan juga ke meeting_metadata.json sebagai backup ganda
        const metaFile = path.join(projectRoot, "public", "uploads", "meeting_metadata.json");
        let metaStore = {};
        if (fs.existsSync(metaFile)) {
            try {
                metaStore = JSON.parse(fs.readFileSync(metaFile, "utf-8") || "{}");
            } catch (_) {}
        }

        const mIdStr = String(meetingId);
        if (!metaStore[mIdStr]) metaStore[mIdStr] = {};
        metaStore[mIdStr].documentation_photos = processedPhotos;

        let meeting = null;
        try {
            meeting = await meetingModel.getMeetingById(meetingId);
        } catch (_) {}
        const mNamaKey = (meeting?.meeting_nama || meeting?.m_nama || '').trim().toLowerCase();
        if (mNamaKey) {
            if (!metaStore[mNamaKey]) metaStore[mNamaKey] = {};
            metaStore[mNamaKey].documentation_photos = processedPhotos;
        }

        try {
            const dir = path.dirname(metaFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
            fs.writeFileSync(metaFile, JSON.stringify(metaStore, null, 2), "utf-8");
        } catch (e) {
            console.warn("⚠️ Warning write meeting_metadata.json:", e.message);
        }

        return res.json({
            success: true,
            message: "Foto dokumentasi berhasil disimpan secara permanen!",
            data: processedPhotos
        });
    } catch (err) {
        console.error("Error saveMeetingPhotosController:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// CONTROLLERS KHUSUS USER PEGAWAI (AGENDA PRIBADI)
export const getAvailableMeetingsPegawaiController = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser) {
            return res.status(401).json({ success: false, message: "Sesi login telah berakhir" });
        }
        const uid = currentUser.id || currentUser.username || currentUser.nip;
        const available = await meetingModel.getAvailableMeetingsForPegawai(uid);
        return res.json({ success: true, data: available });
    } catch (err) {
        console.error("Error getAvailableMeetingsPegawaiController:", err);
        return res.status(500).json({ success: false, message: "Gagal mengambil daftar ruang rapat" });
    }
};

export const enrollMeetingPegawaiController = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser) {
            return res.status(401).json({ success: false, message: "Sesi login telah berakhir" });
        }
        const { meeting_id } = req.body;
        if (!meeting_id) {
            return res.status(400).json({ success: false, message: "Meeting ID wajib disertakan" });
        }
        const uid = currentUser.id || currentUser.username || currentUser.nip;
        await meetingModel.addPegawaiMeeting(uid, meeting_id);
        return res.json({ success: true, message: "Rapat berhasil ditambahkan ke agenda pribadi Anda" });
    } catch (err) {
        console.error("Error enrollMeetingPegawaiController:", err);
        return res.status(500).json({ success: false, message: "Gagal menambahkan rapat ke agenda" });
    }
};

export const unenrollMeetingPegawaiController = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser) {
            return res.status(401).json({ success: false, message: "Sesi login telah berakhir" });
        }
        const { meeting_id } = req.body;
        if (!meeting_id) {
            return res.status(400).json({ success: false, message: "Meeting ID wajib disertakan" });
        }
        const uid = currentUser.id || currentUser.username || currentUser.nip;
        await meetingModel.removePegawaiMeeting(uid, meeting_id);
        return res.json({ success: true, message: "Rapat berhasil dihapus dari agenda pribadi Anda" });
    } catch (err) {
        console.error("Error unenrollMeetingPegawaiController:", err);
        return res.status(500).json({ success: false, message: "Gagal membatalkan keikutsertaan rapat" });
    }
};