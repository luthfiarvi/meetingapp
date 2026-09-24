import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";

export const getUserManagementPage = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Halaman Manajemen User hanya dapat diakses oleh Administrator."));
        }

        const users = await userModel.getAllUsers();
        res.render("usermanajemen", {
            users,
            user: currentUser,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error("Error loading user management page:", err);
        res.render("usermanajemen", {
            users: [],
            user: req.user || res.locals.user || { username: "Administrator", role: "admin" },
            msg: null,
            error: "Gagal memuat data pengguna: " + err.message
        });
    }
};

export const createUser = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Fitur Manajemen User hanya dapat diakses oleh Administrator."));
        }

        const {
            id,
            username,
            password,
            confirmPassword,
            role = "user",
            full_name = "",
            nip = "",
            division = "",
            institution = "Kantor Regional V BKN Jakarta"
        } = req.body;

        const trimmedId = (id || "").trim().toLowerCase();
        if (!trimmedId) {
            return res.redirect("/manajemenuser?error=Username / User ID wajib diisi!");
        }

        if (!password || password.length < 4) {
            return res.redirect("/manajemenuser?error=Password minimal harus 4 karakter!");
        }

        if (password !== confirmPassword) {
            return res.redirect("/manajemenuser?error=Konfirmasi password tidak cocok!");
        }

        // Cek apakah user sudah ada
        const existingUser = await userModel.findById(trimmedId);
        if (existingUser && existingUser.id === trimmedId) {
            return res.redirect("/manajemenuser?error=User ID '" + trimmedId + "' sudah digunakan! Silakan gunakan ID lain.");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const safeRole = (role === "admin") ? "admin" : "user";

        await userModel.createUser({
            id: trimmedId,
            username: (username || trimmedId).trim(),
            password: hashedPassword,
            role: safeRole,
            full_name: (full_name || "").trim(),
            nip: (nip || "").trim(),
            division: (division || "").trim(),
            institution: (institution || "Kantor Regional V BKN Jakarta").trim()
        });

        return res.redirect("/manajemenuser?msg=User '" + trimmedId + "' berhasil ditambahkan!");
    } catch (err) {
        console.error("Error creating user:", err);
        return res.redirect("/manajemenuser?error=Gagal menambahkan user: " + encodeURIComponent(err.message));
    }
};

export const changePassword = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Fitur Manajemen User hanya dapat diakses oleh Administrator."));
        }

        const { id, newPassword, confirmPassword } = req.body;

        if (!id) {
            return res.redirect("/manajemenuser?error=User ID tidak valid!");
        }

        if (!newPassword || newPassword.length < 4) {
            return res.redirect("/manajemenuser?error=Password baru minimal 4 karakter!");
        }

        if (newPassword !== confirmPassword) {
            return res.redirect("/manajemenuser?error=Konfirmasi password baru tidak cocok!");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await userModel.updatePassword(id, hashedPassword);

        return res.redirect("/manajemenuser?msg=Password untuk user '" + id + "' berhasil diperbarui!");
    } catch (err) {
        console.error("Error updating password:", err);
        return res.redirect("/manajemenuser?error=Gagal mengubah password: " + encodeURIComponent(err.message));
    }
};

export const updateUser = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Fitur Manajemen User hanya dapat diakses oleh Administrator."));
        }

        const { id, username, role, full_name, nip, division, institution } = req.body;

        if (!id) {
            return res.redirect("/manajemenuser?error=User ID tidak valid!");
        }

        const safeRole = (role === "admin") ? "admin" : "user";

        await userModel.updateUser(id, {
            username: (username || id).trim(),
            role: safeRole,
            full_name: (full_name || "").trim(),
            nip: (nip || "").trim(),
            division: (division || "").trim(),
            institution: (institution || "Kantor Regional V BKN Jakarta").trim()
        });

        return res.redirect("/manajemenuser?msg=Data profil user '" + id + "' berhasil diperbarui!");
    } catch (err) {
        console.error("Error updating user:", err);
        return res.redirect("/manajemenuser?error=Gagal memperbarui user: " + encodeURIComponent(err.message));
    }
};

export const deleteUser = async (req, res) => {
    try {
        const currentUser = req.user || res.locals.user;
        if (!currentUser || currentUser.role !== "admin") {
            return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Fitur Manajemen User hanya dapat diakses oleh Administrator."));
        }

        const { id, confirmText } = req.body;

        if (!id) {
            return res.redirect("/manajemenuser?error=User ID tidak valid!");
        }

        const currentUserId = (currentUser.id || "").toLowerCase();
        if (currentUserId && currentUserId === id.toLowerCase()) {
            return res.redirect("/manajemenuser?error=Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif login!");
        }

        const targetUser = await userModel.findById(id);
        if (!targetUser) {
            return res.redirect("/manajemenuser?error=Pengguna tidak ditemukan!");
        }

        if (targetUser.role === "admin") {
            // Ambil seluruh user untuk memastikan masih ada admin lain
            const allUsers = await userModel.getAllUsers();
            const adminCount = allUsers.filter(u => u.role === "admin").length;
            if (adminCount <= 1) {
                return res.redirect("/manajemenuser?error=Tidak dapat menghapus akun ini. Sistem harus menyisakan minimal 1 Administrator!");
            }

            // Validasi kata kunci konfirmasi "hapus"
            const trimmedConfirm = (confirmText || "").trim().toLowerCase();
            if (trimmedConfirm !== "hapus") {
                return res.redirect("/manajemenuser?error=Penghapusan dibatalkan. Anda harus mengetik kata 'hapus' untuk mengonfirmasi penghapusan akun Administrator!");
            }
        }

        await userModel.deleteUser(id);
        const roleLabel = (targetUser.role === "admin") ? "Administrator" : "Pengguna";
        return res.redirect("/manajemenuser?msg=Akun " + roleLabel + " '" + id + "' berhasil dihapus dari sistem!");
    } catch (err) {
        console.error("Error deleting user:", err);
        return res.redirect("/manajemenuser?error=Gagal menghapus user: " + encodeURIComponent(err.message));
    }
};
