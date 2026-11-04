import pool from "./config/database.js";
import { regenerateAllCertificatesForMeeting } from "./controllers/presensiController.js";
import fs from "fs";
import path from "path";

async function main() {
    try {
        console.log("🔍 [CHECK_DB] Memeriksa dan memperbarui skema Zoom & Meetings...");

        // 1. Tambah kolom yang diperlukan jika belum ada
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
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS pembuat VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS absensi TEXT;
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
            CREATE TABLE IF NOT EXISTS meeting_media (
                meeting_id INT PRIMARY KEY,
                documentation_photos JSONB DEFAULT '[]'::jsonb,
                thumbnail TEXT,
                notulen_pdf TEXT,
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
            CREATE TABLE IF NOT EXISTS meeting_sertifikat_counter (
                meeting_id INT PRIMARY KEY,
                last_number INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `).catch(() => {});
        console.log("✅ [CHECK_DB] Skema kolom pendukung siap!");

        // 2. Perbaiki sequence ID meetings & zoom_requests
        await pool.query(`
            SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
            SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);
        `).catch(() => {});

        // 3. Sinkronisasi permohonan zoom yang disetujui ke tabel meetings
        const approvedZoom = await pool.query(`
            SELECT * FROM zoom_requests 
            WHERE LOWER(TRIM(status)) = 'disetujui' 
            ORDER BY id ASC
        `);
        console.log(`📋 [CHECK_DB] Ditemukan ${approvedZoom.rows.length} permohonan Zoom yang disetujui.`);

        for (const req of approvedZoom.rows) {
            let zLink = (req.zoom_link || "").trim();
            if (zLink && !zLink.startsWith("http://") && !zLink.startsWith("https://")) {
                zLink = "https://" + zLink;
            }

            const zId = (req.meeting_id || "").trim();
            const zPass = (req.passcode || "").trim();
            const isOffline = req.tipe_rapat && req.tipe_rapat.toLowerCase().includes("offline");
            const isWebinar = req.tipe_rapat && req.tipe_rapat.toLowerCase().includes("webinar");
            const tipeMeeting = isOffline ? "1" : (isWebinar ? "3" : "2");

            // Cari meeting yang cocok berdasarkan zoom_request_id ATAU nama judul
            let check;
            try {
                check = await pool.query(
                    `SELECT meeting_id FROM meetings 
                     WHERE zoom_request_id = $1 
                        OR LOWER(TRIM(meeting_nama)) = LOWER(TRIM($2))
                     ORDER BY (zoom_request_id = $1) DESC, meeting_id DESC 
                     LIMIT 1`,
                    [req.id, req.judul_rapat]
                );
            } catch (cErr) {
                check = await pool.query(
                    `SELECT meeting_id FROM meetings 
                     WHERE LOWER(TRIM(meeting_nama)) = LOWER(TRIM($1))
                     ORDER BY meeting_id DESC 
                     LIMIT 1`,
                    [req.judul_rapat]
                );
            }

            if (check.rows.length > 0) {
                const targetMeeting = check.rows[0];
                const finalLink = zLink || targetMeeting.zoom_link || '';

                await pool.query(
                    `UPDATE meetings 
                     SET zoom_link = $1,
                         zoom_meeting_id = COALESCE(NULLIF($2, ''), zoom_meeting_id),
                         zoom_passcode = COALESCE(NULLIF($3, ''), zoom_passcode),
                         zoom_request_id = $4,
                         tipe_meeting = COALESCE(NULLIF(tipe_meeting, ''), $5)
                     WHERE meeting_id = $6`,
                    [finalLink, zId, zPass, req.id, tipeMeeting, targetMeeting.meeting_id]
                );
                console.log(`  -> Berhasil sinkronkan rapat "${req.judul_rapat}" (ID: ${targetMeeting.meeting_id}) dengan link Zoom.`);
            }
        }

        // 4. INJEKSI TEMPLATE AKSARA VOL. 7 & PERBARUI SEMUA SERTIFIKAT TERBIT
        console.log("🎨 [CHECK_DB] Memasang template AKSARA Vol. 7 ke rapat Webinar...");
        const templateBg = "/images/bg-aksara-vol7.png";
        const formatNomor = "[NOMOR]/AKSARA.07/KR5/[BULAN]/[TAHUN]";
        const layoutMode = "name_only";
        const signerName = "Myrna Amir, S.E., M.M.";
        const signerRole = "Kepala Kantor Regional V";
        const penyelenggara = "Kantor Regional V BKN Jakarta";

        // Pasang ke rapat ID 26, ID 2, dan seluruh rapat yang memiliki judul AKSARA atau Webinar
        const targetMeetingsRes = await pool.query(`
            SELECT meeting_id, meeting_nama FROM meetings 
            WHERE meeting_id = 26
               OR meeting_id = 2 
               OR LOWER(meeting_nama) LIKE '%aksara%' 
               OR LOWER(meeting_nama) LIKE '%webinar%'
               OR tipe_meeting = '3'
               OR tipe_meeting ILIKE '%webinar%'
        `).catch(() => ({ rows: [] }));

        for (const tm of (targetMeetingsRes.rows || [])) {
            const mId = tm.meeting_id;
            // Update meetings table
            await pool.query(`
                UPDATE meetings 
                SET sertifikat_bg = $1,
                    sertifikat_layout_mode = $2,
                    sertifikat_format_nomor = $3,
                    sertifikat_signer = $4,
                    sertifikat_signer_role = $5,
                    sertifikat_penyelenggara = $6,
                    sertifikat_enable_ttd = true
                WHERE meeting_id = $7::int
            `, [templateBg, layoutMode, formatNomor, signerName, signerRole, penyelenggara, mId]).catch(() => {});

            // Upsert meeting_media table
            await pool.query(`
                INSERT INTO meeting_media (meeting_id, sertifikat_bg, sertifikat_layout_mode, sertifikat_format_nomor, sertifikat_enable_ttd, updated_at)
                VALUES ($1::int, $2, $3, $4, true, CURRENT_TIMESTAMP)
                ON CONFLICT (meeting_id) DO UPDATE SET
                    sertifikat_bg = EXCLUDED.sertifikat_bg,
                    sertifikat_layout_mode = EXCLUDED.sertifikat_layout_mode,
                    sertifikat_format_nomor = EXCLUDED.sertifikat_format_nomor,
                    sertifikat_enable_ttd = true,
                    updated_at = CURRENT_TIMESTAMP
            `, [mId, templateBg, layoutMode, formatNomor]).catch(() => {});

            // Update zoom_requests
            await pool.query(`
                UPDATE zoom_requests
                SET sertifikat_bg = $1,
                    sertifikat_layout_mode = $2,
                    sertifikat_format_nomor = $3,
                    sertifikat_signer = $4,
                    sertifikat_signer_role = $5,
                    sertifikat_penyelenggara = $6,
                    sertifikat_enable_ttd = true
                WHERE id = (SELECT zoom_request_id FROM meetings WHERE meeting_id = $7::int)
                   OR LOWER(TRIM(judul_rapat)) = LOWER(TRIM($8))
            `, [templateBg, layoutMode, formatNomor, signerName, signerRole, penyelenggara, mId, tm.meeting_nama]).catch(() => {});

            // Perbarui seluruh berkas sertifikat HTML peserta yang telah terbit dengan template baru
            try {
                await regenerateAllCertificatesForMeeting(mId);
                console.log(`  -> Berhasil memperbarui seluruh sertifikat peserta untuk rapat ID ${mId} ("${tm.meeting_nama}")!`);
            } catch (rErr) {
                console.warn(`  -> Peringatan regenerasi sertifikat ID ${mId}:`, rErr.message);
            }
        }

        // Simpan juga ke meeting_metadata.json
        try {
            const metaPath = path.resolve(process.cwd(), "public", "uploads", "meeting_metadata.json");
            let metaStore = {};
            if (fs.existsSync(metaPath)) {
                try {
                    metaStore = JSON.parse(fs.readFileSync(metaPath, "utf-8") || "{}");
                } catch (_) {}
            }
            for (const tm of (targetMeetingsRes.rows || [])) {
                const mIdStr = String(tm.meeting_id);
                metaStore[mIdStr] = {
                    ...(metaStore[mIdStr] || {}),
                    sertifikat_bg: templateBg,
                    sertifikat_layout_mode: layoutMode,
                    sertifikat_format_nomor: formatNomor,
                    sertifikat_signer: signerName,
                    sertifikat_signer_role: signerRole,
                    sertifikat_penyelenggara: penyelenggara,
                    sertifikat_enable_ttd: true
                };
            }
            fs.writeFileSync(metaPath, JSON.stringify(metaStore, null, 2), "utf-8");
        } catch (_) {}

        console.log("🎉 [CHECK_DB] Diagnosa & perbaikan selesai.");
    } catch (e) {
        console.error("⚠️ [CHECK_DB] Error:", e.message);
    } finally {
        await pool.end().catch(() => {});
    }
}

main();
