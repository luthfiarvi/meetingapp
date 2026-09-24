import express from "express";
import infographicController from "../controllers/infographicController.js";
import notulenController from "../controllers/notulenController.js";
import profileController from "../controllers/profileController.js";
import { uploadEvidence, uploadTranscript, uploadAvatar } from "../middleware/uploadMiddleware.js";

const router = express.Router();

import { ensureAuthenticated } from "../middleware/authMiddleware.js";

const ensureAuth = ensureAuthenticated;

// Portal Terpadu (App Infografis & Notulen)
router.get("/infografis", ensureAuth, infographicController.getPortal);
router.get("/portal", ensureAuth, infographicController.getPortal);

// Manajemen Profil Pegawai, Kop Surat, & Footer Dokumen
router.get("/profile", ensureAuth, profileController.getProfile);
router.post("/profile", ensureAuth, uploadAvatar.single("avatar"), profileController.postProfile);

// Modul Notulen Rapat Kedinasan BKN
router.get("/notulen", ensureAuth, notulenController.getNotulenGenerator);
router.get("/notulen/preview/:id", ensureAuth, notulenController.getNotulenPreview);
router.get("/notulen/export-docx/:id", ensureAuth, notulenController.exportDocx);
router.post("/api/notulen", ensureAuth, notulenController.saveNotulen);
router.delete("/api/notulen/:id", ensureAuth, notulenController.deleteNotulen);
router.post("/api/notulen/ai-generate", ensureAuth, notulenController.aiGenerateNotulen);
router.post("/api/notulen/parse-transcript-file", ensureAuth, uploadTranscript.single("file"), notulenController.parseTranscriptFile);

// Modul Infografis Kinerja BKN
router.get("/generator", ensureAuth, infographicController.getGenerator);
router.get("/history", ensureAuth, infographicController.getHistory);
router.get("/preview/:id", ensureAuth, infographicController.getPreview);

// API routes for infographics
router.post("/api/infographics", ensureAuth, infographicController.saveInfographic);
router.delete("/api/infographics/:id", ensureAuth, infographicController.deleteInfographic);
router.post("/api/ai-generate", ensureAuth, infographicController.aiGenerate);
router.post("/api/upload-evidence", ensureAuth, uploadEvidence.single("file"), infographicController.uploadEvidenceFile);

export default router;
