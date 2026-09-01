import passport from "passport";

export const loginPage = (req, res) => {
    res.render("login2");
};

export const login = (req, res, next) => {

    passport.authenticate("local", (err, user, info) => {

        if (err) {
            return next(err);
        }

        if (!user) {
            return res.render("login2", {
                error: info.message
            });
        }

        req.logIn(user, (err) => {

            if (err) {
                return next(err);
            }

            res.redirect("/dashboard");
        });

    })(req, res, next);
};