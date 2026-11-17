import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "../config/database.js";
import { ensureAuthenticated, ensureAdmin, ensureNotPegawai } from "../middleware/authMiddleware.js";
import { uploadManualPdf } from "../middleware/uploadMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get("/dashboard", ensureAuthenticated, async (req, res) => {
    const currentUser = req.user || res.locals.user || {};
    let pendingApprovals = [];
    try {
        const paRes = await pool.query(`
            SELECT n.id, n.title, n.meeting_date, n.notulis_name, n.created_at, n.meeting_id, n.approval_status
            FROM notulen n
            WHERE n.approval_status = 'pending_approval'
              AND (
                (n.approver_id IS NOT NULL AND LOWER(n.approver_id) = LOWER($1))
                OR (n.approver_nip IS NOT NULL AND n.approver_nip <> '' AND LOWER(n.approver_nip) = LOWER($2))
              )
            ORDER BY n.id DESC
        `, [String(currentUser.id || ''), String(currentUser.nip || '')]);
        pendingApprovals = paRes.rows;
    } catch (e) {
        pendingApprovals = [];
    }

    res.render("dashboard2", {
        error: req.query.error || null,
        msg: req.query.msg || null,
        pendingApprovals: pendingApprovals
    });
});

router.get("/manual-book", ensureAuthenticated, ensureNotPegawai, (req, res) => {
    const userPdfPath = path.join(__dirname, "..", "public", "docs", "manual-book-user.pdf");
    const adminPdfPath = path.join(__dirname, "..", "public", "docs", "manual-book-admin.pdf");
    const hasCustomUserPdf = fs.existsSync(userPdfPath);
    const hasCustomAdminPdf = fs.existsSync(adminPdfPath);

    res.render("manualBook", {
        error: req.query.error || null,
        msg: req.query.msg || null,
        hasCustomUserPdf,
        hasCustomAdminPdf
    });
});

router.get("/manual-book/pdf/user", (req, res) => {
    const customPdfPath = path.join(__dirname, "..", "public", "docs", "manual-book-user.pdf");
    if (fs.existsSync(customPdfPath)) {
        return res.redirect("/docs/manual-book-user.pdf");
    }
    res.render("manualBookPdfUser", {
        user: req.user || null
    });
});

router.get("/manual-book/pdf/admin", (req, res) => {
    const currentUser = req.user || res.locals.user;
    if (!currentUser || currentUser.role !== "admin") {
        return res.redirect("/manual-book");
    }
    const customPdfPath = path.join(__dirname, "..", "public", "docs", "manual-book-admin.pdf");
    if (fs.existsSync(customPdfPath)) {
        return res.redirect("/docs/manual-book-admin.pdf");
    }
    res.render("manualBookPdfAdmin", {
        user: req.user || null
    });
});

// Endpoint untuk upload PDF manual book custom (khusus Admin)
router.post("/manual-book/upload-pdf", ensureAuthenticated, ensureAdmin, (req, res) => {
    uploadManualPdf.single("pdf_file")(req, res, (err) => {
        if (err) {
            return res.redirect("/manual-book?error=" + encodeURIComponent("Gagal mengunggah PDF: " + err.message));
        }
        if (!req.file) {
            return res.redirect("/manual-book?error=" + encodeURIComponent("Harap pilih file dokumen PDF (.pdf) terlebih dahulu."));
        }
        const isAdm = req.body && req.body.type === "admin";
        const label = isAdm ? "Admin" : "User";
        return res.redirect("/manual-book?msg=" + encodeURIComponent(`File PDF Manual Book ${label} berhasil diperbarui!`));
    });
});

export default router;