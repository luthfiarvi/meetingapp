# ============================================================
#  DEPLOY SCRIPT - MeetingApp ke Server 84.247.160.55
#  Jalankan: .\deploy.ps1
# ============================================================

$SERVER   = "84.247.160.55"
$USER     = "magangit"
$DEST     = "/home/magangit/meetingapp"
$LOCAL    = if ($PSScriptRoot) { $PSScriptRoot } else { "c:\Users\ThinkPad\OneDrive\Dokumen\BKN\meetingapp" }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CLEAN SYNC: CLONE LOKAL KE SERVER (84.247.160.55:3000)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ---- 1. Export database lokal PostgreSQL ----
Write-Host "`n[1/4] Mengekspor database lokal (PostgreSQL appmeeting)..." -ForegroundColor Yellow

$pgDump = (Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "pg_dump.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*\bin\pg_dump.exe" } | Select-Object -ExpandProperty FullName -First 1)

if (-not $pgDump) {
    if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
        $pgDump = "pg_dump"
    }
}

if ($pgDump) {
    $env:PGPASSWORD = "postgres"
    & $pgDump -U postgres -h localhost -p 5432 --clean --if-exists appmeeting -f "$LOCAL\backup_local.sql"
    if ($LASTEXITCODE -eq 0) {
        (Get-Content "$LOCAL\backup_local.sql") | Where-Object { $_ -notmatch '^\\restrict' } | Set-Content "$LOCAL\backup_local.sql" -Encoding UTF8
        Write-Host "  [OK] Database lokal berhasil diekspor ke backup_local.sql!" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Menggunakan backup_local.sql yang sudah ada." -ForegroundColor Gray
    }
} else {
    Write-Host "  [INFO] pg_dump tidak terdeteksi, menggunakan backup_local.sql yang sudah ada." -ForegroundColor Gray
}

# ---- 2. Hilangkan atribut ReadOnly (OneDrive) dan kompresi ustar POSIX ----
Write-Host "`n[2/4] Menyiapkan izin berkas dan mengompres paket proyek..." -ForegroundColor Yellow

attrib -r "$LOCAL\*" /s /d 2>$null

tar --format ustar -czf "$LOCAL\deploy_bundle.tar.gz" config controllers middleware models routes services views public meeting.js meetingserver.js deploy_server.sh seed_users.js backup_local.sql package.json package-lock.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal membuat file arsip kompresi." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "  [OK] Seluruh berkas (dengan izin tulis penuh) berhasil dikompres!" -ForegroundColor Green

# ---- 3. Upload deploy_bundle.tar.gz ke /home/magangit/ ----
Write-Host "`n[3/4] Mengunggah deploy_bundle.tar.gz ke server..." -ForegroundColor Yellow
Write-Host "      (Masukkan password user $USER jika diminta)" -ForegroundColor Gray

scp "$LOCAL\deploy_bundle.tar.gz" "${USER}@${SERVER}:/home/${USER}/"

if (Test-Path "$LOCAL\deploy_bundle.tar.gz") {
    Remove-Item "$LOCAL\deploy_bundle.tar.gz" -Force
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Gagal mengunggah arsip. Pastikan password benar." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "  [OK] Berkas arsip berhasil diunggah!" -ForegroundColor Green

# ---- 4. Eksekusi remote di server (1 sesi SSH) ----
Write-Host "`n[4/4] Melakukan sinkronisasi total di server..." -ForegroundColor Yellow
Write-Host "      (Masukkan password user $USER jika diminta)" -ForegroundColor Gray

ssh -t "${USER}@${SERVER}" "bash -c 'set -e; rm -rf /home/magangit/meetingapp_new 2>/dev/null || true; mv /home/magangit/meetingapp /home/magangit/trash_app_\$(date +%s) 2>/dev/null || true; mkdir -p /home/magangit/meetingapp; tar --no-same-owner --overwrite -xzf /home/magangit/deploy_bundle.tar.gz -C /home/magangit/meetingapp/; rm -f /home/magangit/deploy_bundle.tar.gz; chmod -R 775 /home/magangit/meetingapp; chmod +x /home/magangit/meetingapp/deploy_server.sh; bash /home/magangit/meetingapp/deploy_server.sh; rm -rf /home/magangit/trash_app_* 2>/dev/null || true'"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  SINKRONISASI SELESAI!" -ForegroundColor Green
Write-Host "  Buka aplikasi di: http://${SERVER}:3000" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
