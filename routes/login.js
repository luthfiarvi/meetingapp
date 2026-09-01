import express from "express";
import { loginPage, login } from "../controllers/loginController.js";

const router = express.Router();

router.get("/", loginPage);

router.get("/login2", (req, res) => {
    res.render("login2");
});

router.post("/", login);

export default router;
