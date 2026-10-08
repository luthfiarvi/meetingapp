import pool from "./config/database.js";
import { syncApprovedZoomToMeetings } from "./config/zoom_schema.js";

async function main() {
    console.log("============================================================");
    console.log("  DIAGNOSA & REPARASI DATABASE POSTGRESQL (appmeeting)");
    console.log("============================================================");

    try {
        // 1. Cek koneksi
        const testConn = await pool.query("SELECT current_user, current_database(), version();");
        console.log(`✅ Terhubung ke database: ${testConn.rows[0].current_database} sebagai user: ${testConn.rows[0].current_user}`);

        // 2. Tambahkan kolom yang mungkin belum ada (aman dan idempotent)
        console.log("\n[1/4] Memeriksa & memperbaiki struktur kolom...");
        const alterQueries = [
            "ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);",
            "ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';",
            "ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;",
            "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);"
        ];

        for (const q of alterQueries) {
            try {
                await pool.query(q);
            } catch (qErr) {
                console.warn(`  ⚠️ Peringatan saat menjalankan query: ${qErr.message}`);
            }
        }
        console.log("  [OK] Struktur kolom siap!");

        // 3. Perbaiki sequence ID agar tidak terjadi duplicate key
        console.log("\n[2/4] Menyelaraskan sequence ID (auto-increment)...");
        try {
            await pool.query("SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);");
            await pool.query("SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);");
            console.log("  [OK] Sequence ID berhasil diselaraskan!");
        } catch (sErr) {
            console.warn(`  ⚠️ Gagal menyelaraskan sequence: ${sErr.message}`);
        }

        // 4. Sinkronisasi permohonan zoom yang disetujui ke meetings
        console.log("\n[3/4] Menjalankan sinkronisasi pengajuan Zoom yang disetujui ke Manajemen Meeting...");
        try {
            await syncApprovedZoomToMeetings();
            console.log("  [OK] Sinkronisasi selesai!");
        } catch (syncErr) {
            console.warn(`  ⚠️ Gagal sinkronisasi: ${syncErr.message}`);
        }

        // 5. Tampilkan data terkini
        console.log("\n[4/4] Data terkini di Database:");
        const zoomRes = await pool.query("SELECT id, judul_rapat, status, tipe_rapat, user_id FROM zoom_requests ORDER BY id DESC LIMIT 10;");
        console.log("\n--- DAFTAR PERMOHONAN ZOOM (zoom_requests) ---");
        console.table(zoomRes.rows);

        const meetRes = await pool.query("SELECT meeting_id, meeting_nama, tipe_meeting, zoom_request_id, user_id FROM meetings ORDER BY meeting_id DESC LIMIT 10;");
        console.log("\n--- DAFTAR MEETING (meetings) ---");
        console.table(meetRes.rows);

        console.log("\n============================================================");
        console.log("  DIAGNOSA SELESAI!");
        console.log("============================================================\n");
    } catch (err) {
        console.error("❌ Terjadi kesalahan fatal:", err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
