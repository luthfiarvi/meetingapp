import express from "express";
import { ensureAuthenticated, ensureNotPegawai } from "../middleware/authMiddleware.js";
import { 
    formMeeting, 
    showMeeting, 
    inputMeeting, 
    updateMeetingController,
    getMeetingPhotosController,
    saveMeetingPhotosController,
    getAvailableMeetingsPegawaiController,
    enrollMeetingPegawaiController,
    unenrollMeetingPegawaiController
} from "../controllers/meetingController.js";
import { previewSertifikat } from "../controllers/presensiController.js";

const routerMeeting = express.Router();

routerMeeting.get("/manajemenmeeting", ensureAuthenticated, showMeeting);
routerMeeting.get("/inputrapat", ensureAuthenticated, ensureNotPegawai, formMeeting);
routerMeeting.post("/inputmeeting", ensureAuthenticated, ensureNotPegawai, inputMeeting);
routerMeeting.post("/updatemeeting", ensureAuthenticated, ensureNotPegawai, updateMeetingController);
routerMeeting.get("/meeting/photos/:meetingId", ensureAuthenticated, getMeetingPhotosController);
routerMeeting.post("/meeting/photos/:meetingId", ensureAuthenticated, ensureNotPegawai, saveMeetingPhotosController);
routerMeeting.get("/meeting/sertifikat/preview/:meeting_id", previewSertifikat);
routerMeeting.get("/sertifikat/preview/:meeting_id", previewSertifikat);

// API KHUSUS PEGAWAI (AGENDA PRIBADI)
routerMeeting.get("/api/pegawai/available-meetings", ensureAuthenticated, getAvailableMeetingsPegawaiController);
routerMeeting.post("/api/pegawai/enroll-meeting", ensureAuthenticated, enrollMeetingPegawaiController);
routerMeeting.post("/api/pegawai/unenroll-meeting", ensureAuthenticated, unenrollMeetingPegawaiController);

export default routerMeeting;