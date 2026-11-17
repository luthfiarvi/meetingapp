import express from "express";
import infographicController from "../controllers/infographicController.js";
import notulenController from "../controllers/notulenController.js";
import profileController from "../controllers/profileController.js";
import { uploadEvidence, uploadTranscript, uploadAvatar, uploadProfile } from "../middleware/uploadMiddleware.js";

const router = express.Router();

import { ensureAuthenticated, ensureNotPegawai } from "../middleware/authMiddleware.js";

const ensureAuth = [ensureAuthenticated, ensureNotPegawai];

// Portal Terpadu (App Infografis & Notulen)
router.get("/infografis", ensureAuth, infographicController.getPortal);
router.get("/portal", ensureAuth, infographicController.getPortal);

// Manajemen Profil Pegawai, Kop Surat, & Footer Dokumen (Akses untuk semua user yang login)
router.get("/profile", ensureAuthenticated, profileController.getProfile);
router.post("/profile", ensureAuthenticated, uploadProfile.fields([{ name: "avatar", maxCount: 1 }, { name: "signature", maxCount: 1 }]), profileController.postProfile);

// Modul Notulen Rapat Kedinasan BKN (Dapat diakses oleh Pimpinan, Tim Kerja, Admin, dan Notulis/Approver)
router.get("/notulen", ensureAuthenticated, notulenController.getNotulenGenerator);
router.get("/notulen/preview/:id", ensureAuthenticated, notulenController.getNotulenPreview);
router.get("/notulen/export-docx/:id", ensureAuthenticated, notulenController.exportDocx);
router.post("/api/notulen", ensureAuthenticated, notulenController.saveNotulen);
router.delete("/api/notulen/:id", ensureAuthenticated, notulenController.deleteNotulen);
router.post("/api/notulen/ai-generate", ensureAuthenticated, notulenController.aiGenerateNotulen);
router.post("/api/notulen/parse-transcript-file", ensureAuthenticated, uploadTranscript.single("file"), notulenController.parseTranscriptFile);
router.post("/api/notulen/submit-approval", ensureAuthenticated, notulenController.submitApproval);
router.post("/api/notulen/approve", ensureAuthenticated, notulenController.approveNotulen);
router.post("/api/notulen/reject", ensureAuthenticated, notulenController.rejectNotulen);

// Modul Infografis Kinerja BKN
router.get("/generator", ensureAuth, infographicController.getGenerator);
router.get("/history", ensureAuth, (req, res) => res.redirect("/portal"));
router.get("/preview/:id", ensureAuth, infographicController.getPreview);

// API routes for infographics
router.post("/api/infographics", ensureAuth, infographicController.saveInfographic);
router.delete("/api/infographics/:id", ensureAuth, infographicController.deleteInfographic);
router.post("/api/ai-generate", ensureAuth, infographicController.aiGenerate);
router.post("/api/upload-evidence", ensureAuth, uploadEvidence.single("file"), infographicController.uploadEvidenceFile);

export default router;
