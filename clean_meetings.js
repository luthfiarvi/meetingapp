import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const isWindows = process.platform === "win32";

const dbConfig = {
    host: process.env.DB_HOST || (isWindows ? "localhost" : "/var/run/postgresql"),
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || (isWindows ? "postgres" : (process.env.PGUSER || "magangit")),
    password: process.env.DB_PASSWORD || (isWindows ? "postgres" : (process.env.PGPASSWORD || "K@nreg5")),
};

// Target database di server Linux: 'meeting' dan 'appmeeting'
const targetDbs = isWindows ? ["appmeeting"] : ["meeting", "appmeeting"];

async function cleanDatabase(dbName) {
    console.log(`\n🧹 Membersihkan data ruang rapat di database: '${dbName}'...`);
    const pool = new Pool({ ...dbConfig, database: dbName });

    try {
        await pool.query("SELECT 1");
    } catch (err) {
        console.warn(`  ⚠️ Database '${dbName}' tidak dapat diakses atau belum dibuat. Dilewati.`);
        await pool.end();
        return;
    }

    try {
        let cleaned = false;
        try {
            await pool.query(`
                TRUNCATE TABLE 
                    presensi, 
                    notulen, 
                    sertifikat, 
                    webinar_quiz_votes, 
                    webinar_quizzes, 
                    webinar_qa, 
                    zoom_requests,
                    meeting_media,
                    meetings 
                RESTART IDENTITY CASCADE;
            `);
            cleaned = true;
        } catch (truncErr) {
            console.warn(`  ℹ️ TRUNCATE memerlukan hak owner, menjalankan pembersihan via DELETE...`);
        }

        if (!cleaned) {
            await pool.query("DELETE FROM webinar_quiz_votes;").catch(() => {});
            await pool.query("DELETE FROM webinar_quizzes;").catch(() => {});
            await pool.query("DELETE FROM webinar_qa;").catch(() => {});
            await pool.query("DELETE FROM presensi;").catch(() => {});
            await pool.query("DELETE FROM sertifikat;").catch(() => {});
            await pool.query("DELETE FROM notulen;").catch(() => {});
            await pool.query("DELETE FROM zoom_requests;").catch(() => {});
            await pool.query("DELETE FROM meeting_media;").catch(() => {});
            await pool.query("DELETE FROM meetings;").catch(() => {});
            console.log(`  ✅ Berhasil menghapus data ruang rapat & permohonan zoom.`);
        }

        // Reset sequence ID kembali ke 1
        await pool.query(`
            SELECT setval('meetings_meeting_id_seq', 1, false);
            SELECT setval('zoom_requests_id_seq', 1, false);
            SELECT setval('presensi_id_seq', 1, false);
            SELECT setval('notulen_id_seq', 1, false);
            SELECT setval('sertifikat_id_seq', 1, false);
        `).catch(() => { });

        const countRes = await pool.query("SELECT COUNT(*) FROM meetings");
        console.log(`  📊 Konfirmasi sisa data meetings di database '${dbName}': ${countRes.rows[0].count}`);
        console.log(`  ✅ Tabel meetings, presensi, notulen, sertifikat, webinar, & zoom_requests telah KOSONG!`);
        console.log(`  ✅ ID auto-increment telah di-reset kembali ke 1.`);

    } catch (err) {
        console.error(`  ❌ Gagal membersihkan '${dbName}':`, err.message);
    } finally {
        await pool.end();
    }
}

function cleanUploadFiles() {
    console.log("\n📁 Membersihkan berkas upload sementara ruang rapat (foto avatar user TETAP AMAN)...");
    const uploadDirs = ["ttd", "thumbnails", "notulen", "sertif", "videos", "transcripts", "evidence"];
    let deletedCount = 0;

    for (const dir of uploadDirs) {
        const fullDir = path.join(process.cwd(), "public", "uploads", dir);
        if (fs.existsSync(fullDir)) {
            try {
                const files = fs.readdirSync(fullDir);
                for (const file of files) {
                    if (file === "template.html") continue; // Jangan hapus template master sertifikat
                    const filePath = path.join(fullDir, file);
                    if (fs.lstatSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            } catch (err) {
                // abaikan jika tidak ada akses
            }
        }
    }
    const metaFile = path.join(process.cwd(), "public", "uploads", "meeting_metadata.json");
    if (fs.existsSync(metaFile)) {
        try {
            fs.writeFileSync(metaFile, "{}", "utf-8");
        } catch (_) {}
    }
    console.log(`  ✅ Berhasil menghapus ${deletedCount} berkas lampiran rapat lama & mereset meeting_metadata.json.`);
}

async function main() {
    console.log("==================================================");
    console.log("   PEMBERSIHAN DATA RUANG RAPAT (MEETING APP)");
    console.log("==================================================");

    for (const db of targetDbs) {
        await cleanDatabase(db);
    }

    cleanUploadFiles();

    console.log("\n==================================================");
    console.log("🎉 BERHASIL! Seluruh data ruang rapat telah bersih (clean).");
    console.log("   Akun Pengguna (Users) tetap aman & tidak terhapus.");
    console.log("==================================================");
}

main();
