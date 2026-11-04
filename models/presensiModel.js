import pool from "../config/database.js";
import { getMeetingById as getMeetingFromModel } from "./meetingModel.js";

// ============================================================
// Helper: Pastikan tabel sertifikat sudah ada di database
// ============================================================
async function ensureSertifikatTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sertifikat (
                id          SERIAL PRIMARY KEY,
                nama        VARCHAR(255) NOT NULL,
                nip         VARCHAR(100),
                meeting_id  VARCHAR(100) NOT NULL,
                file_path   VARCHAR(500) NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_sertif_meeting ON sertifikat(meeting_id);
        `);
    } catch (err) {
        console.warn("⚠️ Gagal memastikan tabel sertifikat:", err.message);
    }
}

// Storage cache for local development and offline DB fallback
const devPresensiStore = [];

export const createPresensi = async ({
    meeting_id,
    nama,
    nip,
    instansi,
    jabatan,
    email,
    keterangan,
    tanda_tangan
}) => {
    const formattedNow = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    const fallbackRecord = {
        id: devPresensiStore.length + 1,
        meeting_id: String(meeting_id),
        nama,
        nip: nip || "-",
        instansi: instansi || "-",
        jabatan: jabatan || "-",
        email: email || "-",
        keterangan: keterangan || "-",
        tanda_tangan,
        waktu_presensi: formattedNow
    };

    try {
        const result = await pool.query(
            `INSERT INTO presensi (
                meeting_id,
                nama,
                nip,
                instansi,
                jabatan,
                email,
                keterangan,
                tanda_tangan
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *`,
            [
                meeting_id,
                nama,
                nip || "-",
                instansi || "-",
                jabatan || "-",
                email || "-",
                keterangan || "-",
                tanda_tangan
            ]
        );

        if (result.rows && result.rows[0]) {
            const saved = {
                ...result.rows[0],
                waktu_presensi: result.rows[0].waktu_presensi || formattedNow
            };
            devPresensiStore.unshift(saved);
            return saved;
        }

        devPresensiStore.unshift(fallbackRecord);
        return fallbackRecord;

    } catch (err) {
        console.warn(
            "⚠️ [DEV MODE] PostgreSQL database error in createPresensi:",
            err.message
        );

        devPresensiStore.unshift(fallbackRecord);
        return fallbackRecord;
    }
};

export const getPresensiByMeeting = async (meeting_id) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM presensi
             WHERE meeting_id = $1
             ORDER BY waktu_presensi DESC`,
            [meeting_id]
        );

        if (result.rows && result.rows.length > 0) {
            return result.rows;
        }

        const matched = devPresensiStore.filter(
            (item) => String(item.meeting_id) === String(meeting_id)
        );
        return matched;

    } catch (err) {
        console.warn(
            "⚠️ [DEV MODE] PostgreSQL database error in getPresensiByMeeting:",
            err.message
        );

        const matched = devPresensiStore.filter(
            (item) => String(item.meeting_id) === String(meeting_id)
        );
        return matched;
    }
};

// ============================================================
// Ambil data meeting berdasarkan ID (termasuk tipe_meeting)
// ============================================================
export const getMeetingById = async (meeting_id) => {
    try {
        const fullMeeting = await getMeetingFromModel(meeting_id);
        if (fullMeeting) return fullMeeting;

        const result = await pool.query(
            `SELECT * FROM meetings WHERE meeting_id = $1 LIMIT 1`,
            [meeting_id]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getMeetingById:", err.message);
        return null;
    }
};

// ============================================================
// Simpan data penerima sertifikat ke tabel sertifikat
// ============================================================
export const saveSertifikat = async ({ nama, nip, meeting_id, file_path }) => {
    try {
        await ensureSertifikatTable();
        const result = await pool.query(
            `INSERT INTO sertifikat (nama, nip, meeting_id, file_path)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [nama, nip || "-", String(meeting_id), file_path]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in saveSertifikat:", err.message);
        return null;
    }
};

// ============================================================
// Ambil nomor urut berikutnya untuk penomoran sertifikat (Atomic & Concurrency-Safe per Meeting)
// ============================================================
export const ensureCounterTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meeting_sertifikat_counter (
                meeting_id INT PRIMARY KEY,
                last_number INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (_) {}
};

export const getNextSertifikatNumber = async (meeting_id) => {
    try {
        await ensureCounterTable();
        const mId = parseInt(meeting_id) || 0;

        const res = await pool.query(`
            INSERT INTO meeting_sertifikat_counter (meeting_id, last_number, updated_at)
            VALUES ($1, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (meeting_id) DO UPDATE
            SET last_number = meeting_sertifikat_counter.last_number + 1,
                updated_at = CURRENT_TIMESTAMP
            RETURNING last_number;
        `, [mId]);

        const num = res.rows[0]?.last_number || 1;
        return String(num).padStart(3, '0');
    } catch (err) {
        console.warn("⚠️ Warning getNextSertifikatNumber:", err.message);
        try {
            await ensureSertifikatTable();
            const cntRes = await pool.query(`SELECT COUNT(*) as cnt FROM sertifikat WHERE meeting_id = $1`, [String(meeting_id || 0)]);
            const cnt = parseInt(cntRes.rows[0]?.cnt || 0) + 1;
            return String(cnt).padStart(3, '0');
        } catch (_) {
            return "001";
        }
    }
};

// ============================================================
// Ambil daftar sertifikat berdasarkan meeting_id
// ============================================================
export const getSertifikatByMeeting = async (meeting_id) => {
    try {
        await ensureSertifikatTable();
        const result = await pool.query(
            `SELECT id, nama, nip, meeting_id, file_path, created_at
             FROM sertifikat
             WHERE meeting_id = $1
             ORDER BY id ASC`,
            [String(meeting_id)]
        );
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getSertifikatByMeeting:", err.message);
        return [];
    }
};

export default {
    createPresensi,
    getPresensiByMeeting,
    getMeetingById,
    saveSertifikat,
    getNextSertifikatNumber,
    getSertifikatByMeeting
};
