import webinarQuizModel from "../models/webinarQuizModel.js";
import pool from "../config/database.js";
import { getRequestById } from "../models/zoomModel.js";

// Helper untuk mengambil judul & metadata meeting/webinar berdasarkan roomId
async function getRoomDetails(roomId) {
    const cleanId = String(roomId || "").trim();
    let title = "Webinar Interaktif BKN";
    let dateStr = "";
    let isWebinar = true;
    let pemohonName = "";
    let pemohonNip = "";
    let pemohonDivisi = "";

    if (cleanId.startsWith("zoom-")) {
        const reqId = cleanId.replace("zoom-", "");
        try {
            const reqData = await getRequestById(reqId);
            if (reqData) {
                title = reqData.judul_rapat || title;
                dateStr = reqData.tanggal_rapat ? new Date(reqData.tanggal_rapat).toLocaleDateString("id-ID") : "";
                pemohonName = reqData.nama_pemohon || "";
                pemohonNip = reqData.nip || "";
                pemohonDivisi = reqData.divisi || "";
            }
        } catch (e) {}
    } else {
        const meetingId = cleanId.replace("m-", "");
        try {
            const r = await pool.query("SELECT * FROM meetings WHERE meeting_id = $1", [meetingId]);
            if (r.rows.length > 0) {
                title = r.rows[0].meeting_nama || title;
                dateStr = r.rows[0].tanggal ? new Date(r.rows[0].tanggal).toLocaleDateString("id-ID") : "";
                if (r.rows[0].zoom_request_id) {
                    const z = await getRequestById(r.rows[0].zoom_request_id);
                    if (z) {
                        pemohonName = z.nama_pemohon || "";
                        pemohonNip = z.nip || "";
                        pemohonDivisi = z.divisi || "";
                    }
                }
            }
        } catch (e) {}
    }

    return {
        title,
        dateStr,
        isWebinar,
        roomId: cleanId,
        pemohon_name: pemohonName,
        pemohon_nip: pemohonNip,
        pemohon_divisi: pemohonDivisi
    };
}

// 1. Tampilan Halaman Publik Peserta (Q&A Slido BKN)
export const renderPublicQuizPage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const currentUser = req.user || res.locals?.user || (req.session?.passport?.user ? await pool.query("SELECT * FROM users WHERE id = $1", [req.session.passport.user]).then(r => r.rows[0]) : null);
        const room = await getRoomDetails(roomId);
        const questions = await webinarQuizModel.getQuestionsByRoom(roomId);

        // Menentukan apakah user yang sedang login berhak menjawab (Narasumber / Admin / Pembuat Rapat)
        let canAnswer = false;
        if (currentUser) {
            if (currentUser.role === "admin") {
                canAnswer = true;
            } else if (room.pemohon_nip && currentUser.nip && String(room.pemohon_nip).trim() === String(currentUser.nip).trim()) {
                canAnswer = true;
            } else if (room.pemohon_name && currentUser.full_name && room.pemohon_name.toLowerCase().trim() === currentUser.full_name.toLowerCase().trim()) {
                canAnswer = true;
            } else if (currentUser.username === "acengpilek" || currentUser.id === "acengpilek") {
                canAnswer = true;
            }
        }

        res.render("webinarQuizPublic", {
            room,
            questions,
            user: currentUser,
            canAnswer,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error("Error loading public Q&A page:", err);
        res.status(500).send("Gagal memuat ruang Q&A: " + err.message);
    }
};

// 2. Peserta Kirim Pertanyaan dari Halaman Publik
export const submitPublicQuestion = async (req, res) => {
    try {
        const { roomId } = req.params;
        let { nama_penanya, instansi, pertanyaan, is_anonim } = req.body;
        const currentUser = req.user || res.locals.user;

        if (is_anonim) {
            nama_penanya = "Peserta Rapat (Anonim)";
            instansi = "";
        } else if (!nama_penanya && currentUser) {
            nama_penanya = currentUser.full_name || currentUser.username || "Pegawai BKN";
            instansi = currentUser.division || currentUser.institution || "BKN";
        }

        if (!pertanyaan || !pertanyaan.trim()) {
            if (req.xhr || req.headers.accept?.includes("json")) {
                return res.status(400).json({ success: false, message: "Pertanyaan tidak boleh kosong!" });
            }
            return res.redirect(`/webinar-quiz/${roomId}?error=` + encodeURIComponent("Pertanyaan tidak boleh kosong!"));
        }

        const newQ = await webinarQuizModel.addQuestion({
            room_id: roomId,
            nama_penanya: (nama_penanya || "Peserta Rapat").trim(),
            instansi: (instansi || "").trim(),
            pertanyaan: pertanyaan.trim(),
            sumber: "public_link"
        });

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ success: true, message: "Pertanyaan berhasil dikirim!", data: newQ });
        }

        return res.redirect(`/webinar-quiz/${roomId}?msg=` + encodeURIComponent("Pertanyaan Anda berhasil diajukan!"));
    } catch (err) {
        console.error("Error submitting public question:", err);
        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.status(500).json({ success: false, message: err.message });
        }
        return res.redirect(`/webinar-quiz/${req.params.roomId}?error=` + encodeURIComponent("Gagal mengajukan pertanyaan: " + err.message));
    }
};

// 2b. Upvote / Like Pertanyaan
export const upvotePublicQuestion = async (req, res) => {
    try {
        const { qId } = req.params;
        const newVotes = await webinarQuizModel.upvoteQuestion(qId);
        return res.json({ success: true, upvotes: newVotes });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Peserta Mengikuti Kuis / Vote Polling
export const submitQuizVote = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { quiz_id, voter_name, selected_option } = req.body;

        if (!selected_option) {
            return res.status(400).json({ success: false, message: "Pilih salah satu jawaban kuis!" });
        }

        await webinarQuizModel.submitQuizVote({
            quiz_id,
            voter_name: voter_name || "Peserta",
            selected_option
        });

        const results = await webinarQuizModel.getQuizResults(quiz_id);
        return res.json({ success: true, message: "Jawaban kuis Anda telah dicatat!", data: results });
    } catch (err) {
        console.error("Error submitting quiz vote:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 4. API Real-time / Polling Data Pertanyaan & Kuis
export const getRoomDataJson = async (req, res) => {
    try {
        const { roomId } = req.params;
        const questions = await webinarQuizModel.getQuestionsByRoom(roomId);
        const activeQuiz = await webinarQuizModel.getActiveQuiz(roomId);
        let quizResults = [];
        if (activeQuiz) {
            quizResults = await webinarQuizModel.getQuizResults(activeQuiz.id);
        }

        return res.json({
            success: true,
            data: {
                questions,
                activeQuiz,
                quizResults
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Admin Menjawab Pertanyaan
export const adminAnswerQuestion = async (req, res) => {
    try {
        const { id, roomId, jawaban, dijawab_oleh } = req.body;
        if (!id || !jawaban || !jawaban.trim()) {
            return res.status(400).json({ success: false, message: "ID pertanyaan dan teks jawaban wajib diisi!" });
        }

        const currentUser = req.user || res.locals?.user || (req.session?.passport?.user ? await pool.query("SELECT * FROM users WHERE id = $1", [req.session.passport.user]).then(r => r.rows[0]) : null);
        const responderName = (currentUser?.full_name || currentUser?.username || dijawab_oleh || "Narasumber BKN");

        const updated = await webinarQuizModel.answerQuestion(id, {
            jawaban: jawaban.trim(),
            dijawab_oleh: responderName
        });

        return res.json({ success: true, message: "Jawaban berhasil disimpan!", data: updated });
    } catch (err) {
        console.error("Error answering question:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 6. Admin Tambah Pertanyaan dari Chat Zoom
export const adminAddZoomChatQuestion = async (req, res) => {
    try {
        const { roomId, nama_penanya, instansi, pertanyaan } = req.body;
        if (!roomId || !pertanyaan || !pertanyaan.trim()) {
            return res.status(400).json({ success: false, message: "Ruang dan pertanyaan wajib diisi!" });
        }

        const newQ = await webinarQuizModel.addQuestion({
            room_id: roomId,
            nama_penanya: (nama_penanya || "Peserta Zoom").trim(),
            instansi: (instansi || "").trim(),
            pertanyaan: pertanyaan.trim(),
            sumber: "zoom_chat"
        });

        return res.json({ success: true, message: "Pertanyaan dari chat Zoom berhasil dicatat!", data: newQ });
    } catch (err) {
        console.error("Error adding zoom chat question:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 7. Admin Hapus Pertanyaan
export const adminDeleteQuestion = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, message: "ID tidak valid!" });

        await webinarQuizModel.deleteQuestion(id);
        return res.json({ success: true, message: "Pertanyaan berhasil dihapus!" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 8. Admin Buat Kuis / Polling Baru
export const adminCreateQuiz = async (req, res) => {
    try {
        const { roomId, judul_kuis, opsi_jawaban } = req.body;
        if (!roomId || !judul_kuis || !judul_kuis.trim()) {
            return res.status(400).json({ success: false, message: "Judul kuis tidak boleh kosong!" });
        }

        let optionsArray = [];
        if (Array.isArray(opsi_jawaban)) {
            optionsArray = opsi_jawaban.filter(o => o && o.trim());
        } else if (typeof opsi_jawaban === "string") {
            try {
                optionsArray = JSON.parse(opsi_jawaban);
            } catch (e) {
                optionsArray = opsi_jawaban.split("\n").map(s => s.trim()).filter(Boolean);
            }
        }

        if (optionsArray.length < 2) {
            return res.status(400).json({ success: false, message: "Minimal berikan 2 opsi jawaban kuis/polling!" });
        }

        const newQuiz = await webinarQuizModel.createQuiz({
            room_id: roomId,
            judul_kuis: judul_kuis.trim(),
            opsi_jawaban: optionsArray
        });

        return res.json({ success: true, message: "Kuis baru berhasil diaktifkan untuk audiens!", data: newQuiz });
    } catch (err) {
        console.error("Error creating quiz:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
