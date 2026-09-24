export const ensureAuthenticated = (req, res, next) => {
    // 1. Cek passport standard authentication
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    // 2. Cek session passport user
    if (req.session && req.session.passport && req.session.passport.user) {
        return next();
    }

    // 3. User belum login - jika request API/fetch, kirim respon JSON 401
    if (req.xhr || req.headers.accept?.includes("json") || req.path?.startsWith("/api/")) {
        return res.status(401).json({ success: false, message: "Sesi login telah berakhir. Silakan login kembali." });
    }

    // Alihkan ke login utama untuk request halaman browser biasa
    return res.redirect("/?error=" + encodeURIComponent("Silakan login terlebih dahulu untuk mengakses halaman ini."));
};

export const ensureAdmin = (req, res, next) => {
    const currentUser = req.user || res.locals.user;
    if (currentUser && currentUser.role === "admin") {
        return next();
    }

    // Bukan admin - alihkan ke dashboard dengan notifikasi error
    return res.redirect("/dashboard?error=" + encodeURIComponent("Akses ditolak. Fitur Manajemen User hanya dapat diakses oleh Administrator."));
};

