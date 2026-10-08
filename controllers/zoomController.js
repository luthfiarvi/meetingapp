import zoomModel from "../models/zoomModel.js";
import pool from "../config/database.js";

export const showZoomPage = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user || { role: "user", username: "Pegawai BKN" };
        const isAdmin = currentUser.role === "admin";

        let allRequests = [];
        let myRequests = [];

        if (isAdmin) {
            allRequests = await zoomModel.getAllRequests();
            // Tim Sidigi juga bisa melihat request yang dibuat oleh dirinya sendiri
            myRequests = allRequests.filter(r => r.nip === currentUser.nip || r.nip === currentUser.id);
        } else {
            // User / divisi lain melihat request yang diajukan oleh dirinya/divisinya
            const userNip = currentUser.nip || currentUser.id;
            myRequests = await zoomModel.getRequestsByNip(userNip);
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
            tipe_rapat = "Rapat Biasa"
        } = req.body;

        if (!judul_rapat || !tanggal_rapat) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("Judul rapat dan tanggal pelaksanaan wajib diisi!"));
        }

        const effectiveNip = (nip || currentUser?.nip || currentUser?.id || "").trim();
        const effectiveNama = (nama_pemohon || currentUser?.full_name || currentUser?.username || "Pegawai").trim();
        const effectiveDivisi = (divisi || currentUser?.division || "Kantor Regional V BKN").trim();

        const effectiveUserId = (currentUser?.id || currentUser?.username || "user").trim();

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
            tipe_rapat: tipe_rapat.trim()
        });

        return res.redirect("/request-zoom?msg=" + encodeURIComponent("Permohonan Zoom Meeting berhasil diajukan ke Tim Kerja Sidigi!"));
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

        const { id, zoom_link, meeting_id, passcode, catatan_admin, tipe_rapat, custom_quiz_link } = req.body;

        if (!id) {
            return res.redirect("/request-zoom?error=" + encodeURIComponent("ID Permohonan tidak valid!"));
        }

        const reqData = await zoomModel.getRequestById(id);
        const effectiveTipe = (tipe_rapat || reqData?.tipe_rapat || "Rapat Biasa").trim();

        // Otomatis terbitkan tautan ruang kuis / Slido BKN
        let finalQuizLink = (custom_quiz_link || reqData?.quiz_link || `/webinar-quiz/zoom-${id}`).trim();

        await zoomModel.updateRequestStatus(id, {
            status: "disetujui",
            zoom_link: (zoom_link || "").trim(),
            meeting_id: (meeting_id || "").trim(),
            passcode: (passcode || "").trim(),
            catatan_admin: (catatan_admin || "Disetujui oleh Tim Kerja Sidigi").trim(),
            tipe_rapat: effectiveTipe,
            quiz_link: finalQuizLink
        });

        // Sinkronisasi otomatis ke Manajemen Meeting untuk SEMUA permohonan yang disetujui
        if (reqData) {
            try {
                const reqId = parseInt(id, 10);
                const reqDateStr = reqData.tanggal_rapat instanceof Date 
                    ? reqData.tanggal_rapat.toISOString().split('T')[0] 
                    : String(reqData.tanggal_rapat).split('T')[0];

                const isWebinar = effectiveTipe.toLowerCase().includes("webinar");
                const tipeMeeting = isWebinar ? "Webinar" : "Zoom";

                const timeInfo = (reqData.waktu_mulai && reqData.waktu_selesai) ? `Waktu: ${String(reqData.waktu_mulai).substring(0, 5)} - ${String(reqData.waktu_selesai).substring(0, 5)} WIB. ` : "";
                const pemohonInfo = reqData.nama_pemohon ? `Pemohon: ${reqData.nama_pemohon} (${reqData.divisi || '-'}). ` : "";
                const fullDesc = `${timeInfo}${pemohonInfo}${reqData.keterangan || ''}`.trim() || `Rapat daring resmi BKN via Zoom: ${reqData.judul_rapat}`;

                // Perbaiki sequence ID meetings agar tidak duplicate key
                await pool.query(`
                    SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
                `).catch(() => {});

                const meetingCheck = await pool.query(
                    "SELECT meeting_id FROM meetings WHERE zoom_request_id = $1 OR (meeting_nama = $2 AND tanggal = $3::date)",
                    [reqId, reqData.judul_rapat, reqDateStr]
                );

                if (meetingCheck.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO meetings (
                            meeting_nama, deskripsi, tanggal, tipe_meeting, tgl_buat,
                            zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id
                        ) VALUES ($1, $2, $3::date, $4, CURRENT_DATE, $5, $6, $7, $8)`,
                        [
                            reqData.judul_rapat,
                            fullDesc,
                            reqDateStr,
                            tipeMeeting,
                            (zoom_link || "").trim(),
                            (meeting_id || "").trim(),
                            (passcode || "").trim(),
                            reqId
                        ]
                    );
                    console.log(`✅ [SYNC APPROVE] Rapat "${reqData.judul_rapat}" (${tipeMeeting}) ditambahkan ke Manajemen Meeting.`);
                } else {
                    await pool.query(
                        `UPDATE meetings 
                         SET meeting_nama = $1,
                             deskripsi = $2,
                             tanggal = $3::date,
                             tipe_meeting = $4,
                             zoom_link = $5,
                             zoom_meeting_id = $6,
                             zoom_passcode = $7,
                             zoom_request_id = $8
                         WHERE meeting_id = $9`,
                        [
                            reqData.judul_rapat,
                            fullDesc,
                            reqDateStr,
                            tipeMeeting,
                            (zoom_link || "").trim(),
                            (meeting_id || "").trim(),
                            (passcode || "").trim(),
                            reqId,
                            meetingCheck.rows[0].meeting_id
                        ]
                    );
                    console.log(`✅ [SYNC APPROVE] Rapat "${reqData.judul_rapat}" diperbarui di Manajemen Meeting.`);
                }
            } catch (syncErr) {
                console.error("⚠️ Gagal sinkronisasi rapat ke Manajemen Meeting:", syncErr);
            }
        }

        return res.redirect("/request-zoom?msg=" + encodeURIComponent("Permohonan berhasil disetujui! Link Zoom & Ruang Kuis telah diterbitkan."));
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
