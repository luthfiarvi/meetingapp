import express from "express";
import { ensureAuthenticated, ensureAdmin } from "../middleware/authMiddleware.js";
import {
    getUserManagementPage,
    createUser,
    changePassword,
    updateUser,
    deleteUser
} from "../controllers/userController.js";

const router = express.Router();

router.get("/manajemenuser", ensureAuthenticated, ensureAdmin, getUserManagementPage);
router.post("/manajemenuser/tambah", ensureAuthenticated, ensureAdmin, createUser);
router.post("/manajemenuser/ganti-password", ensureAuthenticated, ensureAdmin, changePassword);
router.post("/manajemenuser/edit", ensureAuthenticated, ensureAdmin, updateUser);
router.post("/manajemenuser/hapus", ensureAuthenticated, ensureAdmin, deleteUser);

export default router;

