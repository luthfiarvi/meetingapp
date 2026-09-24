import passport from "passport";

export const loginPage = (req, res) => {
    // Jika sudah login, langsung alihkan ke dashboard
    if (req.isAuthenticated && req.isAuthenticated()) {
        return res.redirect("/dashboard");
    }
    res.render("login2", {
        error: req.query.error || null
    });
};

export const login = (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err || !user) {
            return res.redirect("/?error=" + encodeURIComponent(info?.message || "User ID atau Password salah!"));
        }

        req.logIn(user, (err) => {
            if (err) {
                return res.redirect("/?error=" + encodeURIComponent("Gagal memulai sesi login."));
            }
            return res.redirect("/dashboard");
        });
    })(req, res, next);
};

export const logout = (req, res) => {
    req.logout((err) => {
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                res.redirect("/");
            });
        } else {
            res.redirect("/");
        }
    });
};