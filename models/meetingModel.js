import pool from "../config/database.js";

export const createMeeting = async ({m_nama,deskripsi,tanggal,m_tipe}) => {
    const result = await pool.query(`insert into meetings(
        meeting_nama,deskripsi,tanggal,tipe_meeting) values(
        $1,$2,$3,$4)`,[m_nama,deskripsi,tanggal,m_tipe]);

    return result.rows[0];
}

export const getAllMeeting = async () => {
    const result = await pool.query(`select * from meetings order by meeting_id desc`);
    return result.rows;
}

export default {
    createMeeting,getAllMeeting
};