import express from "express";
import { loginPage, login, logout } from "../controllers/loginController.js";

const router = express.Router();

// Halaman utama / membuka laman login
router.get("/", loginPage);
router.post("/", login);
router.get("/logout", logout);

router.get("/login2", (req, res) => {
    res.redirect("/");
});

export default router;
