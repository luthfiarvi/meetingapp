import fs from "fs";
import path from "path";
import { Pool } from "pg";
import defaultPool from "./config/database.js";

// Helper: konversi bulan ke romawi
function toRomanMonth(month) {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[(month - 1)] || String(month);
}

async function getActivePool() {
    try {
        await defaultPool.query("SELECT 1 FROM meetings LIMIT 1");
        return defaultPool;
    } catch (e) {
        const candidates = [
            { host: "localhost", user: "magangit", password: "K@nreg5", database: "appmeeting" },
            { host: "localhost", user: "magangit", password: "K@nreg5", database: "meeting" },
            { host: "/var/run/postgresql", user: "magangit", password: "K@nreg5", database: "appmeeting" },
            { host: "/var/run/postgresql", user: "magangit", password: "K@nreg5", database: "meeting" },
            { host: "localhost", user: "postgres", password: "postgres", database: "appmeeting" }
        ];
        for (const cfg of candidates) {
            try {
                const testPool = new Pool({ ...cfg, connectionTimeoutMillis: 2000 });
                await testPool.query("SELECT 1 FROM meetings LIMIT 1");
                console.log(`🔌 Terhubung ke PostgreSQL: DB '${cfg.database}' (${cfg.host})`);
                return testPool;
            } catch (_) {}
        }
    }
    return defaultPool;
}

async function runBatchGenerate() {
    console.log("============================================================");
    console.log("🚀 [BATCH AKSARA] Memulai Batch Generate Sertifikat Aksara 7");
    console.log("============================================================");

    const startTime = Date.now();
    const pool = await getActivePool();

    // 1. Baca data peserta dari peserta_aksara.json
    const jsonPath = path.join(process.cwd(), "peserta_aksara.json");
    if (!fs.existsSync(jsonPath)) {
        console.error("❌ File peserta_aksara.json tidak ditemukan di:", jsonPath);
        process.exit(1);
    }

    const participants = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    console.log(`📋 Total data peserta yang dimuat: ${participants.length} orang.`);

    // 2. Pastikan target meeting ada (Meeting ID 26: Rapat Webinar AKSARA di server)
    let meetingId = 26;
    let meetingRes = await pool.query(
        "SELECT * FROM meetings WHERE meeting_id = $1 LIMIT 1",
        [meetingId]
    ).catch(() => ({ rows: [] }));

    if (!meetingRes.rows || meetingRes.rows.length === 0) {
        // Cari meeting yang judulnya ada kata 'aksara'
        const altMeeting = await pool.query(
            "SELECT * FROM meetings WHERE LOWER(meeting_nama) LIKE '%aksara%' ORDER BY (meeting_id = 26) DESC, meeting_id DESC LIMIT 1"
        ).catch(() => ({ rows: [] }));

        if (altMeeting.rows && altMeeting.rows.length > 0) {
            meetingRes = altMeeting;
            meetingId = altMeeting.rows[0].meeting_id;
        } else {
            console.log(`⚠️ Meeting ID 26 belum ada di database, membuat entri Rapat Webinar AKSARA ID 26...`);
            await pool.query(`
                INSERT INTO meetings (meeting_id, meeting_nama, deskripsi, tanggal, jam_mulai, tipe_meeting, sertifikat_bg, sertifikat_layout_mode, sertifikat_format_nomor, sertifikat_signer, sertifikat_signer_role, sertifikat_penyelenggara, sertifikat_enable_ttd)
                VALUES (26, 'Akselerasi Kompetensi dan Sinergi ASN (AKSARA) Vol. 7', 'Webinar Pemutakhiran Data ASN Melalui MyASN: Untuk Mendukung Peningkatan Indeks Kualitas Data ASN', '2026-10-29', '08:00', '3', '/images/bg-aksara-vol7.png', 'name_only', '[NOMOR]/AKSARA.07/KR5/[BULAN]/[TAHUN]', 'Myrna Amir, S.E., M.M.', 'Kepala Kantor Regional V', 'Kantor Regional V BKN Jakarta', true)
                ON CONFLICT (meeting_id) DO UPDATE SET
                    meeting_nama = 'Akselerasi Kompetensi dan Sinergi ASN (AKSARA) Vol. 7',
                    tipe_meeting = '3',
                    sertifikat_bg = '/images/bg-aksara-vol7.png',
                    sertifikat_layout_mode = 'name_only',
                    sertifikat_format_nomor = '[NOMOR]/AKSARA.07/KR5/[BULAN]/[TAHUN]',
                    sertifikat_signer = 'Myrna Amir, S.E., M.M.',
                    sertifikat_signer_role = 'Kepala Kantor Regional V';
            `).catch((err) => console.warn("Notice insert meeting:", err.message));

            meetingRes = await pool.query("SELECT * FROM meetings WHERE meeting_id = $1 LIMIT 1", [meetingId]).catch(() => ({ rows: [] }));
        }
    }

    // Pastikan konfigurasi template AKSARA Vol. 7 terpasang di meeting target
    await pool.query(`
        UPDATE meetings SET
            tipe_meeting = '3',
            sertifikat_bg = '/images/bg-aksara-vol7.png',
            sertifikat_layout_mode = 'name_only',
            sertifikat_format_nomor = '[NOMOR]/AKSARA.07/KR5/[BULAN]/[TAHUN]',
            sertifikat_signer = 'Myrna Amir, S.E., M.M.',
            sertifikat_signer_role = 'Kepala Kantor Regional V',
            sertifikat_penyelenggara = 'Kantor Regional V BKN Jakarta',
            sertifikat_enable_ttd = true
        WHERE meeting_id = $1
    `, [meetingId]).catch(() => {});

    const meeting = meetingRes.rows[0] || {};
    const meetingTitle = meeting.meeting_nama || "Akselerasi Kompetensi dan Sinergi ASN (AKSARA) Vol. 7";
    const bgUrl = (meeting.sertifikat_bg || "/images/bg-aksara-vol7.png") + `?v=${Date.now()}`;
    const signerName = meeting.sertifikat_signer || "Myrna Amir, S.E., M.M.";
    const signerRole = meeting.sertifikat_signer_role || "Kepala Kantor Regional V";
    const penyelenggara = meeting.sertifikat_penyelenggara || "Kantor Regional V BKN Jakarta";
    const bulanRomawi = toRomanMonth(10); // Oktober = X
    const tahun = 2026;
    const tanggalStr = "29 Oktober 2026";

    console.log(`🎯 Target Meeting ID: ${meetingId} ("${meetingTitle}")`);
    console.log(`🖼️  Background Sertifikat: ${bgUrl}`);

    // 3. Pastikan folder output sertifikat ada
    const sertifDir = path.join(process.cwd(), "public", "uploads", "sertif", String(meetingId));
    if (!fs.existsSync(sertifDir)) {
        fs.mkdirSync(sertifDir, { recursive: true });
    }

    // 4. Baca template sertifikat HTML
    const templatePath = path.join(process.cwd(), "public", "uploads", "sertif", "template.html");
    if (!fs.existsSync(templatePath)) {
        console.error("❌ Template sertifikat tidak ditemukan:", templatePath);
        process.exit(1);
    }
    const rawTemplate = fs.readFileSync(templatePath, "utf-8");

    // Static 1x1 transparent GIF data URI untuk QR placeholder (karena di name_only QR disembunyikan oleh CSS)
    const dummyQr = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const certClasses = "mode-name-only with-ttd";

    // 5. Generate seluruh berkas HTML fisik
    console.log("⚡ [1/3] Men-generate berkas sertifikat HTML peserta...");
    let filesCreated = 0;

    for (const p of participants) {
        const noUrut = String(p.no).padStart(3, "0");
        const nomorSertifikat = `${noUrut}/AKSARA.07/KR5/${bulanRomawi}/${tahun}`;
        const fileName = `sertif_${p.nip}.html`;
        const filePath = path.join(sertifDir, fileName);

        const htmlContent = rawTemplate
            .replaceAll("{{CERT_PAGE_CLASSES}}", certClasses)
            .replaceAll("{{BG_SERTIFIKAT_URL}}", bgUrl)
            .replaceAll("{{SIGNER_NAME}}", signerName)
            .replaceAll("{{SIGNER_ROLE}}", signerRole)
            .replaceAll("{{PENYELENGGARA}}", penyelenggara)
            .replaceAll("{{NAMA}}", p.nama)
            .replaceAll("{{NIP}}", p.nip)
            .replaceAll("{{NOMOR_SERTIFIKAT}}", nomorSertifikat)
            .replaceAll("{{TEMA_WEBINAR}}", meetingTitle)
            .replaceAll("{{TANGGAL}}", tanggalStr)
            .replaceAll("{{TAHUN}}", String(tahun))
            .replaceAll("{{QR_DOWNLOAD_SRC}}", dummyQr)
            .replaceAll("{{QR_TTD_SRC}}", dummyQr);

        fs.writeFileSync(filePath, htmlContent, "utf-8");
        filesCreated++;
    }
    console.log(`✅ [1/3] Selesai membuat ${filesCreated} berkas sertifikat HTML fisik!`);

    // 6. Siapkan Database: pastikan tabel & kolom siap
    console.log("⚡ [2/3] Memeriksa struktur tabel database presensi & sertifikat...");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS presensi (
            id SERIAL PRIMARY KEY,
            meeting_id VARCHAR(100),
            nama VARCHAR(255),
            nip VARCHAR(100),
            instansi VARCHAR(255) DEFAULT '-',
            jabatan VARCHAR(255) DEFAULT '-',
            email VARCHAR(255) DEFAULT '-',
            keterangan TEXT DEFAULT '-',
            tanda_tangan TEXT DEFAULT '',
            waktu_presensi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sertifikat (
            id SERIAL PRIMARY KEY,
            nama VARCHAR(255) NOT NULL,
            nip VARCHAR(100),
            meeting_id VARCHAR(100) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_presensi_meeting ON presensi(meeting_id);
        CREATE INDEX IF NOT EXISTS idx_sertif_meeting ON sertifikat(meeting_id);
    `).catch(() => {});

    // 7. Bersihkan daftar hadir lama di ruang rapat 26 & batch insert 4.158 peserta
    console.log(`🧹 [3/3] Membersihkan daftar hadir lama di ruang rapat ID ${meetingId} agar bersih...`);
    await pool.query("DELETE FROM presensi WHERE meeting_id = $1", [String(meetingId)]).catch(() => {});
    await pool.query("DELETE FROM sertifikat WHERE meeting_id = $1", [String(meetingId)]).catch(() => {});

    console.log(`⚡ Memasukkan ${participants.length} peserta baru ke ruang rapat ID ${meetingId}...`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < participants.length; i += CHUNK_SIZE) {
        const chunk = participants.slice(i, i + CHUNK_SIZE);
        const presensiValues = [];
        const presensiParams = [];
        let pIndex = 1;

        for (const p of chunk) {
            presensiValues.push(`($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++})`);
            presensiParams.push(String(meetingId), p.nama, String(p.nip), "-", "");
        }

        const presensiSql = `
            INSERT INTO presensi (meeting_id, nama, nip, instansi, tanda_tangan)
            VALUES ${presensiValues.join(", ")}
        `;
        await pool.query(presensiSql, presensiParams);

        const sertifValues = [];
        const sertifParams = [];
        let sIndex = 1;

        for (const p of chunk) {
            const filePath = `/uploads/sertif/${meetingId}/sertif_${p.nip}.html`;
            sertifValues.push(`($${sIndex++}, $${sIndex++}, $${sIndex++}, $${sIndex++})`);
            sertifParams.push(p.nama, String(p.nip), String(meetingId), filePath);
        }

        const sertifSql = `
            INSERT INTO sertifikat (nama, nip, meeting_id, file_path)
            VALUES ${sertifValues.join(", ")}
        `;
        await pool.query(sertifSql, sertifParams);
    }

    // Update counter
    await pool.query(`
        INSERT INTO meeting_sertifikat_counter (meeting_id, last_number, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (meeting_id) DO UPDATE
        SET last_number = EXCLUDED.last_number,
            updated_at = CURRENT_TIMESTAMP
    `, [meetingId, participants.length]).catch(() => {});

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("============================================================");
    console.log(`🎉 BERHASIL BATCH GENERATE DALAM ${duration} DETIK!`);
    console.log(`   - Total Peserta: ${participants.length}`);
    console.log(`   - Berkas Sertifikat: Tersimpan di public/uploads/sertif/${meetingId}/`);
    console.log(`   - Data Presensi & Sertifikat: Masuk ke Database`);
    console.log("============================================================");

    process.exit(0);
}

runBatchGenerate().catch((err) => {
    console.error("❌ Terjadi kesalahan saat batch generate:", err);
    process.exit(1);
});
