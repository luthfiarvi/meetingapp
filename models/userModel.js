import pool from "../config/database.js";

const findById = async (id) => {
    try {
        const cleanId = String(id || "").trim();
        const result = await pool.query(`
            SELECT u.*, COALESCE(s.signature_path, NULL) AS signature_path
            FROM users u
            LEFT JOIN user_signatures s ON (s.user_id = u.id OR s.user_id = u.username OR (u.nip IS NOT NULL AND u.nip <> '' AND s.user_id = u.nip))
            WHERE u.id = $1 OR u.username = $1 OR u.nip = $1
            LIMIT 1
        `, [cleanId]);
        return result.rows[0] || null;
    } catch (err) {
        console.warn("⚠️ [DATABASE ERROR] Error in findById:", err.message);
        return null;
    }
};

const getAllUsers = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_signatures (
                user_id VARCHAR(100) PRIMARY KEY,
                signature_path VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `).catch(() => {});

        const result = await pool.query(`
            SELECT u.*, COALESCE(s.signature_path, NULL) AS signature_path
            FROM users u
            LEFT JOIN user_signatures s ON (s.user_id = u.id OR s.user_id = u.username OR (u.nip IS NOT NULL AND u.nip <> '' AND s.user_id = u.nip))
            ORDER BY u.role ASC, u.id ASC
        `);
        return result.rows;
    } catch (err) {
        console.warn("⚠️ PostgreSQL database error in getAllUsers:", err.message);
        try {
            const fallback = await pool.query("SELECT * FROM users ORDER BY id ASC");
            if (fallback.rows && fallback.rows.length > 0) {
                return fallback.rows;
            }
        } catch (fbErr) {
            console.error("❌ Fallback query failed:", fbErr.message);
        }
        return [];
    }
};

const createUser = async (userData) => {
    const {
        id,
        username,
        password,
        role = "user",
        full_name = "",
        nip = "",
        institution = "Kantor Regional V BKN Jakarta",
        division = ""
    } = userData;

    const query = `
        INSERT INTO users (id, username, password, role, full_name, nip, institution, division)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, role, full_name, nip, institution, division;
    `;
    const values = [id, username, password, role, full_name, nip, institution, division];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const updatePassword = async (id, hashedPassword) => {
    const query = "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username;";
    const result = await pool.query(query, [hashedPassword, id]);
    return result.rows[0];
};

const updateUser = async (id, userData) => {
    const {
        username,
        role,
        full_name,
        nip,
        institution = "Kantor Regional V BKN Jakarta",
        division
    } = userData;

    const query = `
        UPDATE users 
        SET username = COALESCE($1, username),
            role = COALESCE($2, role),
            full_name = COALESCE($3, full_name),
            nip = COALESCE($4, nip),
            institution = COALESCE($5, institution),
            division = COALESCE($6, division)
        WHERE id = $7
        RETURNING id, username, role, full_name, nip, institution, division;
    `;
    const values = [username, role, full_name, nip, institution, division, id];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const deleteUser = async (id) => {
    const query = "DELETE FROM users WHERE id = $1 RETURNING id;";
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

export default {
    findById,
    getAllUsers,
    createUser,
    updatePassword,
    updateUser,
    deleteUser
};