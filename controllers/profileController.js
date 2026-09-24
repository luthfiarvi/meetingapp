import pool from "../config/database.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

function getCurrentUser(req) {
  const user = req.user || {};
  return {
    id: user.id || "admin",
    username: user.username || "admin",
    full_name: user.full_name || "Administrator BKN",
    nip: user.nip || "198501012010011001",
    institution: user.institution || "Kantor Regional V BKN Jakarta",
    division: user.division || "Pengelolaan Sistem Informasi Kepegawaian",
    mentor_name: user.mentor_name || "Pembimbing Kepegawaian",
    logo_path: user.logo_path || "/images/Logo_Badan_Kepegawaian_Negara.png",
    avatar_path: user.avatar_path || "/images/default_avatar.png",
    institution_kop: user.institution_kop || "BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V",
    kop_address: user.kop_address || "Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730",
    kop_contact: user.kop_contact || "Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id",
    sig_city: user.sig_city || "Jakarta",
    running_footer: user.running_footer || "Dokumen Resmi Kanreg V BKN",
    role: user.role || "admin"
  };
}

export const profileController = {
  // GET /profile
  getProfile: async (req, res) => {
    try {
      const fallbackUser = getCurrentUser(req);
      let user = fallbackUser;

      try {
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [fallbackUser.id]);
        if (result.rows.length > 0) {
          user = { ...fallbackUser, ...result.rows[0] };
        }
      } catch (dbErr) {
        console.warn("Notice: unable to query profile from database:", dbErr.message);
      }

      res.render("profile", {
        title: "Manajemen Profil & Format Dokumen Kedinasan - BKN",
        user: user,
        error: req.query.error || null,
        success: req.query.success || null
      });
    } catch (err) {
      console.error("Profile view error:", err);
      res.redirect("/infografis?error=" + encodeURIComponent(err.message));
    }
  },

  // POST /profile
  postProfile: async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      const {
        full_name,
        nip,
        institution,
        division,
        logo_path,
        institution_kop,
        kop_address,
        kop_contact,
        sig_city,
        running_footer
      } = req.body;

      if (!full_name || !division) {
        return res.redirect("/profile?error=" + encodeURIComponent("Nama lengkap dan jabatan/divisi wajib diisi."));
      }

      // Avatar path
      let avatarPath = currentUser.avatar_path || "/images/default_avatar.png";

      if (req.body.avatar_cropped && req.body.avatar_cropped.startsWith("data:image/")) {
        try {
          const base64Data = req.body.avatar_cropped.replace(/^data:image\/\w+;base64,/, "");
          const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
          const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, filename), base64Data, "base64");
          avatarPath = `/uploads/avatars/${filename}`;
        } catch (cropErr) {
          console.error("Gagal menyimpan avatar_cropped:", cropErr);
          if (req.file) {
            avatarPath = `/uploads/avatars/${req.file.filename}`;
          }
        }
      } else if (req.file) {
        avatarPath = `/uploads/avatars/${req.file.filename}`;
      }

      await pool.query(`
        UPDATE users SET
          full_name = $1,
          nip = $2,
          institution = $3,
          division = $4,
          mentor_name = $5,
          logo_path = $6,
          avatar_path = $7,
          institution_kop = $8,
          kop_address = $9,
          kop_contact = $10,
          sig_city = $11,
          running_footer = $12
        WHERE id = $13
      `, [
        full_name.trim(),
        nip ? nip.trim() : "",
        institution ? institution.trim() : "Kantor Regional V BKN Jakarta",
        division.trim(),
        "",
        logo_path ? logo_path.trim() : "/images/Logo_Badan_Kepegawaian_Negara.png",
        avatarPath,
        institution_kop ? institution_kop.trim() : "BADAN KEPEGAWAIAN NEGARA KANTOR REGIONAL V",
        kop_address ? kop_address.trim() : "Jalan Raya Ciracas Nomor 36, Ciracas, Jakarta Timur, Jakarta 13730",
        kop_contact ? kop_contact.trim() : "Telepon (021) 87721084 - 87721085; Faksimile (021) 87721085; Laman: jakarta.bkn.go.id; Pos-el: kanreg5.jakarta@bkn.go.id",
        sig_city ? sig_city.trim() : "Jakarta",
        running_footer ? running_footer.trim() : "Dokumen Resmi Kanreg V BKN",
        currentUser.id
      ]);

      // Update in-memory session user so changes take effect immediately
      if (req.user) {
        req.user.full_name = full_name.trim();
        req.user.nip = nip ? nip.trim() : "";
        req.user.institution = institution ? institution.trim() : "";
        req.user.division = division.trim();
        req.user.mentor_name = "";
        req.user.logo_path = logo_path ? logo_path.trim() : "";
        req.user.avatar_path = avatarPath;
        req.user.institution_kop = institution_kop ? institution_kop.trim() : "";
        req.user.kop_address = kop_address ? kop_address.trim() : "";
        req.user.kop_contact = kop_contact ? kop_contact.trim() : "";
        req.user.sig_city = sig_city ? sig_city.trim() : "";
        req.user.running_footer = running_footer ? running_footer.trim() : "";
      }

      return res.redirect("/profile?success=" + encodeURIComponent("Data profil pegawai, kop surat, dan footer dokumen berhasil disimpan!"));
    } catch (err) {
      console.error("Profile save error:", err);
      return res.redirect("/profile?error=" + encodeURIComponent("Gagal menyimpan profil: " + err.message));
    }
  }
};

export default profileController;
