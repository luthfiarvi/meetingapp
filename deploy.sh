#!/bin/bash
set -e

SERVER="84.247.160.55"
USER="magangit"
DEST="/home/magangit/meetingapp"

echo "======================================"
echo "  DEPLOY MEETINGAPP KE SERVER"
echo "  Target: $USER@$SERVER:$DEST"
echo "======================================"

echo ""
echo "[1/4] Upload file project ke server..."
scp -r config controllers middleware models routes services views public meeting.js package.json package-lock.json "${USER}@${SERVER}:${DEST}/"
echo "[1/4] Upload file selesai!"

echo ""
echo "[2/4] Memastikan folder uploads dan docs di server..."
ssh "${USER}@${SERVER}" "mkdir -p $DEST/public/uploads/{ttd,avatars,evidence,sertif,videos,thumbnails} $DEST/public/docs && chmod -R 755 $DEST/public/uploads $DEST/public/docs"
echo "[2/4] Folder uploads & docs siap!"

echo ""
echo "[3/4] Install npm dependencies di server..."
ssh "${USER}@${SERVER}" "cd $DEST && npm install --production"
echo "[3/4] Dependencies terinstall!"

echo ""
echo "[4/4] Restart aplikasi di server..."
ssh "${USER}@${SERVER}" "cd $DEST && (pm2 restart meetingapp || pm2 start meeting.js --name meetingapp) && pm2 save"
echo "[4/4] Aplikasi berhasil di-restart!"

echo ""
echo "======================================"
echo "  DEPLOY SELESAI!"
echo "  Akses: http://${SERVER}:3000"
echo "======================================"
