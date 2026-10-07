import express from "express";
import session from "express-session";
import passport from "passport";
import "./config/passport.js";
import { initInfografisSchema } from "./config/infografis_schema.js";
import { initZoomSchema } from "./config/zoom_schema.js";

import loginRouter from "./routes/login.js";
import dashboardRouter from "./routes/dashboard.js";
import userRouter from "./routes/userRouter.js";
import meetingRouter from "./routes/meetingRouter.js";
import presensiRouter from "./routes/presensiRouter.js";
import infographicRouter from "./routes/infographicRouter.js";
import zoomRouter from "./routes/zoomRouter.js";

const app = express();

app.set("view engine", "ejs");

// 1. TAMBAHKAN BARIS INI AGAR BROWSER BISA MENGAKSES FOLDER PUBLIC (/bkn.png)
app.use(express.static("public"));

app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json({ limit: "50mb" }));

app.use(
    session({
        secret: "your-secret",
        resave: false,
        saveUninitialized: false
    })
);

app.use(passport.initialize());
app.use(passport.session());

import pool from "./config/database.js";
import { initWebinarQuizSchema } from "./config/webinar_quiz_schema.js";
import webinarQuizRouter from "./routes/webinarQuizRouter.js";

// Inisialisasi skema tabel database
(async () => {
    try {
        await initInfografisSchema();
        await initWebinarQuizSchema();
        await initZoomSchema();
    } catch (e) {
        console.warn("⚠️ Schema init error:", e.message);
    }
})();

// Global user locals for templates (only populated if user is actually authenticated)
app.use(async (req, res, next) => {
    const sessionUserId = req.session?.passport?.user || (req.user ? req.user.id : null);

    if (sessionUserId) {
        const defaultUser = {
            id: sessionUserId,
            username: sessionUserId,
            full_name: "Pegawai BKN",
            nip: "",
            institution: "Kantor Regional V BKN Jakarta",
            division: "Pegawai BKN",
            logo_path: "/images/Logo_Badan_Kepegawaian_Negara.png",
            avatar_path: "/images/default_avatar.png",
            institution_kop: "BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V",
            kop_address: "Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730",
            kop_contact: "Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id",
            sig_city: "Jakarta",
            running_footer: "Dokumen Resmi Kanreg V BKN",
            role: "user"
        };

        let userObj = { ...defaultUser };
        try {
            const r = await pool.query("SELECT * FROM users WHERE id = $1", [sessionUserId]);
            if (r.rows.length > 0) {
                userObj = { ...defaultUser, ...r.rows[0] };
            }
        } catch (e) {}

        if (req.user) {
            userObj = { ...userObj, ...req.user };
        }

        res.locals.user = userObj;
        req.user = userObj;
    } else {
        res.locals.user = null;
        req.user = null;
    }
    next();
});

app.use("/", loginRouter);
app.use("/", webinarQuizRouter);

// Global Route Guard: Memastikan rute aplikasi privat tidak dapat diakses tanpa login
app.use((req, res, next) => {
    // Pengecualian untuk tautan publik peserta (kuis webinar & formulir presensi rapat/webinar)
    if (
        req.path.startsWith("/webinar-quiz") ||
        req.path.startsWith("/presensi") ||
        req.path.startsWith("/manual-book/pdf")
    ) {
        return next();
    }

    const isAuthed = (req.isAuthenticated && req.isAuthenticated()) ||
                     (req.session && req.session.passport && req.session.passport.user);

    if (isAuthed) {
        return next();
    }

    // Alihkan pengguna tanpa sesi ke login utama
    return res.redirect("/?error=" + encodeURIComponent("Silakan login terlebih dahulu untuk mengakses halaman ini."));
});

app.use("/", dashboardRouter);
app.use("/", userRouter);
app.use("/", presensiRouter);
app.use("/", meetingRouter);
app.use("/", infographicRouter);
app.use("/", zoomRouter);

export default app;