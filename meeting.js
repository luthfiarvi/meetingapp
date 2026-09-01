import express from "express";
import session from "express-session";
import passport from "passport";
import "./config/passport.js";

import loginRouter from "./routes/login.js";
import dashboardRouter from "./routes/dashboard.js";
import meetingRouter from "./routes/meetingRouter.js"

const app = express();

app.set("view engine", "ejs");

// 1. TAMBAHKAN BARIS INI AGAR BROWSER BISA MENGAKSES FOLDER PUBLIC (/bkn.png)
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "your-secret",
        resave: false,
        saveUninitialized: false
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/", loginRouter);
app.use("/", dashboardRouter);
app.use("/",meetingRouter);

export default app;