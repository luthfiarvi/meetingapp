import pool from "../config/database.js";

// In-memory fallback untuk mode offline/development
const fallbackQuestions = [];
const fallbackQuizzes = [];
const fallbackVotes = [];

// ==========================================
// Q&A / FORUM TANYA JAWAB
// ==========================================

export const addQuestion = async ({ room_id, nama_penanya, instansi, pertanyaan, sumber = "public_link" }) => {
    const cleanRoomId = String(room_id || "").trim();
    const cleanName = (nama_penanya || "Peserta Webinar").trim();
    const cleanInstansi = (instansi || "").trim();
    const cleanQuestion = (pertanyaan || "").trim();

    try {
        const query = `
            INSERT INTO webinar_qa (room_id, nama_penanya, instansi, pertanyaan, sumber, is_answered)
            VALUES ($1, $2, $3, $4, $5, FALSE)
            RETURNING *;
        `;
        const result = await pool.query(query, [cleanRoomId, cleanName, cleanInstansi, cleanQuestion, sumber]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in addQuestion:", err.message);
        const item = {
            id: fallbackQuestions.length + 1,
            room_id: cleanRoomId,
            nama_penanya: cleanName,
            instansi: cleanInstansi,
            pertanyaan: cleanQuestion,
            jawaban: null,
            dijawab_oleh: null,
            sumber,
            is_answered: false,
            created_at: new Date(),
            answered_at: null
        };
        fallbackQuestions.unshift(item);
        return item;
    }
};

export const resolveRoomCandidates = async (roomId) => {
    const raw = String(roomId || "").trim();
    if (!raw) return [];
    const set = new Set([raw]);
    if (raw.startsWith("m-")) {
        const num = raw.replace(/^m-/, "");
        set.add(num);
        try {
            const mRes = await pool.query("SELECT meeting_nama, tanggal, zoom_request_id FROM meetings WHERE meeting_id = $1", [num]);
            if (mRes.rows.length > 0) {
                if (mRes.rows[0].zoom_request_id) {
                    set.add("zoom-" + mRes.rows[0].zoom_request_id);
                }
                const zRes = await pool.query("SELECT id FROM zoom_requests WHERE judul_rapat = $1", [mRes.rows[0].meeting_nama]);
                zRes.rows.forEach(r => set.add("zoom-" + r.id));
            }
        } catch (e) {}
    } else if (raw.startsWith("zoom-")) {
        const num = raw.replace(/^zoom-/, "");
        set.add(num);
        try {
            const mRes = await pool.query("SELECT meeting_id FROM meetings WHERE zoom_request_id = $1", [num]);
            mRes.rows.forEach(r => {
                set.add("m-" + r.meeting_id);
                set.add(String(r.meeting_id));
            });
            const zRes = await pool.query("SELECT judul_rapat FROM zoom_requests WHERE id = $1", [num]);
            if (zRes.rows.length > 0) {
                const mRes2 = await pool.query("SELECT meeting_id FROM meetings WHERE meeting_nama = $1", [zRes.rows[0].judul_rapat]);
                mRes2.rows.forEach(r => {
                    set.add("m-" + r.meeting_id);
                    set.add(String(r.meeting_id));
                });
            }
        } catch (e) {}
    } else {
        set.add("m-" + raw);
        set.add("zoom-" + raw);
    }
    return Array.from(set);
};

export const getQuestionsByRoom = async (room_id) => {
    const cleanRoomId = String(room_id || "").trim();
    try {
        const candidates = await resolveRoomCandidates(cleanRoomId);
        const query = `
            SELECT * FROM webinar_qa 
            WHERE room_id = ANY($1::text[])
            ORDER BY is_answered ASC, created_at DESC;
        `;
        const result = await pool.query(query, [candidates]);
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in getQuestionsByRoom:", err.message);
        return fallbackQuestions.filter(q => q.room_id === cleanRoomId || q.room_id === "m-" + cleanRoomId || q.room_id === "zoom-" + cleanRoomId);
    }
};

export const answerQuestion = async (id, { jawaban, dijawab_oleh }) => {
    const cleanAnswer = (jawaban || "").trim();
    const cleanAnsweredBy = (dijawab_oleh || "Narasumber / Admin").trim();

    try {
        const query = `
            UPDATE webinar_qa
            SET jawaban = $1,
                dijawab_oleh = $2,
                is_answered = TRUE,
                answered_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *;
        `;
        const result = await pool.query(query, [cleanAnswer, cleanAnsweredBy, id]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in answerQuestion:", err.message);
        const item = fallbackQuestions.find(q => q.id === parseInt(id));
        if (item) {
            item.jawaban = cleanAnswer;
            item.dijawab_oleh = cleanAnsweredBy;
            item.is_answered = true;
            item.answered_at = new Date();
        }
        return item;
    }
};

export const deleteQuestion = async (id) => {
    try {
        await pool.query("DELETE FROM webinar_qa WHERE id = $1", [id]);
        return true;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in deleteQuestion:", err.message);
        const idx = fallbackQuestions.findIndex(q => q.id === parseInt(id));
        if (idx !== -1) fallbackQuestions.splice(idx, 1);
        return true;
    }
};

export const upvoteQuestion = async (id) => {
    try {
        const result = await pool.query(
            "UPDATE webinar_qa SET upvotes = COALESCE(upvotes, 0) + 1 WHERE id = $1 RETURNING upvotes",
            [id]
        );
        return result.rows[0]?.upvotes || 1;
    } catch (err) {
        const item = fallbackQuestions.find(q => q.id === parseInt(id));
        if (item) {
            item.upvotes = (item.upvotes || 0) + 1;
            return item.upvotes;
        }
        return 1;
    }
};

// ==========================================
// KUIS / POLLING LIVE
// ==========================================

export const createQuiz = async ({ room_id, judul_kuis, opsi_jawaban }) => {
    const cleanRoomId = String(room_id || "").trim();
    const cleanJudul = (judul_kuis || "").trim();
    const opsiJson = typeof opsi_jawaban === "string" ? opsi_jawaban : JSON.stringify(opsi_jawaban || []);

    try {
        // Nonaktifkan kuis lama di room ini
        await pool.query("UPDATE webinar_quizzes SET is_active = FALSE WHERE room_id = $1", [cleanRoomId]);

        const query = `
            INSERT INTO webinar_quizzes (room_id, judul_kuis, opsi_jawaban, is_active)
            VALUES ($1, $2, $3, TRUE)
            RETURNING *;
        `;
        const result = await pool.query(query, [cleanRoomId, cleanJudul, opsiJson]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in createQuiz:", err.message);
        fallbackQuizzes.forEach(q => { if (q.room_id === cleanRoomId) q.is_active = false; });
        const item = {
            id: fallbackQuizzes.length + 1,
            room_id: cleanRoomId,
            judul_kuis: cleanJudul,
            opsi_jawaban: typeof opsi_jawaban === "string" ? JSON.parse(opsi_jawaban) : opsi_jawaban,
            is_active: true,
            created_at: new Date()
        };
        fallbackQuizzes.unshift(item);
        return item;
    }
};

export const getActiveQuiz = async (room_id) => {
    const cleanRoomId = String(room_id || "").trim();
    try {
        const candidates = await resolveRoomCandidates(cleanRoomId);
        const query = `
            SELECT * FROM webinar_quizzes 
            WHERE room_id = ANY($1::text[]) AND is_active = TRUE 
            ORDER BY id DESC LIMIT 1;
        `;
        const result = await pool.query(query, [candidates]);
        if (result.rows.length === 0) return null;
        const quiz = result.rows[0];
        if (typeof quiz.opsi_jawaban === "string") {
            try { quiz.opsi_jawaban = JSON.parse(quiz.opsi_jawaban); } catch (e) {}
        }
        return quiz;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in getActiveQuiz:", err.message);
        return fallbackQuizzes.find(q => (q.room_id === cleanRoomId || q.room_id === "m-" + cleanRoomId || q.room_id === "zoom-" + cleanRoomId) && q.is_active) || null;
    }
};

export const submitQuizVote = async ({ quiz_id, voter_name, selected_option }) => {
    const qId = parseInt(quiz_id);
    const cleanVoter = (voter_name || "Peserta").trim();
    const cleanOpt = String(selected_option || "").trim();

    try {
        const query = `
            INSERT INTO webinar_quiz_votes (quiz_id, voter_name, selected_option)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(query, [qId, cleanVoter, cleanOpt]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in submitQuizVote:", err.message);
        const item = {
            id: fallbackVotes.length + 1,
            quiz_id: qId,
            voter_name: cleanVoter,
            selected_option: cleanOpt,
            created_at: new Date()
        };
        fallbackVotes.push(item);
        return item;
    }
};

export const getQuizResults = async (quiz_id) => {
    const qId = parseInt(quiz_id);
    try {
        const query = `
            SELECT selected_option, COUNT(*) as vote_count 
            FROM webinar_quiz_votes 
            WHERE quiz_id = $1 
            GROUP BY selected_option;
        `;
        const result = await pool.query(query, [qId]);
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL fallback in getQuizResults:", err.message);
        const votes = fallbackVotes.filter(v => v.quiz_id === qId);
        const counts = {};
        votes.forEach(v => { counts[v.selected_option] = (counts[v.selected_option] || 0) + 1; });
        return Object.keys(counts).map(opt => ({ selected_option: opt, vote_count: counts[opt] }));
    }
};

export default {
    addQuestion,
    getQuestionsByRoom,
    answerQuestion,
    deleteQuestion,
    upvoteQuestion,
    createQuiz,
    getActiveQuiz,
    submitQuizVote,
    getQuizResults
};
