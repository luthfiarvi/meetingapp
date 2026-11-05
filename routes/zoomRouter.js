import express from "express";
import { ensureAuthenticated, ensureNotPegawai } from "../middleware/authMiddleware.js";
import {
    showZoomPage,
    submitZoomRequest,
    approveZoomRequest,
    rejectZoomRequest,
    deleteZoomRequest
} from "../controllers/zoomController.js";

const router = express.Router();

router.get("/request-zoom", ensureAuthenticated, ensureNotPegawai, showZoomPage);
router.post("/request-zoom/ajukan", ensureAuthenticated, ensureNotPegawai, submitZoomRequest);
router.post("/request-zoom/approve", ensureAuthenticated, ensureNotPegawai, approveZoomRequest);
router.post("/request-zoom/reject", ensureAuthenticated, ensureNotPegawai, rejectZoomRequest);
router.post("/request-zoom/delete", ensureAuthenticated, ensureNotPegawai, deleteZoomRequest);

export default router;
