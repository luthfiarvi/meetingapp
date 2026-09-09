#!/bin/bash
# ============================================================
#  SETUP DATABASE - Jalankan di SERVER via SSH
#  ssh magangit@84.247.160.55 "bash ~/meetingapp/setup_db.sh"
# ============================================================

echo "======================================"
echo "  SETUP DATABASE appmeeting di Server"
echo "======================================"

# Buat database jika belum ada
echo "[1/3] Membuat database appmeeting..."
sudo -u postgres psql -c "CREATE DATABASE appmeeting;" 2>/dev/null || echo "  -> Database sudah ada, skip."

# Buat user / update password kalau perlu
echo "[2/3] Konfigurasi user postgres..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

# Buat semua tabel yang dibutuhkan
echo "[3/3] Membuat tabel-tabel..."
sudo -u postgres psql -d appmeeting << 'SQL'

-- Tabel pegawai/users
CREATE TABLE IF NOT EXISTS pegawai (
  nip VARCHAR(50) PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  jabatan VARCHAR(100),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'peserta'
);

-- Tabel rapat/meeting
CREATE TABLE IF NOT EXISTS rapat (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(255) NOT NULL,
  tanggal DATE NOT NULL,
  waktu_mulai TIME,
  waktu_selesai TIME,
  lokasi VARCHAR(255),
  agenda TEXT,
  dibuat_oleh VARCHAR(50)
);

-- Tabel peserta rapat
CREATE TABLE IF NOT EXISTS peserta_rapat (
  id SERIAL PRIMARY KEY,
  id_rapat INTEGER REFERENCES rapat(id) ON DELETE CASCADE,
  nip VARCHAR(50) REFERENCES pegawai(nip) ON DELETE CASCADE
);

-- Tabel presensi
CREATE TABLE IF NOT EXISTS presensi (
  id SERIAL PRIMARY KEY,
  id_rapat INTEGER REFERENCES rapat(id) ON DELETE CASCADE,
  nip VARCHAR(50) NOT NULL,
  status_kehadiran VARCHAR(20) DEFAULT 'hadir',
  tanda_tangan VARCHAR(255),
  waktu_presensi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index agar query lebih cepat
CREATE INDEX IF NOT EXISTS idx_presensi_rapat ON presensi(id_rapat);
CREATE INDEX IF NOT EXISTS idx_presensi_nip ON presensi(nip);

SQL

echo ""
echo "======================================"
echo "  DATABASE SETUP SELESAI!"
echo "======================================"
