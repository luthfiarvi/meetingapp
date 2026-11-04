import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { 
    formMeeting, 
    showMeeting, 
    inputMeeting, 
    updateMeetingController,
    getMeetingPhotosController,
    saveMeetingPhotosController
} from "../controllers/meetingController.js";
import { previewSertifikat } from "../controllers/presensiController.js";

const routerMeeting = express.Router();

routerMeeting.get("/manajemenmeeting", ensureAuthenticated, showMeeting);
routerMeeting.get("/inputrapat", ensureAuthenticated, formMeeting);
routerMeeting.post("/inputmeeting", ensureAuthenticated, inputMeeting);
routerMeeting.post("/updatemeeting", ensureAuthenticated, updateMeetingController);
routerMeeting.get("/meeting/photos/:meetingId", ensureAuthenticated, getMeetingPhotosController);
routerMeeting.post("/meeting/photos/:meetingId", ensureAuthenticated, saveMeetingPhotosController);
routerMeeting.get("/meeting/sertifikat/preview/:meeting_id", previewSertifikat);
routerMeeting.get("/sertifikat/preview/:meeting_id", previewSertifikat);

export default routerMeeting;