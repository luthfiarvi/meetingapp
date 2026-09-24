import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { formMeeting, showMeeting, inputMeeting, updateMeetingController } from "../controllers/meetingController.js";

const routerMeeting = express.Router();

routerMeeting.get("/manajemenmeeting", ensureAuthenticated, showMeeting);
routerMeeting.get("/inputrapat", ensureAuthenticated, formMeeting);
routerMeeting.post("/inputmeeting", ensureAuthenticated, inputMeeting);
routerMeeting.post("/updatemeeting", ensureAuthenticated, updateMeetingController);

export default routerMeeting;