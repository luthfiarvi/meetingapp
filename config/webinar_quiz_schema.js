import pool from "./database.js";

export async function initWebinarQuizSchema() {
    try {
        // 1. Pastikan kolom tipe_rapat & quiz_link ada di tabel zoom_requests
        await pool.query(`
            ALTER TABLE zoom_requests 
            ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE zoom_requests 
            ADD COLUMN IF NOT EXISTS quiz_link TEXT;
        `).catch(() => {});

        // 2. Tabel Q&A Pertanyaan & Jawaban Webinar
        await pool.query(`
            CREATE TABLE IF NOT EXISTS webinar_qa (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(100) NOT NULL,
                nama_penanya VARCHAR(150),
                instansi VARCHAR(150),
                pertanyaan TEXT NOT NULL,
                jawaban TEXT,
                dijawab_oleh VARCHAR(150),
                sumber VARCHAR(30) DEFAULT 'public_link',
                is_answered BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                answered_at TIMESTAMP
            );
        `);

        // 3. Tabel Kuis / Polling Live Webinar
        await pool.query(`
            CREATE TABLE IF NOT EXISTS webinar_quizzes (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(100) NOT NULL,
                judul_kuis TEXT NOT NULL,
                opsi_jawaban JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Tabel Jawaban / Vote Peserta Kuis
        await pool.query(`
            CREATE TABLE IF NOT EXISTS webinar_quiz_votes (
                id SERIAL PRIMARY KEY,
                quiz_id INT REFERENCES webinar_quizzes(id) ON DELETE CASCADE,
                voter_name VARCHAR(150),
                selected_option VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ [DB INIT] Tabel webinar_qa & webinar_quizzes siap digunakan.");
    } catch (err) {
        console.warn("⚠️ [DB INIT] Gagal inisialisasi tabel webinar quiz (berjalan dalam mode fallback/dev):", err.message);
    }
}
