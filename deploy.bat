@echo off
setlocal enabledelayedexpansion

set SERVER=84.247.160.55
set USER=magangit
set DEST=/home/magangit/meetingapp

echo ============================================================
echo   CLEAN SYNC: CLONE LOKAL KE SERVER (84.247.160.55:3000)
echo ============================================================
echo.

:: 1. Export database lokal
echo [1/4] Mengekspor database lokal (PostgreSQL appmeeting)...
set PGPASSWORD=postgres
set DUMP_CMD=
if exist "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" set "DUMP_CMD=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
if not defined DUMP_CMD if exist "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" set "DUMP_CMD=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if not defined DUMP_CMD set "DUMP_CMD=pg_dump"

"%DUMP_CMD%" -U postgres -h localhost -p 5432 --clean --if-exists appmeeting -f backup_local.sql 2>nul
if %ERRORLEVEL% EQU 0 (
    powershell -Command "(Get-Content backup_local.sql) | Where-Object { $_ -notmatch '^\\restrict' } | Set-Content backup_local.sql -Encoding UTF8" 2>nul
    echo   [OK] Database lokal berhasil diekspor ke backup_local.sql!
) else (
    echo   [INFO] Menggunakan file backup_local.sql yang sudah ada.
)

:: 2. Hilangkan atribut ReadOnly (OneDrive) dan kompresi ustar POSIX murni
echo.
echo [2/4] Menyiapkan izin berkas dan mengompres paket proyek...
attrib -r * /s /d >nul 2>&1
tar --format ustar -czf deploy_bundle.tar.gz config controllers middleware models routes services views public meeting.js meetingserver.js deploy_server.sh seed_users.js check_db.js backup_local.sql package.json package-lock.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal membuat arsip kompresi.
    pause
    exit /b %ERRORLEVEL%
)
echo   [OK] Seluruh berkas (dengan izin tulis penuh) berhasil dikompres!

:: 3. Upload arsip ke direktori home
echo.
echo [3/4] Mengunggah deploy_bundle.tar.gz ke server...
echo       (Masukkan password user %USER% jika diminta)
scp deploy_bundle.tar.gz %USER%@%SERVER%:/home/%USER%/
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal mengunggah file. Pastikan password benar dan server dapat dijangkau.
    del /f /q deploy_bundle.tar.gz 2>nul
    pause
    exit /b %ERRORLEVEL%
)
del /f /q deploy_bundle.tar.gz 2>nul
echo   [OK] Arsip proyek berhasil diunggah!

:: 4. Ekstrak bersih, reset total di server (tanpa butuh sudo)
echo.
echo [4/4] Mengekstrak bersih, merestore database, dan merestart aplikasi di server...
echo       (Masukkan password user %USER% jika diminta)
ssh -t %USER%@%SERVER% "bash -c 'tar --no-same-owner --overwrite -xzf /home/magangit/deploy_bundle.tar.gz -C /home/magangit/meetingapp/ 2>/dev/null || (mkdir -p /home/magangit/meetingapp && tar --no-same-owner --overwrite -xzf /home/magangit/deploy_bundle.tar.gz -C /home/magangit/meetingapp/); rm -f /home/magangit/deploy_bundle.tar.gz; chmod -R 775 /home/magangit/meetingapp 2>/dev/null || true; chmod +x /home/magangit/meetingapp/deploy_server.sh; bash /home/magangit/meetingapp/deploy_server.sh'"

echo.
echo ============================================================
echo   SINKRONISASI SELESAI!
echo   Buka aplikasi di: http://%SERVER%:3000
echo ============================================================
pause
