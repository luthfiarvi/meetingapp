import pool from "../config/database.js";

export const createMeeting = async ({m_nama,deskripsi,tanggal,m_tipe,user_id}) => {
    try {
        const today = new Date();
        const tgl = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const result = await pool.query(`insert into meetings(
            meeting_nama,deskripsi,tanggal,tipe_meeting,tgl_buat,user_id) values(
            $1,$2,$3,$4,$5,$6) returning *`,[m_nama,deskripsi,tanggal,m_tipe,tgl,user_id || 'admin']);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in createMeeting:", err.message);
        return { m_nama, deskripsi, tanggal, m_tipe, user_id };
    }
}

export const updateMeeting = async ({
    meeting_id,
    m_nama,
    deskripsi,
    tanggal,
    m_tipe,
    thumbnail,
    notulen_pdf,
    video_url
}) => {
    try {
        const result = await pool.query(
            `UPDATE meetings 
             SET meeting_nama = COALESCE($1, meeting_nama),
                 deskripsi = COALESCE($2, deskripsi),
                 tanggal = COALESCE($3, tanggal),
                 tipe_meeting = COALESCE($4, tipe_meeting),
                 thumbnail = COALESCE($5, thumbnail),
                 notulen_pdf = COALESCE($6, notulen_pdf),
                 video_url = COALESCE($7, video_url)
             WHERE meeting_id = $8
             RETURNING *`,
            [m_nama, deskripsi, tanggal, m_tipe, thumbnail, notulen_pdf, video_url, meeting_id]
        );
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in updateMeeting:", err.message);
        return null;
    }
};

export const getAllMeeting = async () => {
    try {
        const result = await pool.query(`
            SELECT m.*, 
                   COALESCE(m.user_id, z.user_id, u.id, 'admin') AS creator_user_id
            FROM meetings m
            LEFT JOIN zoom_requests z ON m.zoom_request_id = z.id
            LEFT JOIN users u ON (
                (z.user_id IS NOT NULL AND z.user_id = u.id)
                OR (z.nip IS NOT NULL AND z.nip <> '' AND z.nip = u.nip)
            )
            ORDER BY m.meeting_id DESC
        `);
        return result.rows;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in getAllMeeting:", err.message);
        return [];
    }
};

export const getMeetingById = async (id) => {
    try {
        const result = await pool.query(`
            SELECT m.*, 
                   COALESCE(m.user_id, z.user_id, u.id, 'admin') AS creator_user_id
            FROM meetings m
            LEFT JOIN zoom_requests z ON m.zoom_request_id = z.id
            LEFT JOIN users u ON (
                (z.user_id IS NOT NULL AND z.user_id = u.id)
                OR (z.nip IS NOT NULL AND z.nip <> '' AND z.nip = u.nip)
            )
            WHERE m.meeting_id = $1
        `, [id]);
        return result.rows[0] || null;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in getMeetingById:", err.message);
        return null;
    }
};

export default {
    createMeeting,
    updateMeeting,
    getAllMeeting,
    getMeetingById
};