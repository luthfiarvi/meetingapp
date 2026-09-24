import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import {
    renderPublicQuizPage,
    submitPublicQuestion,
    upvotePublicQuestion,
    submitQuizVote,
    getRoomDataJson,
    adminAnswerQuestion,
    adminAddZoomChatQuestion,
    adminDeleteQuestion,
    adminCreateQuiz
} from "../controllers/webinarQuizController.js";

const router = express.Router();

// 1. Rute Publik untuk Peserta Webinar
router.get("/webinar-quiz/:roomId", renderPublicQuizPage);
router.post("/webinar-quiz/:roomId/tanya", submitPublicQuestion);
router.post("/webinar-quiz/:roomId/like/:qId", upvotePublicQuestion);
router.post("/webinar-quiz/:roomId/vote", submitQuizVote);
router.get("/webinar-quiz/:roomId/data", getRoomDataJson);
router.get("/api/webinar-quiz/:roomId/data", getRoomDataJson);

// 2. Rute API untuk Admin & Host Webinar
router.post("/api/webinar-quiz/answer", ensureAuthenticated, adminAnswerQuestion);
router.post("/api/webinar-quiz/add-chat", ensureAuthenticated, adminAddZoomChatQuestion);
router.post("/api/webinar-quiz/delete", ensureAuthenticated, adminDeleteQuestion);
router.post("/api/webinar-quiz/create-quiz", ensureAuthenticated, adminCreateQuiz);

export default router;
