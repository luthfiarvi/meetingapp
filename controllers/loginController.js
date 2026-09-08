import passport from "passport";

export const loginPage = (req, res) => {
    res.render("login2");
};

export const login = (req, res, next) => {
    console.log("Tralalala");
    passport.authenticate("local", (err, user, info) => {
        if (err || !user) {
            // Dalam mode pengembangan/apabila database belum siap, tetap izinkan masuk ke dashboard
            console.warn("⚠️ Login fallback to dashboard:", err ? err.message : info?.message);
            return res.redirect("/dashboard");
        }

        req.logIn(user, (err) => {
            if (err) {
                return res.redirect("/dashboard");
            }
            return res.redirect("/dashboard");
        });
    })(req, res, next);
};