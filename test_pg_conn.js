import { Pool } from "pg";

const attempts = [
    { label: "1. Unix socket user magangit (no password)", config: { user: "magangit" } },
    { label: "2. Unix socket user postgres (no password)", config: { user: "postgres" } },
    { label: "3. Unix socket default", config: {} },
    { label: "4. TCP localhost magangit K@nreg5", config: { host: "localhost", user: "magangit", password: "K@nreg5" } },
    { label: "5. TCP localhost postgres postgres", config: { host: "localhost", user: "postgres", password: "postgres" } },
    { label: "6. TCP localhost postgres K@nreg5", config: { host: "localhost", user: "postgres", password: "K@nreg5" } },
    { label: "7. TCP localhost magangit postgres", config: { host: "localhost", user: "magangit", password: "postgres" } },
    { label: "8. TCP localhost magangit (no password)", config: { host: "localhost", user: "magangit", password: "" } },
    { label: "9. TCP localhost postgres (no password)", config: { host: "localhost", user: "postgres", password: "" } },
    { label: "10. TCP localhost postgres root", config: { host: "localhost", user: "postgres", password: "root" } },
    { label: "11. TCP localhost postgres admin", config: { host: "localhost", user: "postgres", password: "admin" } }
];

async function check() {
    console.log("Mencari metode koneksi PostgreSQL yang valid di server...\n");
    for (const a of attempts) {
        const p = new Pool({ ...a.config, database: "postgres", connectionTimeoutMillis: 1500 });
        try {
            const res = await p.query("SELECT current_user, current_database()");
            console.log(`✅ BERHASIL: [${a.label}]`);
            console.log(`   User: ${res.rows[0].current_user}, DB: ${res.rows[0].current_database}`);
            await p.end();
            return a.config;
        } catch (err) {
            console.log(`❌ Gagal: [${a.label}] -> ${err.message}`);
            await p.end().catch(() => {});
        }
    }
    console.log("\nSemua percobaan gagal.");
    process.exit(1);
}

check().then(async (validConfig) => {
    if (!validConfig) return;
    console.log("\nMenggunakan konfigurasi yang berhasil untuk membuat database & user...");
    const rootPool = new Pool({ ...validConfig, database: "postgres" });
    try {
        const checkDb = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'appmeeting'");
        if (checkDb.rows.length === 0) {
            await rootPool.query("CREATE DATABASE appmeeting");
            console.log("✅ Database 'appmeeting' berhasil dibuat!");
        } else {
            console.log("ℹ️ Database 'appmeeting' sudah ada.");
        }
    } catch (e) {
        console.log("Catatan pembuatan DB:", e.message);
    } finally {
        await rootPool.end();
    }

    const appPool = new Pool({ ...validConfig, database: "appmeeting" });
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

        const bcrypt = (await import("bcrypt")).default;
        const hash = await bcrypt.hash("54321", 10);

        await appPool.query(`
            INSERT INTO users (id, username, password, role, full_name, nip, division)
            VALUES ('198004082008121001', '198004082008121001', $1, 'admin', 'Administrator Kanreg V', '198004082008121001', 'Tim Kerja Sidigi')
            ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'admin';
        `, [hash]);

        console.log("\n🎉 BERHASIL MENDAFTARKAN ADMIN!");
        console.log("👑 User ID  : 198004082008121001");
        console.log("🔑 Password : 54321");
        console.log("🛡️ Role     : admin");
    } catch (e) {
        console.error("Gagal membuat user:", e.message);
    } finally {
        await appPool.end();
        process.exit(0);
    }
});
