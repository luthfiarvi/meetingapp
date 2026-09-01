import pool from "../config/database.js";

const findById = async (id) => {

    const result = await pool.query(
        "SELECT * FROM users WHERE id = $1",
        [id]
    );

    return result.rows[0];
};

export default {
    findById
};