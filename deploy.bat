@echo off
set SERVER=84.247.160.55
set USER=magangit
set DEST=/home/magangit/meetingapp

echo ======================================
echo   DEPLOY MEETINGAPP KE SERVER
echo   Target: %USER%@%SERVER%:%DEST%
echo ======================================

echo.
echo [1/4] Upload file project ke server...
scp -r config controllers middleware models routes services views public meeting.js package.json package-lock.json %USER%@%SERVER%:%DEST%/
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal mengupload file ke server. Pastikan password benar atau koneksi stabil.
    exit /b %ERRORLEVEL%
)

echo [1/4] Upload file selesai!

echo.
echo [2/4] Memastikan folder uploads dan docs di server...
ssh %USER%@%SERVER% "mkdir -p %DEST%/public/uploads/ttd %DEST%/public/uploads/avatars %DEST%/public/uploads/evidence %DEST%/public/uploads/sertif %DEST%/public/uploads/videos %DEST%/public/uploads/thumbnails %DEST%/public/docs && chmod -R 755 %DEST%/public/uploads %DEST%/public/docs"

echo [2/4] Folder uploads dan docs siap!

echo.
echo [3/4] Install npm dependencies di server...
ssh %USER%@%SERVER% "cd %DEST% && npm install --production"

echo [3/4] Dependencies terinstall!

echo.
echo [4/4] Restart aplikasi di server...
ssh %USER%@%SERVER% "cd %DEST% && (pm2 restart meetingapp || pm2 start meeting.js --name meetingapp) && pm2 save"

echo [4/4] Aplikasi berhasil di-restart!

echo.
echo ======================================
echo   DEPLOY SELESAI!
echo   Akses: http://%SERVER%:3000
echo ======================================
