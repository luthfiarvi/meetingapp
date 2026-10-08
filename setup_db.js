import { Pool } from "pg";
import fs from "fs";
import path from "path";
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

async function setup() {
    console.log("==================================================");
    console.log("  INISIALISASI OTOMATIS DATABASE & AKUN ADMIN");
    console.log("==================================================");

    // 1. Hubungkan ke database default 'postgres' terlebih dahulu
    console.log(`[1/4] Menghubungkan ke PostgreSQL (${dbConfig.user}@${dbConfig.host})...`);
    let rootPool;
    try {
        rootPool = new Pool({ ...dbConfig, database: "postgres" });
        await rootPool.query("SELECT 1");
        console.log("  [OK] Terhubung ke server PostgreSQL!");
    } catch (err) {
        console.warn(`  ⚠️ Gagal login sebagai ${dbConfig.user}, mencoba koneksi sebagai 'postgres'...`);
        try {
            rootPool = new Pool({ ...dbConfig, user: "postgres", password: "postgres", database: "postgres" });
            await rootPool.query("SELECT 1");
            console.log("  [OK] Terhubung ke server PostgreSQL sebagai postgres!");
        } catch (err2) {
            console.error("  ❌ Gagal menghubungkan ke PostgreSQL:", err2.message);
            process.exit(1);
        }
    }

    // 2. Cek dan buat database appmeeting jika belum ada
    console.log("\n[2/4] Memeriksa keberadaan database 'appmeeting'...");
    try {
        const checkDb = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'appmeeting'");
        if (checkDb.rows.length === 0) {
            console.log("  -> Database 'appmeeting' belum ada. Membuat database baru...");
            await rootPool.query("CREATE DATABASE appmeeting");
            console.log("  [OK] Database 'appmeeting' berhasil dibuat!");
        } else {
            console.log("  [OK] Database 'appmeeting' sudah ada!");
        }
    } catch (dbErr) {
        console.warn("  ⚠️ Error memeriksa/membuat database:", dbErr.message);
    } finally {
        await rootPool.end();
    }

    // 3. Hubungkan langsung ke database 'appmeeting'
    console.log("\n[3/4] Menghubungkan ke database 'appmeeting'...");
    let appPool;
    try {
        appPool = new Pool({ ...dbConfig, database: "appmeeting" });
        await appPool.query("SELECT 1");
    } catch (appErr) {
        appPool = new Pool({ ...dbConfig, user: "postgres", password: "postgres", database: "appmeeting" });
        await appPool.query("SELECT 1");
    }
    console.log("  [OK] Berhasil masuk ke database 'appmeeting'!");

    // 4. Jika tabel belum ada, impor dari backup_local.sql
    try {
        const checkTables = await appPool.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
        `);
        if (checkTables.rows.length === 0) {
            console.log("  -> Tabel 'users' belum ada. Mengimpor skema dari backup_local.sql...");
            if (fs.existsSync("backup_local.sql")) {
                const sqlContent = fs.readFileSync("backup_local.sql", "utf-8");
                await appPool.query(sqlContent);
                console.log("  [OK] Skema tabel berhasil diimpor dari backup_local.sql!");
            }
        } else {
            console.log("  [OK] Tabel 'users' sudah tersedia!");
        }
    } catch (importErr) {
        console.warn("  ⚠️ Peringatan impor skema:", importErr.message);
    }

    // 5. Pastikan akun Admin dan User terdaftar dan passwordnya aktif
    console.log("\n[4/4] Mendaftarkan akun Administrator & User...");
    try {
        // Buat tabel users jika belum ada
        await appPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                full_name VARCHAR(255) DEFAULT 'Administrator BKN',
                nip VARCHAR(50) DEFAULT '198501012010011001',
                institution VARCHAR(255) DEFAULT 'Kantor Regional V BKN Jakarta',
                division VARCHAR(255) DEFAULT 'Pengelolaan Sistem Informasi Kepegawaian'
            );
        `);

        const adminHash = await bcrypt.hash("admin123", 10);
        const userHash = await bcrypt.hash("user123", 10);

        await appPool.query(`
            INSERT INTO users (id, username, password, role, full_name, nip, division)
            VALUES 
            ('admin', 'admin', $1, 'admin', 'Divisi Sidigi', '199505122020121005', 'Divisi Sidigi'),
            ('user', 'user', $2, 'user', 'Pegawai BKN', '1231236567', 'Divisi Pembinaan'),
            ('user2', 'user2', $2, 'user', 'user 2', '', 'Divisi Pemecatan')
            ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
        `, [adminHash, userHash]);

        console.log("==================================================");
        console.log("🎉 BERHASIL TOTAL! Akun siap digunakan untuk login:");
        console.log("--------------------------------------------------");
        console.log("👑 ADMIN -> Username: admin | Password: admin123");
        console.log("👤 USER  -> Username: user  | Password: user123");
        console.log("👤 USER2 -> Username: user2 | Password: user123");
        console.log("==================================================");
    } catch (userErr) {
        console.error("  ❌ Gagal mendaftarkan user:", userErr.message);
    } finally {
        await appPool.end();
        process.exit(0);
    }
}

setup();
