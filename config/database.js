import {Pool} from"pg";

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "magangit",
    password: "K@nreg5",
    database:"meeting"
});

export default pool;