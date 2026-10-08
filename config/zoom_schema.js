import pool from "./database.js";

export async function syncApprovedZoomToMeetings() {
    try {
        // 1. Pastikan kolom pendukung di zoom_requests & meetings ada
        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
        `).catch(() => {});

        // 2. Perbaiki sequence meetings_meeting_id_seq agar tidak bentrok 'duplicate key'
        await pool.query(`
            SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
        `).catch(() => {});

        // 3. Pastikan tautan kuis otomatis untuk permohonan webinar
        await pool.query(`
            UPDATE zoom_requests 
            SET quiz_link = '/webinar-quiz/zoom-' || id 
            WHERE (quiz_link IS NULL OR quiz_link = '') 
              AND status = 'disetujui' 
              AND (tipe_rapat ILIKE '%webinar%');
        `).catch(() => {});

        // 4. Ambil semua permohonan Zoom yang disetujui (baik Rapat Biasa maupun Webinar)
        const approvedRequests = await pool.query(
            "SELECT * FROM zoom_requests WHERE LOWER(TRIM(status)) = 'disetujui' ORDER BY id ASC"
        );

        for (const req of approvedRequests.rows) {
            const reqId = parseInt(req.id, 10);
            const reqDateStr = req.tanggal_rapat instanceof Date 
                ? req.tanggal_rapat.toISOString().split('T')[0] 
                : String(req.tanggal_rapat).split('T')[0];

            const isWebinar = req.tipe_rapat && req.tipe_rapat.toLowerCase().includes("webinar");
            const tipeMeeting = isWebinar ? "Webinar" : "Zoom";

            let desc = req.keterangan || "";
            const timeInfo = (req.waktu_mulai && req.waktu_selesai) 
                ? `Waktu: ${String(req.waktu_mulai).substring(0, 5)} - ${String(req.waktu_selesai).substring(0, 5)} WIB. ` 
                : "";
            const pemohonInfo = req.nama_pemohon 
                ? `Pemohon: ${req.nama_pemohon} (${req.divisi || '-'}). ` 
                : "";
            const fullDesc = `${timeInfo}${pemohonInfo}${desc}`.trim() || `Rapat daring resmi BKN via Zoom: ${req.judul_rapat}`;

            const creatorUserId = req.user_id || 'user';

            const exists = await pool.query(
                "SELECT meeting_id FROM meetings WHERE zoom_request_id = $1",
                [reqId]
            );

            if (exists.rows.length === 0) {
                // Pastikan sequence siap sebelum insert
                await pool.query(`
                    SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
                `).catch(() => {});

                await pool.query(
                    `INSERT INTO meetings (
                        meeting_nama, deskripsi, tanggal, tipe_meeting, tgl_buat,
                        zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id, user_id
                    ) VALUES ($1, $2, $3::date, $4, CURRENT_DATE, $5, $6, $7, $8, $9)`,
                    [
                        req.judul_rapat,
                        fullDesc,
                        reqDateStr,
                        tipeMeeting,
                        req.zoom_link || "",
                        req.meeting_id || "",
                        req.passcode || "",
                        reqId,
                        creatorUserId
                    ]
                );
                console.log(`✅ [SYNC] Permohonan Zoom "${req.judul_rapat}" (${tipeMeeting}) berhasil disinkronkan ke Manajemen Meeting.`);
            } else {
                await pool.query(
                    `UPDATE meetings 
                     SET zoom_link = COALESCE(NULLIF($1, ''), zoom_link),
                         zoom_meeting_id = COALESCE(NULLIF($2, ''), zoom_meeting_id),
                         zoom_passcode = COALESCE(NULLIF($3, ''), zoom_passcode),
                         zoom_request_id = $4,
                         tipe_meeting = $5,
                         deskripsi = COALESCE(NULLIF($6, ''), deskripsi),
                         user_id = COALESCE(user_id, $7)
                     WHERE meeting_id = $8`,
                    [
                        req.zoom_link || "",
                        req.meeting_id || "",
                        req.passcode || "",
                        reqId,
                        tipeMeeting,
                        fullDesc,
                        creatorUserId,
                        exists.rows[0].meeting_id
                    ]
                );
            }
        }
    } catch (err) {
        console.warn("⚠️ [SYNC] Error syncing approved zoom requests to meetings:", err.message);
    }
}

export async function initZoomSchema() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meetings (
                meeting_id SERIAL PRIMARY KEY,
                meeting_nama VARCHAR(255) NOT NULL,
                deskripsi TEXT,
                tanggal DATE,
                tipe_meeting VARCHAR(50),
                tgl_buat DATE DEFAULT CURRENT_DATE,
                thumbnail TEXT,
                notulen_pdf TEXT,
                video_url TEXT,
                zoom_link TEXT,
                zoom_meeting_id VARCHAR(100),
                zoom_passcode VARCHAR(100),
                zoom_request_id INT
            );

            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tgl_buat DATE DEFAULT CURRENT_DATE;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;

            CREATE TABLE IF NOT EXISTS zoom_requests (
                id SERIAL PRIMARY KEY,
                nip VARCHAR(50) NOT NULL,
                nama_pemohon VARCHAR(150),
                divisi VARCHAR(150),
                judul_rapat VARCHAR(255) NOT NULL,
                tanggal_pengajuan DATE DEFAULT CURRENT_DATE,
                tanggal_rapat DATE NOT NULL,
                waktu_mulai TIME,
                waktu_selesai TIME,
                keterangan TEXT,
                status VARCHAR(30) DEFAULT 'menunggu',
                zoom_link TEXT,
                meeting_id VARCHAR(100),
                passcode VARCHAR(100),
                catatan_admin TEXT,
                tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa',
                quiz_link TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
        `);

        // Sinkronisasi sequence
        await pool.query(`
            SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
            SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);
        `).catch(() => {});

        console.log("✅ [DB INIT] Tabel zoom_requests dan kolom zoom pada meetings siap digunakan.");

        await syncApprovedZoomToMeetings();
    } catch (err) {
        console.warn("⚠️ [DB INIT] Gagal inisialisasi tabel zoom_requests:", err.message);
    }
}
