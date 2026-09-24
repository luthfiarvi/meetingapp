import pool from "./database.js";

export async function syncApprovedZoomToMeetings() {
    try {
        await pool.query(
            "UPDATE zoom_requests SET quiz_link = '/webinar-quiz/zoom-' || id WHERE (quiz_link IS NULL OR quiz_link = '') AND status = 'disetujui'"
        );

        const approvedRequests = await pool.query(
            "SELECT * FROM zoom_requests WHERE status = 'disetujui' ORDER BY id ASC"
        );
        for (const req of approvedRequests.rows) {
            const exists = await pool.query(
                "SELECT meeting_id FROM meetings WHERE zoom_request_id = $1 OR (meeting_nama = $2 AND tanggal = $3)",
                [req.id, req.judul_rapat, req.tanggal_rapat]
            );

            const tipeMeeting = (req.tipe_rapat && req.tipe_rapat.toLowerCase() === "webinar") ? "Webinar" : "Zoom";
            let desc = req.keterangan || "";
            const timeInfo = (req.waktu_mulai && req.waktu_selesai) ? `Waktu: ${String(req.waktu_mulai).substring(0, 5)} - ${String(req.waktu_selesai).substring(0, 5)} WIB. ` : "";
            const pemohonInfo = req.nama_pemohon ? `Pemohon: ${req.nama_pemohon} (${req.divisi || '-'}). ` : "";
            const fullDesc = `${timeInfo}${pemohonInfo}${desc}`.trim() || `Rapat online BKN via Zoom: ${req.judul_rapat}`;

            if (exists.rows.length === 0) {
                await pool.query(
                    `INSERT INTO meetings (
                        meeting_nama, deskripsi, tanggal, tipe_meeting, tgl_buat,
                        zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id
                    ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8)`,
                    [
                        req.judul_rapat,
                        fullDesc,
                        req.tanggal_rapat,
                        tipeMeeting,
                        req.zoom_link || "",
                        req.meeting_id || "",
                        req.passcode || "",
                        req.id
                    ]
                );
                console.log(`✅ [SYNC] Permohonan Zoom "${req.judul_rapat}" berhasil disinkronkan ke Manajemen Meeting.`);
            } else {
                await pool.query(
                    `UPDATE meetings 
                     SET zoom_link = COALESCE(NULLIF($1, ''), zoom_link),
                         zoom_meeting_id = COALESCE(NULLIF($2, ''), zoom_meeting_id),
                         zoom_passcode = COALESCE(NULLIF($3, ''), zoom_passcode),
                         zoom_request_id = $4,
                         tipe_meeting = $5
                     WHERE meeting_id = $6`,
                    [
                        req.zoom_link || "",
                        req.meeting_id || "",
                        req.passcode || "",
                        req.id,
                        tipeMeeting,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
        `);
        console.log("✅ [DB INIT] Tabel zoom_requests dan kolom zoom pada meetings siap digunakan.");

        await syncApprovedZoomToMeetings();
    } catch (err) {
        console.warn("⚠️ [DB INIT] Gagal inisialisasi tabel zoom_requests (berjalan dalam mode fallback/dev):", err.message);
    }
}
