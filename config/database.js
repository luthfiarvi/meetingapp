import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const isWindows = process.platform === "win32";

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || (isWindows ? "postgres" : (process.env.PGUSER || "magangit")),
    password: process.env.DB_PASSWORD || (isWindows ? "postgres" : (process.env.PGPASSWORD || "K@nreg5")),
    database: process.env.DB_NAME || (isWindows ? "appmeeting" : "meeting")
});

export default pool;