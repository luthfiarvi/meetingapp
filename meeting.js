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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./config/database.js";
import notulenController from "./controllers/notulenController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");

// Interceptor: Perbaiki otomatis berkas notulen HTML jika mengandung gambar rusak (src="undefined")
app.get("/uploads/notulen/:filename", async (req, res, next) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(process.cwd(), "public", "uploads", "notulen", filename);
        if (!fs.existsSync(filePath)) return next();

        let content = fs.readFileSync(filePath, "utf-8");
        if (content.includes('src="undefined"') || content.includes("src='undefined'")) {
            const m = filename.match(/notulen_rapat_([0-9]+)_/);
            const targetId = m ? m[1] : null;
            if (targetId) {
                const notulenRes = await pool.query(
                    "SELECT * FROM notulen WHERE meeting_id = $1 OR id = $1 ORDER BY id DESC LIMIT 1",
                    [targetId]
                );
                if (notulenRes.rows.length > 0) {
                    const doc = notulenRes.rows[0];
                    let userObj = {
                        full_name: doc.notulis_name || "Pegawai BKN",
                        institution: "Kantor Regional V BKN Jakarta",
                        division: doc.notulis_role || "Pengembang Sistem",
                        sig_city: "Jakarta"
                    };
                    try {
                        const uRes = await pool.query("SELECT * FROM users WHERE id = $1", [doc.user_id]);
                        if (uRes.rows.length > 0) userObj = { ...userObj, ...uRes.rows[0] };
                    } catch (e) {}

                    const fixedHtml = notulenController.generateHtmlDoc({
                        docData: {
                            title: doc.title,
                            meetingDate: doc.meeting_date,
                            meetingTime: doc.meeting_time,
                            meetingPlace: doc.meeting_place,
                            agenda: typeof doc.agenda_data === "string" ? JSON.parse(doc.agenda_data) : doc.agenda_data,
                            attendees: typeof doc.attendees_data === "string" ? JSON.parse(doc.attendees_data) : doc.attendees_data,
                            activities: typeof doc.activities_data === "string" ? JSON.parse(doc.activities_data) : doc.activities_data,
                            actionItems: typeof doc.action_items === "string" ? JSON.parse(doc.action_items) : doc.action_items,
                            conclusions: typeof doc.conclusions === "string" ? JSON.parse(doc.conclusions) : doc.conclusions,
                            closingText: doc.closing_text,
                            documentationPhotos: doc.documentation_photos ? (typeof doc.documentation_photos === "string" ? JSON.parse(doc.documentation_photos) : doc.documentation_photos) : [],
                            notulisName: doc.notulis_name,
                            notulisRole: doc.notulis_role
                        },
                        user: userObj,
                        notulenId: doc.id,
                        meetingId: doc.meeting_id
                    });

                    fs.writeFileSync(filePath, fixedHtml, "utf-8");
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    return res.send(fixedHtml);
                }
            }
        }
    } catch (err) {
        console.warn("⚠️ Notulen HTML on-the-fly repair notice:", err.message);
    }
    next();
});

// 1. TAMBAHKAN BARIS INI AGAR BROWSER BISA MENGAKSES FOLDER PUBLIC (/bkn.png)
app.use(express.static(path.join(__dirname, "public")));
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
        req.path.startsWith("/meeting/sertifikat/preview") ||
        req.path.startsWith("/sertifikat/preview") ||
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