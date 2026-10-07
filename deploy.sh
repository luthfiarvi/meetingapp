#!/bin/bash
set -e

SERVER="84.247.160.55"
USER="magangit"
DEST="/home/magangit/meetingapp"

echo "============================================================"
echo "  CLEAN SYNC: CLONE LOKAL KE SERVER (84.247.160.55:3000)"
echo "============================================================"

echo ""
echo "[1/4] Mengekspor database lokal (PostgreSQL appmeeting)..."
export PGPASSWORD=postgres
if [ -f "/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" ]; then
    "/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" -U postgres -h localhost -p 5432 --clean --if-exists appmeeting -f backup_local.sql
elif [ -f "/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" ]; then
    "/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" -U postgres -h localhost -p 5432 --clean --if-exists appmeeting -f backup_local.sql
else
    pg_dump -U postgres -h localhost -p 5432 --clean --if-exists appmeeting -f backup_local.sql || true
fi

if [ -f backup_local.sql ]; then
    sed -i '/^\\restrict/d' backup_local.sql || true
    echo "  [OK] Database lokal berhasil diekspor ke backup_local.sql!"
fi

echo ""
echo "[2/4] Menyiapkan izin berkas dan mengompres paket proyek..."
attrib -r * /s /d 2>/dev/null || true
tar --format ustar -czf deploy_bundle.tar.gz config controllers middleware models routes services views public meeting.js meetingserver.js deploy_server.sh seed_users.js backup_local.sql package.json package-lock.json
echo "  [OK] Berkas proyek berhasil dikompres!"

echo ""
echo "[3/4] Mengunggah deploy_bundle.tar.gz ke server..."
scp deploy_bundle.tar.gz "${USER}@${SERVER}:/home/${USER}/"
rm -f deploy_bundle.tar.gz
echo "  [OK] Berkas arsip berhasil diunggah!"

echo ""
echo "[4/4] Melakukan sinkronisasi total di server..."
ssh -t "${USER}@${SERVER}" "bash -c 'set -e; rm -rf /home/magangit/meetingapp_new 2>/dev/null || true; mv /home/magangit/meetingapp /home/magangit/trash_app_\$(date +%s) 2>/dev/null || true; mkdir -p /home/magangit/meetingapp; tar --no-same-owner --overwrite -xzf /home/magangit/deploy_bundle.tar.gz -C /home/magangit/meetingapp/; rm -f /home/magangit/deploy_bundle.tar.gz; chmod -R 775 /home/magangit/meetingapp; chmod +x /home/magangit/meetingapp/deploy_server.sh; bash /home/magangit/meetingapp/deploy_server.sh; rm -rf /home/magangit/trash_app_* 2>/dev/null || true'"

echo ""
echo "============================================================"
echo "  SINKRONISASI SELESAI!"
echo "  Buka aplikasi di: http://${SERVER}:3000"
echo "============================================================"
