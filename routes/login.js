import express from "express";
import { loginPage, login } from "../controllers/loginController.js";

const router = express.Router();

// Halaman utama / membuka laman login
router.get("/", loginPage);
router.post("/", login);

router.get("/login2", (req, res) => {
    res.render("login2");
});

export default router;
