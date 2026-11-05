import pool from "./database.js";

export async function syncApprovedZoomToMeetings() {
    try {
        // 1. Pastikan kolom pendukung di zoom_requests & meetings ada
        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS ruangan VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
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
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS bahan_rapat TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS absensi TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS documentation_photos JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
        `).catch(() => {});

        await pool.query(`
            CREATE TABLE IF NOT EXISTS meeting_media (
                meeting_id INT PRIMARY KEY,
                documentation_photos JSONB DEFAULT '[]'::jsonb,
                thumbnail TEXT,
                notulen_pdf TEXT,
                bahan_rapat TEXT,
                video_url TEXT,
                absensi TEXT,
                sertifikat_bg TEXT,
                sertifikat_enable_ttd BOOLEAN DEFAULT TRUE,
                sertifikat_layout_mode VARCHAR(50) DEFAULT 'full',
                sertifikat_format_nomor VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
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

        // Helper untuk mendapatkan tanggal lokal YYYY-MM-DD tanpa pergeseran zona waktu
        function toLocalDateString(val) {
            if (!val) return '';
            if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
                return val.substring(0, 10);
            }
            const d = new Date(val);
            if (isNaN(d.getTime())) return String(val).split('T')[0];
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        // 4. Ambil semua permohonan Zoom yang disetujui (baik Rapat Biasa maupun Webinar)
        const approvedRequests = await pool.query(
            "SELECT * FROM zoom_requests WHERE LOWER(TRIM(status)) = 'disetujui' ORDER BY id ASC"
        );

        for (const req of approvedRequests.rows) {
            const reqId = parseInt(req.id, 10);
            const reqDateStr = toLocalDateString(req.tanggal_rapat);

            const isOffline = req.tipe_rapat && req.tipe_rapat.toLowerCase().includes("offline");
            const isWebinar = req.tipe_rapat && req.tipe_rapat.toLowerCase().includes("webinar");
            const tipeMeeting = isOffline ? "1" : (isWebinar ? "3" : "2");

            const zoomLink = (req.zoom_link || "").trim();
            const zoomMeetingId = (req.meeting_id || "").trim();
            const zoomPasscode = (req.passcode || "").trim();

            let desc = req.keterangan || "";
            const timeInfo = (req.waktu_mulai && req.waktu_selesai) 
                ? `Waktu: ${String(req.waktu_mulai).substring(0, 5)} - ${String(req.waktu_selesai).substring(0, 5)} WIB. ` 
                : "";
            const pemohonInfo = req.nama_pemohon 
                ? `Pemohon: ${req.nama_pemohon} (${req.divisi || '-'}). ` 
                : "";
            const ruanganInfo = req.ruangan 
                ? `Ruang: ${req.ruangan}. ` 
                : "";
            const defaultDesc = isOffline ? `Rapat tatap muka resmi BKN: ${req.judul_rapat}` : `Rapat daring resmi BKN via Zoom: ${req.judul_rapat}`;
            const fullDesc = `${timeInfo}${pemohonInfo}${ruanganInfo}${desc}`.trim() || defaultDesc;
            const safeDesc = fullDesc.substring(0, 250);

            const creatorUserId = req.user_id || req.nip || 'user';
            const creator = String(creatorUserId).substring(0, 20);

            // Cek apakah meeting sudah ada (berdasarkan zoom_request_id atau judul & tanggal)
            let exists;
            try {
                exists = await pool.query(
                    `SELECT meeting_id FROM meetings 
                     WHERE zoom_request_id = $1 
                        OR (
                            LOWER(TRIM(meeting_nama)) = LOWER(TRIM($2)) 
                            AND (
                                tanggal::date = $3::date 
                                OR tanggal::date = ($3::date - 1) 
                                OR tanggal::date = ($3::date + 1)
                            )
                        )
                     LIMIT 1`,
                    [reqId, req.judul_rapat, reqDateStr]
                );
            } catch (existErr) {
                exists = await pool.query(
                    `SELECT meeting_id FROM meetings 
                     WHERE LOWER(TRIM(meeting_nama)) = LOWER(TRIM($1)) 
                        AND (
                            tanggal::date = $2::date 
                            OR tanggal::date = ($2::date - 1) 
                            OR tanggal::date = ($2::date + 1)
                        )
                     LIMIT 1`,
                    [req.judul_rapat, reqDateStr]
                );
            }

            if (exists.rows.length === 0) {
                try {
                    // 1. Coba insert dengan OVERRIDING SYSTEM VALUE
                    await pool.query(
                        `INSERT INTO meetings (
                            meeting_id, meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat,
                            zoom_link, zoom_meeting_id, zoom_passcode, zoom_request_id
                        ) OVERRIDING SYSTEM VALUE
                        VALUES (
                            (SELECT COALESCE(MAX(meeting_id), 0) + 1 FROM meetings),
                            $1, $2, $3::date, $4, $5, CURRENT_DATE,
                            $6, $7, $8, $9
                        )`,
                        [req.judul_rapat, safeDesc, reqDateStr, tipeMeeting, creator, zoomLink, zoomMeetingId, zoomPasscode, reqId]
                    );
                    console.log(`✅ [SYNC] Permohonan Zoom "${req.judul_rapat}" berhasil disinkronkan ke Manajemen Meeting.`);
                } catch (insErr) {
                    try {
                        await pool.query(
                            `INSERT INTO meetings (
                                meeting_id, meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat
                            ) OVERRIDING SYSTEM VALUE
                            VALUES (
                                (SELECT COALESCE(MAX(meeting_id), 0) + 1 FROM meetings),
                                $1, $2, $3::date, $4, $5, CURRENT_DATE
                            )`,
                            [req.judul_rapat, safeDesc, reqDateStr, tipeMeeting, creator]
                        );
                        console.log(`✅ [SYNC] Permohonan Zoom "${req.judul_rapat}" berhasil disinkronkan ke Manajemen Meeting.`);
                    } catch (insErr2) {
                        try {
                            await pool.query(
                                `INSERT INTO meetings (
                                    meeting_nama, deskripsi, tanggal, tipe_meeting, pembuat, tgl_buat
                                ) VALUES ($1, $2, $3::date, $4, $5, CURRENT_DATE)`,
                                [req.judul_rapat, safeDesc, reqDateStr, tipeMeeting, creator]
                            );
                        } catch (fallbackErr) {
                            console.warn("⚠️ [SYNC] Gagal insert rapat ke meetings:", fallbackErr.message);
                        }
                    }
                }
            } else {
                try {
                    await pool.query(
                        `UPDATE meetings 
                         SET deskripsi = $1, 
                             tipe_meeting = $2,
                             zoom_link = COALESCE(NULLIF($3, ''), zoom_link),
                             zoom_meeting_id = COALESCE(NULLIF($4, ''), zoom_meeting_id),
                             zoom_passcode = COALESCE(NULLIF($5, ''), zoom_passcode),
                             zoom_request_id = COALESCE(zoom_request_id, $6)
                         WHERE meeting_id = $7`,
                        [safeDesc, tipeMeeting, zoomLink, zoomMeetingId, zoomPasscode, reqId, exists.rows[0].meeting_id]
                    );
                } catch (updErr) {
                    console.warn("⚠️ [SYNC] Update meeting failed:", updErr.message);
                }
            }
        }

        // 5. AUTO-HEALING: Pastikan semua rapat yang terhubung atau bernilai judul sama memiliki zoom_link di tabel meetings
        // HANYA pasangkan dengan permohonan yang berstatus 'disetujui' dan memiliki link zoom yang valid
        await pool.query(`
            UPDATE meetings m
            SET zoom_link = COALESCE(NULLIF(m.zoom_link, ''), NULLIF(z.zoom_link, '')),
                zoom_meeting_id = COALESCE(NULLIF(m.zoom_meeting_id, ''), NULLIF(z.meeting_id, '')),
                zoom_passcode = COALESCE(NULLIF(m.zoom_passcode, ''), NULLIF(z.passcode, '')),
                zoom_request_id = COALESCE(m.zoom_request_id, z.id),
                sertifikat_bg = COALESCE(NULLIF(m.sertifikat_bg, ''), NULLIF(z.sertifikat_bg, ''), m.sertifikat_bg),
                sertifikat_signer = COALESCE(NULLIF(m.sertifikat_signer, ''), NULLIF(z.sertifikat_signer, ''), m.sertifikat_signer),
                sertifikat_signer_role = COALESCE(NULLIF(m.sertifikat_signer_role, ''), NULLIF(z.sertifikat_signer_role, ''), m.sertifikat_signer_role),
                sertifikat_penyelenggara = COALESCE(NULLIF(m.sertifikat_penyelenggara, ''), NULLIF(z.sertifikat_penyelenggara, ''), m.sertifikat_penyelenggara),
                sertifikat_enable_ttd = COALESCE(m.sertifikat_enable_ttd, z.sertifikat_enable_ttd, true),
                sertifikat_layout_mode = COALESCE(NULLIF(m.sertifikat_layout_mode, ''), NULLIF(z.sertifikat_layout_mode, ''), 'full'),
                sertifikat_format_nomor = COALESCE(NULLIF(m.sertifikat_format_nomor, ''), NULLIF(z.sertifikat_format_nomor, ''), m.sertifikat_format_nomor),
                tipe_meeting = CASE 
                    WHEN z.tipe_rapat ILIKE '%offline%' THEN '1'
                    WHEN z.tipe_rapat ILIKE '%webinar%' THEN '3'
                    ELSE '2'
                END
            FROM zoom_requests z
            WHERE LOWER(TRIM(z.status)) = 'disetujui'
              AND (
                  (m.zoom_request_id IS NOT NULL AND m.zoom_request_id = z.id)
                  OR (
                      m.zoom_request_id IS NULL 
                      AND LOWER(TRIM(m.meeting_nama)) = LOWER(TRIM(z.judul_rapat))
                      AND (
                          (z.zoom_link IS NOT NULL AND TRIM(z.zoom_link) != '')
                          OR z.tipe_rapat ILIKE '%offline%'
                      )
                  )
              );
        `).catch((healErr) => console.warn("⚠️ [SYNC] Auto-healing query warning:", healErr.message));
    } catch (err) {
        console.warn("⚠️ [SYNC] Error syncing approved zoom requests to meetings:", err.message);
    }
}

export async function initZoomSchema() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS zoom_requests (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100),
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
                ruangan VARCHAR(150),
                quiz_link TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `).catch((e) => console.warn("Init zoom_requests:", e.message));

        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS ruangan VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
        `).catch(() => {});

        // Alter meetings columns (optional on local, might fail on server if not table owner)
        await pool.query(`
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tgl_buat DATE DEFAULT CURRENT_DATE;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
        `).catch(() => {});

        // Sinkronisasi sequence
        await pool.query(`
            SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
            SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);
        `).catch(() => {});

        console.log("✅ [DB INIT] Tabel zoom_requests siap digunakan.");
    } catch (err) {
        console.warn("⚠️ [DB INIT] Peringatan inisialisasi skema:", err.message);
    }

    try {
        await syncApprovedZoomToMeetings();
    } catch (sErr) {
        console.warn("⚠️ [DB INIT] Sinkronisasi rapat Zoom:", sErr.message);
    }
}
