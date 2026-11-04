import zoomModel from "../models/zoomModel.js";
import pool from "../config/database.js";
import { syncApprovedZoomToMeetings } from "../config/zoom_schema.js";
import { saveBase64File } from "./meetingController.js";

export const showZoomPage = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user || { role: "user", username: "Pegawai BKN" };
        const isAdmin = currentUser.role === "admin";

        let allRequests = [];
        let myRequests = [];

        if (isAdmin) {
            allRequests = await zoomModel.getAllRequests();
            // Tim Sidigi juga bisa melihat request yang dibuat oleh dirinya sendiri
            const uId = String(currentUser.id || "").trim().toLowerCase();
            const uNip = String(currentUser.nip || "").trim().toLowerCase();
            const uName = String(currentUser.username || "").trim().toLowerCase();
            const uFull = String(currentUser.full_name || "").trim().toLowerCase();

            myRequests = allRequests.filter(r => {
                const rUserId = String(r.user_id || "").trim().toLowerCase();
                const rNip = String(r.nip || "").trim().toLowerCase();
                const rNama = String(r.nama_pemohon || "").trim().toLowerCase();
                return (uId && (rUserId === uId || rNip === uId)) ||
                       (uNip && (rNip === uNip || rUserId === uNip)) ||
                       (uName && (rUserId === uName || rNip === uName)) ||
                       (uFull && rNama === uFull);
            });
        } else {
            // User / divisi lain melihat request yang diajukan oleh dirinya/divisinya
            myRequests = await zoomModel.getRequestsByUser(currentUser);
        }

        // Hitung statistik
        const requestsForStats = isAdmin ? allRequests : myRequests;
        const stats = {
            total: requestsForStats.length,
            menunggu: requestsForStats.filter(r => r.status === "menunggu").length,
            disetujui: requestsForStats.filter(r => r.status === "disetujui").length,
            ditolak: requestsForStats.filter(r => r.status === "ditolak").length
        };

        res.render("requestZoom", {
            title: "Layanan Pengajuan Zoom Meeting - BKN Kanreg V",
            user: currentUser,
            isAdmin,
            allRequests,
            myRequests,
            stats,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error("Error loading zoom page:", err);
        res.render("requestZoom", {
            title: "Layanan Pengajuan Zoom Meeting - BKN Kanreg V",
            user: req.user || res.locals.user || { role: "user" },
            isAdmin: false,
            allRequests: [],
            myRequests: [],
            stats: { total: 0, menunggu: 0, disetujui: 0, ditolak: 0 },
            msg: null,
            error: "Terjadi kesalahan saat memuat data: " + err.message
        });
    }
};

export const submitZoomRequest = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        const {
            nip,
            nama_pemohon,
            divisi,
            judul_rapat,
            tanggal_pengajuan,
            tanggal_rapat,
            waktu_mulai,
            waktu_selesai,
            keterangan,
            tipe_rapat = "Rapat Biasa",
            ruangan = "",
            sertifikat_bg = "",
            sertifikat_signer = "",
            sertifikat_signer_role = "",
            sertifikat_penyelenggara = "",
            sertifikat_enable_ttd,
            sertifikat_layout_mode = "full",
            sertifikat_format_nomor = ""
        } = req.body;

        if (!judul_rapat || !tanggal_rapat) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Judul rapat dan tanggal pelaksanaan wajib diisi!"));
        }

        const effectiveNip = (nip || currentUser?.nip || currentUser?.id || "").trim();
        const effectiveNama = (nama_pemohon || currentUser?.full_name || currentUser?.username || "Pegawai").trim();
        const effectiveDivisi = (divisi || currentUser?.division || "Kantor Regional V BKN").trim();
        const effectiveUserId = (currentUser?.id || currentUser?.username || "user").trim();
        const effectiveTipe = (tipe_rapat || "Rapat Biasa").trim();
        const effectiveRuangan = (ruangan || "").trim();

        let savedSertifBg = sertifikat_bg;
        if (sertifikat_bg && typeof sertifikat_bg === "string" && sertifikat_bg.startsWith("data:")) {
            const saved = saveBase64File(sertifikat_bg, "sertif/bg", "bg_req", effectiveUserId);
            if (saved) savedSertifBg = saved;
        }

        await zoomModel.createRequest({
            user_id: effectiveUserId,
            nip: effectiveNip,
            nama_pemohon: effectiveNama,
            divisi: effectiveDivisi,
            judul_rapat: judul_rapat.trim(),
            tanggal_pengajuan: tanggal_pengajuan || new Date().toISOString().split("T")[0],
            tanggal_rapat,
            waktu_mulai: waktu_mulai || null,
            waktu_selesai: waktu_selesai || null,
            keterangan: (keterangan || "").trim(),
            tipe_rapat: effectiveTipe,
            ruangan: effectiveRuangan,
            sertifikat_bg: savedSertifBg || null,
            sertifikat_signer: sertifikat_signer ? sertifikat_signer.trim() : null,
            sertifikat_signer_role: sertifikat_signer_role ? sertifikat_signer_role.trim() : null,
            sertifikat_penyelenggara: sertifikat_penyelenggara ? sertifikat_penyelenggara.trim() : null,
            sertifikat_enable_ttd: sertifikat_enable_ttd !== undefined ? (sertifikat_enable_ttd === "true" || sertifikat_enable_ttd === true || sertifikat_enable_ttd === "on" || sertifikat_enable_ttd === "1") : true,
            sertifikat_layout_mode: (sertifikat_layout_mode || "full").trim(),
            sertifikat_format_nomor: sertifikat_format_nomor ? sertifikat_format_nomor.trim() : null
        });

        const isOffline = effectiveTipe.toLowerCase().includes("offline");
        const successMsg = isOffline 
            ? "Permohonan Rapat Offline berhasil diajukan ke Tim Kerja Sidigi!" 
            : "Permohonan Zoom Meeting berhasil diajukan ke Tim Kerja Sidigi!";

        return res.redirect("/request-zoom?msg=" + encodeURIComponent(successMsg));
    } catch (err) {
        console.error("Error submitting zoom request:", err);
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Gagal mengajukan permohonan: " + err.message));
    }
};

export const approveZoomRequest = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Hanya Tim Kerja Sidigi (Administrator) yang berhak menyetujui pengajuan!"));
        }

        const { 
            id, 
            zoom_link, 
            meeting_id, 
            passcode, 
            catatan_admin, 
            tipe_rapat, 
            custom_quiz_link, 
            ruangan,
            sertifikat_bg,
            sertifikat_signer,
            sertifikat_signer_role,
            sertifikat_penyelenggara,
            sertifikat_enable_ttd,
            sertifikat_layout_mode,
            sertifikat_format_nomor
        } = req.body;

        if (!id) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("ID Permohonan tidak valid!"));
        }

        const reqData = await zoomModel.getRequestById(id);
        const effectiveTipe = (tipe_rapat || reqData?.tipe_rapat || "Rapat Biasa").trim();
        const isOffline = effectiveTipe.toLowerCase().includes("offline");
        const isWebinar = effectiveTipe.toLowerCase().includes("webinar");
        const effectiveRuangan = (ruangan || reqData?.ruangan || "").trim();

        // Normalisasi URL Zoom agar valid jika diisi
        let normalizedZoomLink = (zoom_link || "").trim();
        if (normalizedZoomLink && !normalizedZoomLink.startsWith("http://") && !normalizedZoomLink.startsWith("https://")) {
            normalizedZoomLink = "https://" + normalizedZoomLink;
        }

        const approvedZoomId = (meeting_id || "").trim();
        const approvedZoomPass = (passcode || "").trim();
        const defaultCatatan = isOffline ? "Disetujui untuk Rapat Tatap Muka." : "Disetujui oleh Admin.";
        const approvedCatatan = (catatan_admin || defaultCatatan).trim();

        let savedApproveBg = sertifikat_bg;
        if (sertifikat_bg && typeof sertifikat_bg === "string" && sertifikat_bg.startsWith("data:")) {
            const saved = saveBase64File(sertifikat_bg, "sertif/bg", "bg_sertif", id);
            if (saved) savedApproveBg = saved;
        }
        const effectiveSertifBg = savedApproveBg || reqData?.sertifikat_bg || null;
        const effectiveSigner = (sertifikat_signer !== undefined && sertifikat_signer !== null && sertifikat_signer !== "") ? sertifikat_signer.trim() : (reqData?.sertifikat_signer || null);
        const effectiveSignerRole = (sertifikat_signer_role !== undefined && sertifikat_signer_role !== null && sertifikat_signer_role !== "") ? sertifikat_signer_role.trim() : (reqData?.sertifikat_signer_role || null);
        const effectivePenyelenggara = (sertifikat_penyelenggara !== undefined && sertifikat_penyelenggara !== null && sertifikat_penyelenggara !== "") ? sertifikat_penyelenggara.trim() : (reqData?.sertifikat_penyelenggara || null);
        const effectiveEnableTtd = sertifikat_enable_ttd !== undefined
            ? (sertifikat_enable_ttd === "true" || sertifikat_enable_ttd === true || sertifikat_enable_ttd === "on" || sertifikat_enable_ttd === "1")
            : (reqData?.sertifikat_enable_ttd !== undefined ? reqData.sertifikat_enable_ttd : true);
        const effectiveLayoutMode = (sertifikat_layout_mode || reqData?.sertifikat_layout_mode || "full").trim();
        const effectiveFormatNomor = (sertifikat_format_nomor !== undefined && sertifikat_format_nomor !== null && sertifikat_format_nomor !== "") 
            ? sertifikat_format_nomor.trim() 
            : (reqData?.sertifikat_format_nomor || null);

        // 1. Pastikan kolom pendukung di kedua tabel siap
        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS ruangan VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS meeting_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS passcode VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS catatan_admin TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS pembuat VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
        `).catch(() => {});

        // Otomatis terbitkan tautan ruang kuis / Slido BKN jika tipe webinar
        let finalQuizLink = isWebinar ? (custom_quiz_link || reqData?.quiz_link || `/webinar-quiz/zoom-${id}`).trim() : null;

        await zoomModel.updateRequestStatus(id, {
            status: "disetujui",
            zoom_link: normalizedZoomLink,
            meeting_id: approvedZoomId,
            passcode: approvedZoomPass,
            catatan_admin: approvedCatatan,
            tipe_rapat: effectiveTipe,
            quiz_link: finalQuizLink,
            ruangan: effectiveRuangan,
            sertifikat_bg: effectiveSertifBg,
            sertifikat_signer: effectiveSigner,
            sertifikat_signer_role: effectiveSignerRole,
            sertifikat_penyelenggara: effectivePenyelenggara,
            sertifikat_enable_ttd: effectiveEnableTtd,
            sertifikat_layout_mode: effectiveLayoutMode,
            sertifikat_format_nomor: effectiveFormatNomor
        });

        // Sinkronisasi otomatis ke Manajemen Meeting untuk SEMUA permohonan yang disetujui
        if (reqData) {
            try {
                const reqId = parseInt(id, 10);
                
                // Format tanggal YYYY-MM-DD lokal aman tanpa pergeseran zona waktu
                let reqDateStr = '';
                if (reqData.tanggal_rapat) {
                    if (typeof reqData.tanggal_rapat === 'string' && reqData.tanggal_rapat.match(/^\d{4}-\d{2}-\d{2}/)) {
                        reqDateStr = reqData.tanggal_rapat.substring(0, 10);
                    } else {
                        const d = new Date(reqData.tanggal_rapat);
                        if (!isNaN(d.getTime())) {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            reqDateStr = `${y}-${m}-${day}`;
                        } else {
                            reqDateStr = String(reqData.tanggal_rapat).split('T')[0];
                        }
                    }
                }

                const tipeMeeting = isOffline ? "1" : (isWebinar ? "3" : "2");

                const timeInfo = (reqData.waktu_mulai && reqData.waktu_selesai) ? `Waktu: ${String(reqData.waktu_mulai).substring(0, 5)} - ${String(reqData.waktu_selesai).substring(0, 5)} WIB. ` : "";
                const pemohonInfo = reqData.nama_pemohon ? `Pemohon: ${reqData.nama_pemohon} (${reqData.divisi || '-'}). ` : "";
                const ruanganInfo = effectiveRuangan ? `Ruang: ${effectiveRuangan}. ` : (reqData.ruangan ? `Ruang: ${reqData.ruangan}. ` : "");
                const defaultDesc = isOffline ? `Rapat tatap muka resmi BKN: ${reqData.judul_rapat}` : `Rapat daring resmi BKN via Zoom: ${reqData.judul_rapat}`;
                const fullDesc = `${timeInfo}${pemohonInfo}${ruanganInfo}${reqData.keterangan || ''}`.trim() || defaultDesc;

                // Perbaiki sequence ID meetings agar tidak duplicate key
                await pool.query(`
                    SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
                `).catch(() => {});

                let meetingCheck;
                try {
                    meetingCheck = await pool.query(
                        `SELECT meeting_id FROM meetings 
                         WHERE zoom_request_id = $1 
                            OR (
                                LOWER(TRIM(meeting_nama)) = LOWER(TRIM($2)) 
                                AND (
                                    $3 = ''
                                    OR tanggal::date = $3::date 
                                    OR tanggal::date = ($3::date - 1) 
                                    OR tanggal::date = ($3::date + 1)
                                )
                            )
                         ORDER BY (zoom_request_id = $1) DESC, meeting_id DESC
                         LIMIT 1`,
                        [reqId, reqData.judul_rapat, reqDateStr || '']
                    );
                } catch (checkErr) {
                    meetingCheck = await pool.query(
                        `SELECT meeting_id FROM meetings 
                         WHERE LOWER(TRIM(meeting_nama)) = LOWER(TRIM($1)) 
                            AND (
                                $2 = ''
                                OR tanggal::date = $2::date 
                                OR tanggal::date = ($2::date - 1) 
                                OR tanggal::date = ($2::date + 1)
                            )
                         ORDER BY meeting_id DESC
                         LIMIT 1`,
                        [reqData.judul_rapat, reqDateStr || '']
                    );
                }

                const safeDesc = (fullDesc || reqData.judul_rapat || 'Rapat Daring BKN').substring(0, 250);
                const creator = String(reqData.user_id || reqData.nip || 'user').substring(0, 20);

                if (meetingCheck.rows.length === 0) {
                    try {
                        // Insert ke skema server asli dengan OVERRIDING SYSTEM VALUE
                        await pool.query(
                            `INSERT INTO meetings (
                                meeting_id, meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat,
                                zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id,
                                sertifikat_bg, sertifikat_signer, sertifikat_signer_role, sertifikat_penyelenggara,
                                sertifikat_enable_ttd, sertifikat_layout_mode, sertifikat_format_nomor
                            ) OVERRIDING SYSTEM VALUE
                            VALUES (
                                (SELECT COALESCE(MAX(meeting_id), 0) + 1 FROM meetings),
                                $1, $2, $3::date, $4, $5, CURRENT_DATE,
                                $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                            )`,
                            [
                                reqData.judul_rapat, 
                                safeDesc, 
                                reqDateStr || new Date().toISOString().split('T')[0], 
                                tipeMeeting, 
                                creator, 
                                normalizedZoomLink || null, 
                                approvedZoomId || null, 
                                approvedZoomPass || null, 
                                reqId,
                                effectiveSertifBg || null,
                                effectiveSigner || null,
                                effectiveSignerRole || null,
                                effectivePenyelenggara || null,
                                effectiveEnableTtd,
                                effectiveLayoutMode,
                                effectiveFormatNomor || null
                            ]
                        );
                    } catch (insErr) {
                        try {
                            await pool.query(
                                `INSERT INTO meetings (
                                    meeting_id, meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat,
                                    zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id,
                                    sertifikat_bg, sertifikat_signer, sertifikat_signer_role, sertifikat_penyelenggara,
                                    sertifikat_enable_ttd, sertifikat_layout_mode
                                ) OVERRIDING SYSTEM VALUE
                                VALUES (
                                    (SELECT COALESCE(MAX(meeting_id), 0) + 1 FROM meetings),
                                    $1, $2, $3::date, $4, $5, CURRENT_DATE,
                                    $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                                )`,
                                [
                                    reqData.judul_rapat, 
                                    safeDesc, 
                                    reqDateStr || new Date().toISOString().split('T')[0], 
                                    tipeMeeting, 
                                    creator, 
                                    normalizedZoomLink || null, 
                                    approvedZoomId || null, 
                                    approvedZoomPass || null, 
                                    reqId,
                                    effectiveSertifBg || null,
                                    effectiveSigner || null,
                                    effectiveSignerRole || null,
                                    effectivePenyelenggara || null,
                                    effectiveEnableTtd,
                                    effectiveLayoutMode
                                ]
                            );
                        } catch (insErr2) {
                            try {
                                await pool.query(
                                    `INSERT INTO meetings (
                                        meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat
                                    ) VALUES ($1, $2, $3::date, $4, $5, CURRENT_DATE)`,
                                    [reqData.judul_rapat, safeDesc, reqDateStr || new Date().toISOString().split('T')[0], tipeMeeting, creator]
                                );
                            } catch (fallbackErr) {
                                console.warn("⚠️ Gagal insert meetings fallback:", fallbackErr.message);
                            }
                        }
                    }
                    console.log(`✅ [SYNC APPROVE] Rapat "${reqData.judul_rapat}" ditambahkan ke Manajemen Meeting.`);
                } else {
                    try {
                        await pool.query(
                            `UPDATE meetings 
                             SET deskripsi = $1,
                                 tipe_meeting = $2,
                                 zoom_link = $3,
                                 zoom_meeting_id = $4,
                                 zoom_passcode = $5,
                                 zoom_request_id = $6,
                                 sertifikat_bg = COALESCE($7, sertifikat_bg),
                                 sertifikat_signer = COALESCE($8, sertifikat_signer),
                                 sertifikat_signer_role = COALESCE($9, sertifikat_signer_role),
                                 sertifikat_penyelenggara = COALESCE($10, sertifikat_penyelenggara),
                                 sertifikat_enable_ttd = COALESCE($11, sertifikat_enable_ttd),
                                 sertifikat_layout_mode = COALESCE($12, sertifikat_layout_mode),
                                 sertifikat_format_nomor = COALESCE($13, sertifikat_format_nomor)
                             WHERE meeting_id = $14`,
                            [
                                safeDesc, 
                                tipeMeeting, 
                                normalizedZoomLink || null, 
                                approvedZoomId || null, 
                                approvedZoomPass || null, 
                                reqId, 
                                effectiveSertifBg || null,
                                effectiveSigner || null,
                                effectiveSignerRole || null,
                                effectivePenyelenggara || null,
                                effectiveEnableTtd,
                                effectiveLayoutMode,
                                effectiveFormatNomor || null,
                                meetingCheck.rows[0].meeting_id
                            ]
                        );
                        console.log(`✅ [SYNC APPROVE] Rapat "${reqData.judul_rapat}" diperbarui di Manajemen Meeting.`);
                    } catch (updErr) {
                        await pool.query(
                            `UPDATE meetings 
                             SET deskripsi = $1,
                                 tipe_meeting = $2
                             WHERE meeting_id = $3`,
                            [safeDesc, tipeMeeting, meetingCheck.rows[0].meeting_id]
                        ).catch(() => {});
                    }
                }

                // Panggil sinkronisasi & auto-healing menyeluruh
                await syncApprovedZoomToMeetings().catch(() => {});
            } catch (syncErr) {
                console.error("⚠️ Gagal sinkronisasi rapat ke Manajemen Meeting:", syncErr);
            }
        }

        const successMsg = isOffline 
            ? "Permohonan Rapat Offline berhasil disetujui dan dijadwalkan!" 
            : (isWebinar 
                ? "Permohonan Webinar berhasil disetujui! Link Zoom & Ruang Kuis telah diterbitkan." 
                : "Permohonan Zoom Meeting berhasil disetujui! Link Zoom telah diterbitkan.");
        return res.redirect("/request-zoom?msg=" + encodeURIComponent(successMsg));
    } catch (err) {
        console.error("Error approving zoom request:", err);
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Gagal memproses persetujuan: " + err.message));
    }
};

export const rejectZoomRequest = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Hanya Tim Kerja Sidigi (Administrator) yang berhak memproses pengajuan!"));
        }

        const { id, catatan_admin } = req.body;

        if (!id) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("ID Permohonan tidak valid!"));
        }

        await zoomModel.updateRequestStatus(id, {
            status: "ditolak",
            catatan_admin: (catatan_admin || "Jadwal penuh / tidak memenuhi ketentuan.").trim()
        });

        return res.redirect("/request-zoom?msg=" + encodeURIComponent("Permohonan telah ditolak dengan catatan yang diberikan."));
    } catch (err) {
        console.error("Error rejecting zoom request:", err);
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Gagal memproses penolakan: " + err.message));
    }
};

export const deleteZoomRequest = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        const { id } = req.body;

        if (!id) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("ID Permohonan tidak valid!"));
        }

        const requestData = await zoomModel.getRequestById(id);
        if (!requestData) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Data permohonan tidak ditemukan!"));
        }

        // Hanya admin Sidigi atau pemilik permohonan yang dapat menghapus
        const isOwner = requestData.nip === currentUser.nip || requestData.nip === currentUser.id;
        if (currentUser.role !== "admin" && !isOwner) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Anda tidak memiliki izin menghapus permohonan ini!"));
        }

        await zoomModel.deleteRequest(id);
        return res.redirect("/request-zoom?msg=" + encodeURIComponent("Data permohonan Zoom berhasil dihapus!"));
    } catch (err) {
        console.error("Error deleting zoom request:", err);
        return res.redirect("/request-zoom?error=" + encodeURIComponent("Gagal menghapus data: " + err.message));
    }
};

export default {
    showZoomPage,
    submitZoomRequest,
    approveZoomRequest,
    rejectZoomRequest,
    deleteZoomRequest
};
