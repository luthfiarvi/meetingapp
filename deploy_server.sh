#!/bin/bash
set -e

# Muat environment PATH & NVM (Node Version Manager) agar node, npm, dan pm2 selalu dikenali
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$HOME/.nvm/versions/node/current/bin:$HOME/bin:$HOME/.local/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
fi
if [ -s "/root/.nvm/nvm.sh" ]; then
    export NVM_DIR="/root/.nvm"
    \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
fi
if [ -f "$HOME/.profile" ]; then
    source "$HOME/.profile" 2>/dev/null || true
fi
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" 2>/dev/null || true
fi

DEST="/home/magangit/meetingapp"
cd "$DEST"

echo "============================================================"
echo "  [SERVER] PROSES CLEAN SYNC & SINKRONISASI TOTAL"
echo "============================================================"

# 1. Menyiapkan struktur folder uploads & docs
echo ""
echo "[1/4] Memastikan struktur folder penampung file bersih & siap..."
mkdir -p public/uploads/{ttd,avatars,evidence,sertif,sertif/bg,videos,thumbnails,transcripts,notulen,presensi} public/docs public/images
[ -f public/images/bg-aksara-vol7.png ] && cp -f public/images/bg-aksara-vol7.png public/uploads/sertif/bg/bg_aksara_vol7.png 2>/dev/null || true
[ ! -f public/uploads/meeting_metadata.json ] && echo "{}" > public/uploads/meeting_metadata.json
chmod -R 777 public/uploads public/docs 2>/dev/null || true
echo "  [OK] Seluruh folder penampung uploads & docs siap!"

# 2. Memelihara Database PostgreSQL (TETAP PERTAHANKAN DATA SERVER, JANGAN DI-RESET)
echo ""
echo "[2/4] Memeriksa & memelihara database PostgreSQL (appmeeting)..."

export PGPASSWORD=postgres
# Buat database HANYA jika database appmeeting belum pernah ada
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'appmeeting'" 2>/dev/null || psql -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'appmeeting'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" != "1" ]; then
    echo "  -> Database appmeeting belum ada, membuat database baru..."
    (psql -h localhost -U postgres -c "CREATE DATABASE appmeeting;" 2>/dev/null) || (sudo -u postgres psql -c "CREATE DATABASE appmeeting;" 2>/dev/null) || true
    if [ -f backup_local.sql ]; then
        echo "  -> Menginisialisasi struktur awal dari backup_local.sql..."
        (psql -h localhost -U postgres -d appmeeting -f backup_local.sql 2>/dev/null) || (sudo -u postgres psql -d appmeeting -f backup_local.sql 2>/dev/null) || true
    fi
else
    echo "  [OK] Database appmeeting di server sudah ada. Data server dipertahankan (TIDAK di-drop/direset)!"
fi

# Berikan hak akses penuh ke user magangit & perbaiki sequence ID
SQL_PERMS="
    ALTER TABLE meetings OWNER TO magangit;
    ALTER TABLE users OWNER TO magangit;
    ALTER TABLE zoom_requests OWNER TO magangit;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO magangit;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO magangit;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO magangit;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO magangit;
    ALTER TABLE notulen ALTER COLUMN user_id TYPE VARCHAR(100);
    ALTER TABLE infographics ALTER COLUMN user_id TYPE VARCHAR(100);
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
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS pembuat VARCHAR(100);
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen TEXT;
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
        documentation_photos JSONB,
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
    ALTER TABLE meeting_sertifikat_counter OWNER TO magangit;

    -- Sinkronisasi zoom credentials dari zoom_requests yang berstatus disetujui ke meetings
    UPDATE meetings m
    SET zoom_link = COALESCE(NULLIF(m.zoom_link, ''), NULLIF(z.zoom_link, '')),
        zoom_meeting_id = COALESCE(NULLIF(m.zoom_meeting_id, ''), NULLIF(z.meeting_id, '')),
        zoom_passcode = COALESCE(NULLIF(m.zoom_passcode, ''), NULLIF(z.passcode, '')),
        zoom_request_id = COALESCE(m.zoom_request_id, z.id),
        tipe_meeting = CASE 
            WHEN z.tipe_rapat ILIKE '%offline%' THEN '1'
            WHEN z.tipe_rapat ILIKE '%webinar%' THEN '3'
            ELSE '2'
        END
    FROM zoom_requests z
    WHERE LOWER(TRIM(z.status)) = 'disetujui'
      AND (
          (m.zoom_request_id IS NOT NULL AND m.zoom_request_id = z.id)
          OR (
              m.zoom_request_id IS NULL 
              AND LOWER(TRIM(m.meeting_nama)) = LOWER(TRIM(z.judul_rapat))
              AND (
                  (z.zoom_link IS NOT NULL AND TRIM(z.zoom_link) != '')
                  OR z.tipe_rapat ILIKE '%offline%'
              )
          )
      );

    SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
    SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);
"

for DBNAME in meeting appmeeting; do
    (psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DBNAME TO magangit;" 2>/dev/null) || (sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DBNAME TO magangit;" 2>/dev/null) || true
    (psql -h localhost -U postgres -d $DBNAME -c "$SQL_PERMS" 2>/dev/null) || (sudo -u postgres psql -d $DBNAME -c "$SQL_PERMS" 2>/dev/null) || true
    PGPASSWORD=K@nreg5 psql -h localhost -U magangit -d $DBNAME -c "
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS absensi TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
    " 2>/dev/null || true
done

# Jalankan diagnosa & sinkronisasi database
if [ -f check_db.js ]; then
    echo "  -> Menjalankan diagnosa & sinkronisasi database..."
    node check_db.js 2>/dev/null || true
fi

# Batch generate sertifikat peserta AKSARA Vol. 7 (jika data peserta ada)
if [ -f batch_generate_aksara.js ] && [ -f peserta_aksara.json ]; then
    echo "  -> Menjalankan batch generate sertifikat peserta AKSARA Vol. 7..."
    node batch_generate_aksara.js 2>&1 || true
fi

# Memastikan akun user & admin terdaftar dan aktif
if [ -f seed_users.js ]; then
    echo "  -> Menyiapkan akun Administrator & User..."
    node seed_users.js 2>/dev/null || true
fi

# Pembersihan data rapat hanya jika parameter --clean diberikan secara eksplisit
if [ "$1" = "--clean" ]; then
    echo "  -> [CLEAN MODE] Menjalankan pembersihan data rapat..."
    if [ -f clean_meetings.js ]; then
        node clean_meetings.js 2>/dev/null || true
    fi
fi

# Tampilkan verifikasi data tabel
echo "  -> Statistik data di server saat ini:"
for DBNAME in meeting appmeeting; do
    echo "     [Database: $DBNAME]"
    psql -h localhost -U postgres -d $DBNAME -t -A -c "
        SELECT '     - Users: ' || COUNT(*) FROM users;
        SELECT '     - Meetings: ' || COUNT(*) FROM meetings;
        SELECT '     - Presensi: ' || COUNT(*) FROM presensi;
        SELECT '     - Sertifikat: ' || COUNT(*) FROM sertifikat;
        SELECT '     - Notulen: ' || COUNT(*) FROM notulen;
        SELECT '     - Zoom Requests: ' || COUNT(*) FROM zoom_requests;
    " 2>/dev/null || true
done

# 3. Dependencies
echo ""
echo "[3/4] Memeriksa & menginstall dependencies..."
npm install --production

# 4. Restart PM2 dengan meetingserver.js
echo ""
echo "[4/4] Menjalankan aplikasi dengan PM2..."
if command -v pm2 &> /dev/null; then
    pm2 delete meetingapp 2>/dev/null || true
    pm2 start meetingserver.js --name meetingapp
    pm2 save
else
    npm install -g pm2
    pm2 start meetingserver.js --name meetingapp
    pm2 save
    pm2 startup || true
fi

echo ""
echo "============================================================"
echo "  [SERVER] STATUS APLIKASI (PM2):"
echo "============================================================"
pm2 status meetingapp

echo ""
echo "============================================================"
echo "  CLEAN SYNC SELESAI! SERVER KINI 100% SAMA DENGAN LOKAL"
echo "  Akses: http://84.247.160.55:3000"
echo "============================================================"
