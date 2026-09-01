import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";

import userModel from "../models/userModel.js";

passport.use(
    new Strategy(
        {
            usernameField: "id",
            passwordField: "password"
        },
        async (id, password, done) => {

            try {

                const user = await userModel.findById(id);

                if (!user) {
                    return done(null, false, {
                        message: "User Not Exist"
                    });
                }

                const passwordCorrect = await bcrypt.compare(
                    password,
                    user.password
                );

                if (!passwordCorrect) {
                    return done(null, false, {
                        message: "Wrong Password!"
                    });
                }

                return done(null, user);

            } catch (error) {

                return done(error);

            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {

    try {

        const user = await userModel.findById(id);

        done(null, user);

    } catch (error) {

        done(error);

    }
});