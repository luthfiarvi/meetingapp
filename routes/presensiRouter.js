import express from "express";

import {
    formPresensi,
    daftarPresensi,
    inputPresensi,
    showPresensi
} from "../controllers/presensiController.js";

const routerPresensi = express.Router();

routerPresensi.get("/presensi/:meeting_id", formPresensi);
routerPresensi.post("/presensi", inputPresensi);
routerPresensi.get("/daftar-presensi/:meeting_id", daftarPresensi);
routerPresensi.get("/api/presensi/:meeting_id", showPresensi);

export default routerPresensi;
