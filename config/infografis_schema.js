import pool from "./database.js";

export async function initInfografisSchema() {
  try {
    // 1. Pastikan kolom-kolom profil, header & footer ada pada tabel users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          username VARCHAR(100) UNIQUE,
          password VARCHAR(255),
          role VARCHAR(50) DEFAULT 'admin'
      );

      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
              ALTER TABLE users ADD COLUMN full_name VARCHAR(255) DEFAULT 'Administrator BKN';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='nip') THEN
              ALTER TABLE users ADD COLUMN nip VARCHAR(50) DEFAULT '198501012010011001';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='institution') THEN
              ALTER TABLE users ADD COLUMN institution VARCHAR(255) DEFAULT 'Kantor Regional V BKN Jakarta';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='division') THEN
              ALTER TABLE users ADD COLUMN division VARCHAR(255) DEFAULT 'Pengelolaan Sistem Informasi Kepegawaian';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mentor_name') THEN
              ALTER TABLE users ADD COLUMN mentor_name VARCHAR(255) DEFAULT 'Pembimbing Kepegawaian';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='logo_path') THEN
              ALTER TABLE users ADD COLUMN logo_path VARCHAR(255) DEFAULT '/images/Logo_Badan_Kepegawaian_Negara.png';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_path') THEN
              ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255) DEFAULT '/images/default_avatar.png';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='institution_kop') THEN
              ALTER TABLE users ADD COLUMN institution_kop VARCHAR(255) DEFAULT 'BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kop_address') THEN
              ALTER TABLE users ADD COLUMN kop_address TEXT DEFAULT 'Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kop_contact') THEN
              ALTER TABLE users ADD COLUMN kop_contact TEXT DEFAULT 'Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sig_city') THEN
              ALTER TABLE users ADD COLUMN sig_city VARCHAR(100) DEFAULT 'Jakarta';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='running_footer') THEN
              ALTER TABLE users ADD COLUMN running_footer VARCHAR(255) DEFAULT 'Dokumen Resmi Kanreg V BKN';
          END IF;
      END $$;
    `);

    // 2. Pastikan user admin dan user default selalu ada
    await pool.query(`
      INSERT INTO users (id, username, password, role, full_name, nip, institution, division)
      VALUES (
          'admin',
          'admin',
          '$2b$10$/oysItNRvGYgPbT7oodQReeeuAutve0PTyEw3QRnrhka0n53iQ8Sa',
          'admin',
          'Divisi Sidigi',
          '199505122020121005',
          'Kantor Regional V BKN Jakarta',
          'Pranata Komputer Ahli Pertama'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO users (id, username, password, role, full_name, nip, institution, division)
      VALUES (
          'user',
          'user',
          '$2b$10$PqIK6P.yUE/yBMKZW/A0zOib1cvav9TtGVi4qXvkimdX5JiWjrRIy',
          'user',
          'user bkn',
          '1231236567',
          'Kantor Regional V BKN Jakarta',
          'Pegawai BKN'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO users (id, username, password, role, full_name, nip, institution, division)
      VALUES (
          'user2',
          'user2',
          '$2b$10$1ROM/aQMS.6iPlR2Fa.t.unYb5VxhnrOLInxxNN6gz2RdLVJ1aQSm',
          'user',
          'user 2',
          '1231236568',
          'Kantor Regional V BKN Jakarta',
          'Pegawai BKN'
      ) ON CONFLICT (id) DO NOTHING;
    `);

    // Pastikan user admin default terisi data lengkap profil, header & footer
    await pool.query(`
      UPDATE users SET
        full_name = COALESCE(full_name, 'Administrator BKN'),
        nip = COALESCE(nip, '198501012010011001'),
        institution = COALESCE(institution, 'Kantor Regional V BKN Jakarta'),
        division = COALESCE(division, 'Pengelolaan Sistem Informasi Kepegawaian'),
        mentor_name = COALESCE(mentor_name, 'Pembimbing Kepegawaian'),
        logo_path = COALESCE(logo_path, '/images/Logo_Badan_Kepegawaian_Negara.png'),
        avatar_path = COALESCE(avatar_path, '/images/default_avatar.png'),
        institution_kop = COALESCE(institution_kop, 'BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V'),
        kop_address = COALESCE(kop_address, 'Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730'),
        kop_contact = COALESCE(kop_contact, 'Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id'),
        sig_city = COALESCE(sig_city, 'Jakarta'),
        running_footer = COALESCE(running_footer, 'Dokumen Resmi Kanreg V BKN')
      WHERE full_name IS NULL OR institution_kop IS NULL;
    `);

    // 2. Skema Tabel Infographics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS infographics (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(100),
          report_title VARCHAR(500) NOT NULL,
          report_subtitle VARCHAR(500),
          report_date DATE NOT NULL,
          metrics_data JSONB NOT NULL DEFAULT '[]',
          pillars_data JSONB NOT NULL DEFAULT '[]',
          table_rows JSONB NOT NULL DEFAULT '[]',
          visual_evidence JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='infographics' AND column_name='visual_evidence') THEN
              ALTER TABLE infographics ADD COLUMN visual_evidence JSONB DEFAULT '[]';
          END IF;
      END $$;
    `);

    // 3. Skema Tabel Notulen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notulen (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(100),
          title VARCHAR(500) NOT NULL,
          meeting_date DATE NOT NULL,
          meeting_time VARCHAR(100) NOT NULL,
          meeting_place VARCHAR(255) NOT NULL,
          agenda_data JSONB NOT NULL DEFAULT '[]',
          attendees_data JSONB NOT NULL DEFAULT '[]',
          activities_data JSONB NOT NULL DEFAULT '[]',
          action_items JSONB NOT NULL DEFAULT '[]',
          conclusions JSONB NOT NULL DEFAULT '[]',
          closing_text TEXT,
          documentation_photos JSONB DEFAULT '[]',
          notulis_name VARCHAR(255),
          notulis_role VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notulen' AND column_name='documentation_photos') THEN
              ALTER TABLE notulen ADD COLUMN documentation_photos JSONB DEFAULT '[]';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notulen' AND column_name='meeting_id') THEN
              ALTER TABLE notulen ADD COLUMN meeting_id INT;
          END IF;
      END $$;
    `);

    console.log("✅ Skema database users (profil, header, footer), infografis, & notulen berhasil diverifikasi.");
  } catch (err) {
    console.warn("⚠️ [DATABASE SCHEMA WARNING]:", err.message);
  }
}

export default initInfografisSchema;
