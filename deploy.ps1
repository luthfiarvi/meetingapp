
# ============================================================
#  DEPLOY SCRIPT - MeetingApp ke Server 84.247.160.55
#  Jalankan: .\deploy.ps1
# ============================================================

$SERVER   = "84.247.160.55"
$USER     = "magangit"
$DEST     = "/home/magangit/meetingapp"
$LOCAL    = "c:\Users\ThinkPad\OneDrive\Dokumen\BKN\meetingapp"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  DEPLOY MEETINGAPP KE SERVER" -ForegroundColor Cyan
Write-Host "  Target: $USER@$SERVER`:$DEST" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# ---- 1. Upload semua file project (kecuali node_modules & uploads) ----
Write-Host "`n[1/4] Upload file project ke server..." -ForegroundColor Yellow

$filesToUpload = @(
    "config",
    "controllers",
    "models",
    "routes",
    "views",
    "public",
    "meeting.js",
    "package.json",
    "package-lock.json"
)

foreach ($item in $filesToUpload) {
    $localPath = "$LOCAL\$item"
    if (Test-Path $localPath) {
        Write-Host "  -> Upload $item ..." -ForegroundColor Gray
        if ((Get-Item $localPath).PSIsContainer) {
            # Folder: pakai scp -r
            scp -r "$localPath" "${USER}@${SERVER}:${DEST}/"
        } else {
            # File biasa
            scp "$localPath" "${USER}@${SERVER}:${DEST}/"
        }
    }
}

Write-Host "[1/4] Upload file selesai!" -ForegroundColor Green

# ---- 2. Buat folder uploads/ttd di server ----
Write-Host "`n[2/4] Membuat folder uploads/ttd di server..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "mkdir -p $DEST/public/uploads/ttd && chmod 755 $DEST/public/uploads/ttd"
Write-Host "[2/4] Folder uploads/ttd siap!" -ForegroundColor Green

# ---- 3. Install dependencies di server ----
Write-Host "`n[3/4] Install npm dependencies di server..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" "cd $DEST && npm install --production"
Write-Host "[3/4] Dependencies terinstall!" -ForegroundColor Green

# ---- 4. Restart aplikasi di server ----
Write-Host "`n[4/4] Restart aplikasi di server..." -ForegroundColor Yellow
ssh "${USER}@${SERVER}" @"
cd $DEST
# Coba restart dengan pm2 dulu
if command -v pm2 &> /dev/null; then
    pm2 restart meetingapp 2>/dev/null || pm2 start meeting.js --name meetingapp
    pm2 save
    echo 'PM2 restart selesai'
else
    # Kalau tidak ada pm2, install dulu
    npm install -g pm2
    pm2 start meeting.js --name meetingapp
    pm2 save
    pm2 startup
    echo 'PM2 install & start selesai'
fi
"@
Write-Host "[4/4] Aplikasi berhasil di-restart!" -ForegroundColor Green

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  DEPLOY SELESAI!" -ForegroundColor Green
Write-Host "  Akses: http://${SERVER}:3000" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
