import express from "express";

import { formMeeting,showMeeting,inputMeeting } from "../controllers/meetingController.js";

const routerMeeting = express.Router();

routerMeeting.get("/manajemenmeeting",showMeeting);
routerMeeting.get("/inputrapat",formMeeting);
routerMeeting.post("/inputmeeting",inputMeeting);

export default routerMeeting;