import fs from "fs";
import path from "path";
import meetingModel from "../models/meetingModel.js";  
import zoomModel from "../models/zoomModel.js";
import { syncApprovedZoomToMeetings } from "../config/zoom_schema.js";

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

        const meetings = await meetingModel.getAllMeeting();
        
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

export const inputMeeting = async (req,res) => {
    const currentUser = req.user || res.locals.user;
    if (currentUser && currentUser.role !== "admin") {
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Pembuatan rapat langsung hanya diizinkan untuk Admin Tim Sidigi. Silakan ajukan permohonan melalui form Request Zoom."));
    }

    let {m_nama,deskripsi,tanggal,m_tipe} = req.body;
    
    // Normalisasi jika tipe meeting dikirim berupa angka ID atau nama teks
    if (m_tipe === "1") m_tipe = "Rapat Offline";
    else if (m_tipe === "2") m_tipe = "Zoom";
    else if (m_tipe === "3") m_tipe = "Webinar";
    
    console.log("Input Meeting:", { m_nama, deskripsi, tanggal, m_tipe });
    
    await meetingModel.createMeeting({
        m_nama,
        deskripsi,
        tanggal,
        m_tipe,
        user_id: currentUser?.id || "admin"
    });
    console.log("Data meeting berhasil diinput!");

    res.redirect("/manajemenmeeting");
};

// Helper: Menyimpan file Base64 ke folder uploads di server
function saveBase64File(base64Data, subfolder, prefix, meetingId) {
    if (!base64Data || typeof base64Data !== "string") return null;
    if (!base64Data.startsWith("data:")) return base64Data; // sudah path

    try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", subfolder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        let ext = ".png";
        if (base64Data.startsWith("data:image/jpeg") || base64Data.startsWith("data:image/jpg")) ext = ".jpg";
        else if (base64Data.startsWith("data:image/webp")) ext = ".webp";
        else if (base64Data.startsWith("data:application/pdf")) ext = ".pdf";
        else if (base64Data.startsWith("data:video/mp4")) ext = ".mp4";
        else if (base64Data.startsWith("data:video/webm")) ext = ".webm";

        const fileName = `${prefix}_${meetingId}_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        const base64Content = base64Data.replace(/^data:[^;]+;base64,/, "");
        fs.writeFileSync(filePath, Buffer.from(base64Content, "base64"));

        return `/uploads/${subfolder}/${fileName}`;
    } catch (err) {
        console.error("Error saving base64 file:", err);
        return null;
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
            video_url
        } = req.body;

        if (!meeting_id) {
            return res.status(400).json({ success: false, message: "Meeting ID wajib diisi" });
        }

        // Cek hak akses: hanya admin atau pembuat rapat yang berhak mengedit
        if (currentUser.role !== "admin") {
            const currentMeeting = await meetingModel.getMeetingById(meeting_id);
            const creator = currentMeeting?.creator_user_id || currentMeeting?.user_id;
            if (!currentMeeting || creator !== currentUser.id) {
                return res.status(403).json({
                    success: false,
                    message: "Akses ditolak: Anda hanya dapat mengubah rapat yang Anda buat sendiri."
                });
            }
        }

        // Normalisasi tipe meeting
        if (m_tipe === "1") m_tipe = "Rapat Offline";
        else if (m_tipe === "2") m_tipe = "Zoom";
        else if (m_tipe === "3") m_tipe = "Webinar";

        let savedThumbnail = null;
        if (thumbnail && thumbnail.startsWith("data:")) {
            savedThumbnail = saveBase64File(thumbnail, "thumbnails", "thumb", meeting_id);
        } else if (thumbnail) {
            savedThumbnail = thumbnail;
        }

        let savedPdf = null;
        if (notulen_pdf && notulen_pdf.startsWith("data:")) {
            savedPdf = saveBase64File(notulen_pdf, "notulen", "notulen", meeting_id);
        } else if (notulen_pdf) {
            savedPdf = notulen_pdf;
        }

        let savedVideo = null;
        if (video_url && video_url.startsWith("data:")) {
            savedVideo = saveBase64File(video_url, "videos", "video", meeting_id);
        } else if (video_url) {
            savedVideo = video_url;
        }

        const updated = await meetingModel.updateMeeting({
            meeting_id,
            m_nama,
            deskripsi,
            tanggal,
            m_tipe,
            thumbnail: savedThumbnail,
            notulen_pdf: savedPdf,
            video_url: savedVideo
        });

        return res.json({
            success: true,
            message: "Meeting berhasil diperbarui!",
            data: updated
        });
    } catch (err) {
        console.error("Error updateMeetingController:", err);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan server saat memperbarui meeting" });
    }
};