import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import {
    showZoomPage,
    submitZoomRequest,
    approveZoomRequest,
    rejectZoomRequest,
    deleteZoomRequest
} from "../controllers/zoomController.js";

const router = express.Router();

router.get("/request-zoom", ensureAuthenticated, showZoomPage);
router.post("/request-zoom/ajukan", ensureAuthenticated, submitZoomRequest);
router.post("/request-zoom/approve", ensureAuthenticated, approveZoomRequest);
router.post("/request-zoom/reject", ensureAuthenticated, rejectZoomRequest);
router.post("/request-zoom/delete", ensureAuthenticated, deleteZoomRequest);

export default router;
