import pool from "../config/database.js";

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
                nip,
                instansi,
                jabatan,
                email,
                keterangan,
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

export default {
    createPresensi,
    getPresensiByMeeting
};
