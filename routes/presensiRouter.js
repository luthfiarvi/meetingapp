import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import {
    formPresensi,
    daftarPresensi,
    daftarPresensiPdf,
    inputPresensi,
    showPresensi,
    listSertifikatApi
} from "../controllers/presensiController.js";

const routerPresensi = express.Router();

// Form presensi & input presensi (Terbuka untuk umum / peserta tanpa perlu login)
routerPresensi.get("/presensi/:meeting_id", formPresensi);
routerPresensi.get("/presensi", formPresensi);
routerPresensi.post("/presensi", inputPresensi);

// Daftar presensi & dokumen resmi (wajib login)
routerPresensi.get("/daftar-presensi/:meeting_id", ensureAuthenticated, daftarPresensi);
routerPresensi.get("/daftar-presensi/:meeting_id/pdf", ensureAuthenticated, daftarPresensiPdf);
routerPresensi.get("/api/presensi/:meeting_id", ensureAuthenticated, showPresensi);
routerPresensi.get("/api/sertifikat/:meeting_id", ensureAuthenticated, listSertifikatApi);

export default routerPresensi;
