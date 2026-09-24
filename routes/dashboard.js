import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/dashboard", ensureAuthenticated, (req, res) => {
    res.render("dashboard2", {
        error: req.query.error || null,
        msg: req.query.msg || null
    });
});

router.get("/manual-book", ensureAuthenticated, (req, res) => {
    res.render("manualBook", {
        error: req.query.error || null,
        msg: req.query.msg || null
    });
});

router.get("/manual-book/pdf/user", (req, res) => {
    res.render("manualBookPdfUser", {
        user: req.user || null
    });
});

router.get("/manual-book/pdf/admin", (req, res) => {
    res.render("manualBookPdfAdmin", {
        user: req.user || null
    });
});

export default router;