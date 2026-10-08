import pool from "./config/database.js";
import bcrypt from "bcrypt";

async function run() {
    try {
        console.log("Menghubungkan ke database...");

        // 1. Cek kolom apa saja yang ada di tabel users pada database
        const colRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const existingCols = colRes.rows.map(r => r.column_name.toLowerCase());
        console.log("Kolom yang ada di tabel users server:", existingCols);

        // 2. Hash password
        const adminHash = await bcrypt.hash("admin123", 10);
        const userHash = await bcrypt.hash("user123", 10);

        // 3. Masukkan data sesuai dengan kolom yang memang tersedia di tabel
        if (existingCols.includes("username") && existingCols.includes("full_name")) {
            await pool.query(`
                INSERT INTO users (id, username, password, role, full_name, nip, division)
                VALUES 
                ('admin', 'admin', $1, 'admin', 'Divisi Sidigi', '199505122020121005', 'Divisi Sidigi'),
                ('user', 'user', $2, 'user', 'Pegawai BKN', '1231236567', 'Divisi Pembinaan'),
                ('user2', 'user2', $2, 'user', 'user 2', '', 'Divisi Pemecatan')
                ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
            `, [adminHash, userHash]);
        } else if (existingCols.includes("username")) {
            await pool.query(`
                INSERT INTO users (id, username, password, role)
                VALUES 
                ('admin', 'admin', $1, 'admin'),
                ('user', 'user', $2, 'user'),
                ('user2', 'user2', $2, 'user')
                ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
            `, [adminHash, userHash]);
        } else if (existingCols.includes("password")) {
            await pool.query(`
                INSERT INTO users (id, password, role)
                VALUES 
                ('admin', $1, 'admin'),
                ('user', $2, 'user'),
                ('user2', $2, 'user')
                ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
            `, [adminHash, userHash]);
        }

        console.log("==================================================");
        console.log("✅ BERHASIL! Akun admin dan user siap digunakan:");
        console.log("1. Admin -> ID: admin | Password: admin123");
        console.log("2. User  -> ID: user  | Password: user123");
        console.log("3. User2 -> ID: user2 | Password: user123");
        console.log("==================================================");

        const checkUsers = await pool.query("SELECT * FROM users");
        console.log("Data user di database:", checkUsers.rows);

        process.exit(0);
    } catch (e) {
        console.error("Gagal:", e.message);
        process.exit(1);
    }
}
run();
