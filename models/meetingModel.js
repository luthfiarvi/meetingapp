import pool from "../config/database.js";

export const createMeeting = async ({m_nama,deskripsi,tanggal,m_tipe}) => {
    try {
        const today = new Date();
        const tgl = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const result = await pool.query(`insert into meetings(
            meeting_nama,deskripsi,tanggal,tipe_meeting,tgl_buat) values(
            $1,$2,$3,$4,$5)`,[m_nama,deskripsi,tanggal,m_tipe,tgl]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in createMeeting:", err.message);
        return { m_nama, deskripsi, tanggal, m_tipe };
    }
}

export const updateMeeting = async ({m_nama,deskripsi,tanggal,m_tipe}) => {
    try {
        const today = new Date();
        const tgl = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const result = await pool.query(`insert into meetings(
            meeting_nama,deskripsi,tanggal,tipe_meeting,tgl_buat) values(
            $1,$2,$3,$4,$5)`,[m_nama,deskripsi,tanggal,m_tipe,tgl]);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in createMeeting:", err.message);
        return { m_nama, deskripsi, tanggal, m_tipe };
    }
}

export const getAllMeeting = async () => {
    try {
        const result = await pool.query(`select * from meetings order by meeting_id desc`);
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in getAllMeeting:", err.message);
        return [];
    }
}

export default {
    createMeeting,getAllMeeting
};