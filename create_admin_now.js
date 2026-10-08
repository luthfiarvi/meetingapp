import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const isWindows = process.platform === "win32";

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || (isWindows ? "postgres" : (process.env.PGUSER || "magangit")),
    password: process.env.DB_PASSWORD || (isWindows ? "postgres" : (process.env.PGPASSWORD || "K@nreg5")),
};

async function run() {
    console.log("==================================================");
    console.log("  PEMBUATAN DATABASE & AKUN ADMIN (198004082008121001)");
    console.log("==================================================");

    // 1. Cek atau buat database appmeeting via database template1
    console.log(`[1/3] Menghubungkan ke PostgreSQL (${dbConfig.user}@${dbConfig.host})...`);
    let templatePool;
    try {
        templatePool = new Pool({ ...dbConfig, database: "template1" });
        const check = await templatePool.query("SELECT 1 FROM pg_database WHERE datname = 'appmeeting'");
        if (check.rows.length === 0) {
            console.log("  -> Database 'appmeeting' belum ada. Membuat database baru...");
            await templatePool.query("CREATE DATABASE appmeeting");
            console.log("  ✅ Database 'appmeeting' berhasil dibuat!");
        } else {
            console.log("  ℹ️ Database 'appmeeting' sudah ada.");
        }
    } catch (err) {
        console.warn("  Catatan koneksi template1:", err.message);
    } finally {
        if (templatePool) await templatePool.end();
    }

    // 2. Hubungkan ke database appmeeting
    console.log("\n[2/3] Masuk ke database 'appmeeting'...");
    const appPool = new Pool({ ...dbConfig, database: "appmeeting" });
    try {
        await appPool.query("SELECT 1");
        console.log("  ✅ Berhasil masuk ke database 'appmeeting'!");
    } catch (err) {
        console.error("  ❌ Gagal masuk ke database appmeeting:", err.message);
        process.exit(1);
    }

    // 3. Pastikan tabel users ada & masukkan akun
    console.log("\n[3/3] Menyiapkan tabel users & mendaftarkan akun Admin...");
    try {
        await appPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                full_name VARCHAR(255) DEFAULT 'Administrator BKN',
                nip VARCHAR(50) DEFAULT '198004082008121001',
                institution VARCHAR(255) DEFAULT 'Kantor Regional V BKN Jakarta',
                division VARCHAR(255) DEFAULT 'Pengelolaan Sistem Informasi Kepegawaian'
            );
        `);

        const targetId = "198004082008121001";
        const targetPw = "54321";
        const targetRole = "admin";

        const hash = await bcrypt.hash(targetPw, 10);

        await appPool.query(`
            INSERT INTO users (id, username, password, role, full_name, nip, division)
            VALUES ($1, $1, $2, $3, 'Administrator Kanreg V', $1, 'Tim Kerja Sidigi')
            ON CONFLICT (id) DO UPDATE SET 
                password = EXCLUDED.password,
                role = EXCLUDED.role,
                username = EXCLUDED.username,
                nip = EXCLUDED.nip;
        `, [targetId, hash, targetRole]);

        console.log("==================================================");
        console.log("🎉 SUKSES BESAR! AKUN ADMIN BERHASIL DIBUAT:");
        console.log("--------------------------------------------------");
        console.log(`👑 User ID  : ${targetId}`);
        console.log(`🔑 Password : ${targetPw}`);
        console.log(`🛡️ Role     : ${targetRole}`);
        console.log("==================================================");
    } catch (e) {
        console.error("  ❌ Gagal mendaftarkan user:", e.message);
    } finally {
        await appPool.end();
        process.exit(0);
    }
}

run();
