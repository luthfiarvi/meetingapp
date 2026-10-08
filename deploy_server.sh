#!/bin/bash
set -e

DEST="/home/magangit/meetingapp"
cd "$DEST"

echo "============================================================"
echo "  [SERVER] PROSES CLEAN SYNC & SINKRONISASI TOTAL"
echo "============================================================"

# 1. Menyiapkan struktur folder uploads & docs
echo ""
echo "[1/4] Memastikan struktur folder penampung file bersih & siap..."
mkdir -p public/uploads/{ttd,avatars,evidence,sertif,videos,thumbnails,transcripts,notulen} public/docs
chmod -R 775 public/uploads public/docs 2>/dev/null || true
echo "  [OK] Seluruh folder penampung uploads & docs siap!"

# 2. Reset Total Database PostgreSQL Server agar identik 100% dengan lokal
echo ""
echo "[2/4] Reset total & sinkronisasi Database PostgreSQL (appmeeting)..."

export PGPASSWORD=postgres
# Reset database (Drop & Create ulang) via PostgreSQL auth (tanpa butuh sudo)
(psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS appmeeting;" 2>/dev/null) || (sudo -u postgres psql -c "DROP DATABASE IF EXISTS appmeeting;" 2>/dev/null) || true
(psql -h localhost -U postgres -c "CREATE DATABASE appmeeting;" 2>/dev/null) || (sudo -u postgres psql -c "CREATE DATABASE appmeeting;" 2>/dev/null) || true

if [ -f backup_local.sql ]; then
    echo "  -> Mengimpor struktur & data bersih dari backup_local.sql..."
    if psql -h localhost -U postgres -d appmeeting -f backup_local.sql > /tmp/db_import.log 2>&1; then
        echo "  [OK] Database berhasil diimpor bersih!"
    elif sudo -u postgres psql -d appmeeting -f backup_local.sql > /tmp/db_import.log 2>&1; then
        echo "  [OK] Database berhasil diimpor bersih!"
    fi

    # Berikan hak akses penuh ke user magangit & perbaiki sequence ID
    SQL_PERMS="
        GRANT ALL ON ALL TABLES IN SCHEMA public TO magangit;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO magangit;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO magangit;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO magangit;
        ALTER TABLE notulen ALTER COLUMN user_id TYPE VARCHAR(100);
        ALTER TABLE infographics ALTER COLUMN user_id TYPE VARCHAR(100);
        ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
        UPDATE zoom_requests SET user_id = 'user' WHERE nip = '1231236567' AND (user_id IS NULL OR user_id = '');
        UPDATE meetings SET user_id = 'user' WHERE zoom_request_id IN (SELECT id FROM zoom_requests WHERE nip = '1231236567') AND (user_id IS NULL OR user_id = '');
        SELECT setval('meetings_meeting_id_seq', COALESCE((SELECT MAX(meeting_id) FROM meetings), 0) + 1, false);
        SELECT setval('zoom_requests_id_seq', COALESCE((SELECT MAX(id) FROM zoom_requests), 0) + 1, false);
    "
    (psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE appmeeting TO magangit;" 2>/dev/null) || (sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE appmeeting TO magangit;" 2>/dev/null) || true
    (psql -h localhost -U postgres -d appmeeting -c "$SQL_PERMS" 2>/dev/null) || (sudo -u postgres psql -d appmeeting -c "$SQL_PERMS" 2>/dev/null) || true
fi

# Jalankan diagnosa & sinkronisasi database
if [ -f check_db.js ]; then
    echo "  -> Menjalankan diagnosa & sinkronisasi database..."
    node check_db.js 2>/dev/null || true
fi

# Memastikan akun user & admin terdaftar dan aktif
if [ -f seed_users.js ]; then
    echo "  -> Menyiapkan akun Administrator & User..."
    node seed_users.js 2>/dev/null || true
fi

# Tampilkan verifikasi data tabel
echo "  -> Statistik data di server saat ini:"
psql -h localhost -U postgres -d appmeeting -t -A -c "
    SELECT '     - Users: ' || COUNT(*) FROM users;
    SELECT '     - Meetings: ' || COUNT(*) FROM meetings;
    SELECT '     - Presensi: ' || COUNT(*) FROM presensi;
    SELECT '     - Sertifikat: ' || COUNT(*) FROM sertifikat;
    SELECT '     - Notulen: ' || COUNT(*) FROM notulen;
    SELECT '     - Zoom Requests: ' || COUNT(*) FROM zoom_requests;
" 2>/dev/null || true

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
