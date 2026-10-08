import pool from "../config/database.js";

// In-memory fallback untuk mode pengembangan jika database belum terhubung
const fallbackZoomRequests = [
    {
        id: 1,
        nip: "199405122020121003",
        nama_pemohon: "Ahmad Fauzi, S.Kom.",
        divisi: "Sub Bagian Kepegawaian",
        judul_rapat: "Koordinasi Teknis Kenaikan Pangkat Periode April",
        tanggal_pengajuan: "2026-09-18",
        tanggal_rapat: "2026-09-22",
        waktu_mulai: "09:00",
        waktu_selesai: "12:00",
        keterangan: "Butuh kuota 300 peserta dan fitur breakout room untuk 3 kelompok",
        status: "disetujui",
        zoom_link: "https://bkn.zoom.us/j/84291823910?pwd=kanreg5sidigi",
        meeting_id: "842 9182 3910",
        passcode: "BKN5KP26",
        catatan_admin: "Sudah dijadwalkan di Akun Zoom 01 Sidigi.",
        created_at: new Date()
    }
];

export const createRequest = async (data) => {
    const {
        user_id,
        nip,
        nama_pemohon,
        divisi,
        judul_rapat,
        tanggal_pengajuan,
        tanggal_rapat,
        waktu_mulai,
        waktu_selesai,
        keterangan,
        tipe_rapat = "Rapat Biasa"
    } = data;

    try {
        const query = `
            INSERT INTO zoom_requests (
                user_id, nip, nama_pemohon, divisi, judul_rapat, tanggal_pengajuan,
                tanggal_rapat, waktu_mulai, waktu_selesai, keterangan, tipe_rapat, status
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10, $11, 'menunggu')
            RETURNING *;
        `;
        const values = [
            user_id || null,
            nip,
            nama_pemohon || "",
            divisi || "",
            judul_rapat,
            tanggal_pengajuan || new Date().toISOString().split('T')[0],
            tanggal_rapat,
            waktu_mulai || null,
            waktu_selesai || null,
            keterangan || "",
            tipe_rapat || "Rapat Biasa"
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in createRequest:", err.message);
        const newReq = {
            id: fallbackZoomRequests.length + 1,
            nip,
            nama_pemohon: nama_pemohon || "",
            divisi: divisi || "",
            judul_rapat,
            tanggal_pengajuan: tanggal_pengajuan || new Date().toISOString().split('T')[0],
            tanggal_rapat,
            waktu_mulai: waktu_mulai || "09:00",
            waktu_selesai: waktu_selesai || "11:00",
            keterangan: keterangan || "",
            tipe_rapat: tipe_rapat || "Rapat Biasa",
            status: "menunggu",
            zoom_link: null,
            meeting_id: null,
            passcode: null,
            quiz_link: null,
            catatan_admin: null,
            created_at: new Date()
        };
        fallbackZoomRequests.unshift(newReq);
        return newReq;
    }
};

export const getAllRequests = async () => {
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests ORDER BY id DESC"
        );
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getAllRequests:", err.message);
        return fallbackZoomRequests;
    }
};

export const getRequestsByNip = async (nip) => {
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests WHERE nip = $1 ORDER BY id DESC",
            [nip]
        );
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getRequestsByNip:", err.message);
        return fallbackZoomRequests.filter(r => r.nip === nip);
    }
};

export const getRequestById = async (id) => {
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests WHERE id = $1",
            [id]
        );
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getRequestById:", err.message);
        return fallbackZoomRequests.find(r => r.id === parseInt(id));
    }
};

export const updateRequestStatus = async (id, updateData) => {
    const { status, zoom_link, meeting_id, passcode, catatan_admin, quiz_link, tipe_rapat } = updateData;

    try {
        const query = `
            UPDATE zoom_requests
            SET status = COALESCE($1, status),
                zoom_link = COALESCE($2, zoom_link),
                meeting_id = COALESCE($3, meeting_id),
                passcode = COALESCE($4, passcode),
                catatan_admin = COALESCE($5, catatan_admin),
                quiz_link = COALESCE($6, quiz_link),
                tipe_rapat = COALESCE($7, tipe_rapat)
            WHERE id = $8
            RETURNING *;
        `;
        const values = [status, zoom_link, meeting_id, passcode, catatan_admin, quiz_link, tipe_rapat, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in updateRequestStatus:", err.message);
        const item = fallbackZoomRequests.find(r => r.id === parseInt(id));
        if (item) {
            if (status !== undefined) item.status = status;
            if (zoom_link !== undefined) item.zoom_link = zoom_link;
            if (meeting_id !== undefined) item.meeting_id = meeting_id;
            if (passcode !== undefined) item.passcode = passcode;
            if (catatan_admin !== undefined) item.catatan_admin = catatan_admin;
            if (quiz_link !== undefined) item.quiz_link = quiz_link;
            if (tipe_rapat !== undefined) item.tipe_rapat = tipe_rapat;
        }
        return item;
    }
};

export const deleteRequest = async (id) => {
    try {
        await pool.query("DELETE FROM zoom_requests WHERE id = $1", [id]);
        return true;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in deleteRequest:", err.message);
        const idx = fallbackZoomRequests.findIndex(r => r.id === parseInt(id));
        if (idx !== -1) {
            fallbackZoomRequests.splice(idx, 1);
        }
        return true;
    }
};

export default {
    createRequest,
    getAllRequests,
    getRequestsByNip,
    getRequestById,
    updateRequestStatus,
    deleteRequest
};
