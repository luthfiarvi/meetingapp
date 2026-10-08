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

async function main() {
    console.log("==================================================");
    console.log("  PEMBUATAN AKUN ADMINISTRATOR SERVER LANGSUNG");
    console.log("==================================================");

    // 1. Pastikan database appmeeting ada
    let rootPool;
    try {
        rootPool = new Pool({ ...dbConfig, database: "postgres" });
        await rootPool.query("SELECT 1");
    } catch (e) {
        rootPool = new Pool({ ...dbConfig, user: "postgres", password: "postgres", database: "postgres" });
        await rootPool.query("SELECT 1");
    }

    try {
        const checkDb = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'appmeeting'");
        if (checkDb.rows.length === 0) {
            console.log("-> Database 'appmeeting' belum ada. Membuat database baru...");
            await rootPool.query("CREATE DATABASE appmeeting");
            console.log("-> Database 'appmeeting' berhasil dibuat!");
        }
    } catch (err) {
        console.warn("⚠️ Peringatan database check:", err.message);
    } finally {
        await rootPool.end();
    }

    // 2. Hubungkan ke database appmeeting
    let appPool;
    try {
        appPool = new Pool({ ...dbConfig, database: "appmeeting" });
        await appPool.query("SELECT 1");
    } catch (e) {
        appPool = new Pool({ ...dbConfig, user: "postgres", password: "postgres", database: "appmeeting" });
        await appPool.query("SELECT 1");
    }

    // 3. Buat tabel users jika belum ada
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

    // 4. Hash password '54321' dan insert akun
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
    console.log("🎉 BERHASIL! Akun Admin Server Siap Digunakan:");
    console.log("--------------------------------------------------");
    console.log(`👑 User ID  : ${targetId}`);
    console.log(`🔑 Password : ${targetPw}`);
    console.log(`🛡️ Role     : ${targetRole}`);
    console.log("==================================================");

    await appPool.end();
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Terjadi kesalahan:", err);
    process.exit(1);
});
