import pool from "../config/database.js";

// Helper untuk menormalisasi data baris dari database
// Jika kolom ruangan belum ada di database, ruangan diekstrak otomatis dari keterangan [Ruangan: ...]
export const normalizeRequestRow = (row) => {
    if (!row) return row;
    if (!row.ruangan && row.keterangan && row.keterangan.includes("[Ruangan:")) {
        const match = row.keterangan.match(/\[Ruangan:\s*([^\]]+)\]/i);
        if (match) {
            row.ruangan = match[1].trim();
        }
    }
    return row;
};

// In-memory fallback untuk mode pengembangan jika database belum terhubung
const fallbackZoomRequests = [
    {
        id: 1,
        user_id: "user",
        nip: "199405122020121003",
        nama_pemohon: "Ahmad Fauzi, S.Kom.",
        divisi: "Sub Bagian Kepegawaian",
        judul_rapat: "Koordinasi Teknis Kenaikan Pangkat Periode April",
        tanggal_pengajuan: "2026-09-18",
        tanggal_rapat: "2026-09-22",
        waktu_mulai: "09:00",
        waktu_selesai: "12:00",
        keterangan: "Butuh kuota 300 peserta dan fitur breakout room untuk 3 kelompok",
        tipe_rapat: "Rapat Biasa",
        ruangan: "",
        status: "disetujui",
        zoom_link: "https://bkn.zoom.us/j/84291823910?pwd=kanreg5sidigi",
        meeting_id: "842 9182 3910",
        passcode: "BKN5KP26",
        catatan_admin: "Sudah dijadwalkan di Akun Zoom 01 Sidigi.",
        created_at: new Date()
    }
];

export const createRequest = async (data) => {
    const {
        user_id,
        nip,
        nama_pemohon,
        divisi,
        judul_rapat,
        tanggal_pengajuan,
        tanggal_rapat,
        waktu_mulai,
        waktu_selesai,
        keterangan,
        tipe_rapat = "Rapat Biasa",
        ruangan = "",
        sertifikat_bg = null,
        sertifikat_signer = null,
        sertifikat_signer_role = null,
        sertifikat_penyelenggara = null,
        sertifikat_enable_ttd = true,
        sertifikat_layout_mode = "full",
        sertifikat_format_nomor = null
    } = data;

    // Simpan informasi ruangan ke dalam keterangan agar tidak hilang jika kolom ruangan belum ada
    const combinedKeterangan = ruangan 
        ? (keterangan && keterangan.includes("[Ruangan:") ? keterangan : `[Ruangan: ${ruangan}] ${keterangan || ''}`.trim())
        : (keterangan || "");

    const effectiveUserId = user_id || nip || "user";
    const effectiveNip = nip || user_id || "user";

    try {
        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS ruangan VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
        `).catch(() => {});

        const isTtdBool = sertifikat_enable_ttd !== false && String(sertifikat_enable_ttd) !== 'false' && sertifikat_enable_ttd !== 0 && String(sertifikat_enable_ttd) !== '0';

        const query = `
            INSERT INTO zoom_requests (
                user_id, nip, nama_pemohon, divisi, judul_rapat, tanggal_pengajuan,
                tanggal_rapat, waktu_mulai, waktu_selesai, keterangan, tipe_rapat, ruangan,
                sertifikat_bg, sertifikat_signer, sertifikat_signer_role, sertifikat_penyelenggara,
                sertifikat_enable_ttd, sertifikat_layout_mode, sertifikat_format_nomor,
                status
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'menunggu')
            RETURNING *;
        `;
        const values = [
            effectiveUserId,
            effectiveNip,
            nama_pemohon || "",
            divisi || "",
            judul_rapat,
            tanggal_pengajuan || new Date().toISOString().split('T')[0],
            tanggal_rapat,
            waktu_mulai || null,
            waktu_selesai || null,
            combinedKeterangan,
            tipe_rapat || "Rapat Biasa",
            ruangan || "",
            sertifikat_bg || null,
            sertifikat_signer || null,
            sertifikat_signer_role || null,
            sertifikat_penyelenggara || null,
            isTtdBool,
            sertifikat_layout_mode || 'full',
            sertifikat_format_nomor || null
        ];
        const result = await pool.query(query, values);
        return normalizeRequestRow(result.rows[0]);
    } catch (err) {
        console.warn("⚠️ PostgreSQL error in createRequest (percobaan 1):", err.message);

        // Fallback 1: Jika kolom ruangan belum ada di skema
        try {
            const queryNoRuangan = `
                INSERT INTO zoom_requests (
                    user_id, nip, nama_pemohon, divisi, judul_rapat, tanggal_pengajuan,
                    tanggal_rapat, waktu_mulai, waktu_selesai, keterangan, tipe_rapat, status
                )
                VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, $9, $10, 'menunggu')
                RETURNING *;
            `;
            const valsNoRuangan = [
                effectiveUserId,
                effectiveNip,
                nama_pemohon || "",
                divisi || "",
                judul_rapat,
                tanggal_pengajuan || new Date().toISOString().split('T')[0],
                tanggal_rapat,
                waktu_mulai || null,
                waktu_selesai || null,
                combinedKeterangan,
                tipe_rapat || "Rapat Biasa"
            ];
            const fbRes1 = await pool.query(queryNoRuangan, valsNoRuangan);
            console.log("✅ Berhasil insert zoom_requests (fallback tanpa kolom ruangan)");
            return normalizeRequestRow(fbRes1.rows[0]);
        } catch (err2) {
            console.warn("⚠️ PostgreSQL error in createRequest (percobaan 2):", err2.message);

            // Fallback 2: Jika kolom user_id juga belum ada di skema legacy
            try {
                const queryMin = `
                    INSERT INTO zoom_requests (
                        nip, nama_pemohon, divisi, judul_rapat, tanggal_pengajuan,
                        tanggal_rapat, waktu_mulai, waktu_selesai, keterangan, tipe_rapat, status
                    )
                    VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, $9, $10, 'menunggu')
                    RETURNING *;
                `;
                const valsMin = [
                    effectiveNip,
                    nama_pemohon || "",
                    divisi || "",
                    judul_rapat,
                    tanggal_pengajuan || new Date().toISOString().split('T')[0],
                    tanggal_rapat,
                    waktu_mulai || null,
                    waktu_selesai || null,
                    combinedKeterangan,
                    tipe_rapat || "Rapat Biasa"
                ];
                const fbRes2 = await pool.query(queryMin, valsMin);
                console.log("✅ Berhasil insert zoom_requests (fallback skema minimal)");
                return normalizeRequestRow(fbRes2.rows[0]);
            } catch (err3) {
                console.error("⚠️ Seluruh query PostgreSQL gagal in createRequest:", err3.message);
            }
        }

        const newReq = {
            id: fallbackZoomRequests.length + 1,
            user_id: effectiveUserId,
            nip: effectiveNip,
            nama_pemohon: nama_pemohon || "",
            divisi: divisi || "",
            judul_rapat,
            tanggal_pengajuan: tanggal_pengajuan || new Date().toISOString().split('T')[0],
            tanggal_rapat,
            waktu_mulai: waktu_mulai || "09:00",
            waktu_selesai: waktu_selesai || "11:00",
            keterangan: combinedKeterangan,
            tipe_rapat: tipe_rapat || "Rapat Biasa",
            ruangan: ruangan || "",
            status: "menunggu",
            zoom_link: null,
            meeting_id: null,
            passcode: null,
            quiz_link: null,
            catatan_admin: null,
            created_at: new Date()
        };
        fallbackZoomRequests.unshift(newReq);
        return normalizeRequestRow(newReq);
    }
};

export const getAllRequests = async () => {
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests ORDER BY id DESC"
        );
        return result.rows.map(normalizeRequestRow);
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getAllRequests:", err.message);
        return fallbackZoomRequests.map(normalizeRequestRow);
    }
};

// Ambil semua permohonan yang terkait dengan akun user tertentu
// Mendukung pencocokan multi-identitas: user_id, nip, username, atau nama pemohon
export const getRequestsByUser = async (user) => {
    const userId = user?.id ? String(user.id).trim() : "";
    const userNip = user?.nip ? String(user.nip).trim() : "";
    const username = user?.username ? String(user.username).trim() : "";
    const fullName = user?.full_name ? String(user.full_name).trim() : "";

    try {
        const query = `
            SELECT * FROM zoom_requests 
            WHERE 
                ($1 != '' AND (user_id = $1 OR nip = $1))
                OR ($2 != '' AND (nip = $2 OR user_id = $2))
                OR ($3 != '' AND (user_id = $3 OR nip = $3))
                OR ($4 != '' AND LOWER(TRIM(nama_pemohon)) = LOWER(TRIM($4)))
            ORDER BY id DESC
        `;
        const result = await pool.query(query, [userId, userNip, username, fullName]);
        return result.rows.map(normalizeRequestRow);
    } catch (err) {
        // Jika kolom user_id belum ada, query hanya berdasarkan nip dan nama_pemohon
        try {
            const queryNoUserId = `
                SELECT * FROM zoom_requests 
                WHERE 
                    ($1 != '' AND nip = $1)
                    OR ($2 != '' AND nip = $2)
                    OR ($3 != '' AND nip = $3)
                    OR ($4 != '' AND LOWER(TRIM(nama_pemohon)) = LOWER(TRIM($4)))
                ORDER BY id DESC
            `;
            const fbResult = await pool.query(queryNoUserId, [userId, userNip, username, fullName]);
            return fbResult.rows.map(normalizeRequestRow);
        } catch (err2) {
            console.warn("⚠️ [DATABASE] Error in getRequestsByUser:", err2.message);
        }

        return fallbackZoomRequests.filter(r => 
            (userId && (r.user_id === userId || r.nip === userId)) ||
            (userNip && (r.nip === userNip || r.user_id === userNip)) ||
            (username && (r.user_id === username || r.nip === username)) ||
            (fullName && r.nama_pemohon && r.nama_pemohon.toLowerCase() === fullName.toLowerCase())
        ).map(normalizeRequestRow);
    }
};

export const getRequestsByNip = async (nip) => {
    const cleanNip = String(nip || "").trim();
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests WHERE nip = $1 OR user_id = $1 ORDER BY id DESC",
            [cleanNip]
        );
        return result.rows.map(normalizeRequestRow);
    } catch (err) {
        try {
            const result = await pool.query(
                "SELECT * FROM zoom_requests WHERE nip = $1 ORDER BY id DESC",
                [cleanNip]
            );
            return result.rows.map(normalizeRequestRow);
        } catch (e) {}
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getRequestsByNip:", err.message);
        return fallbackZoomRequests.filter(r => r.nip === cleanNip || r.user_id === cleanNip).map(normalizeRequestRow);
    }
};

export const getRequestById = async (id) => {
    try {
        const result = await pool.query(
            "SELECT * FROM zoom_requests WHERE id = $1",
            [id]
        );
        return normalizeRequestRow(result.rows[0]);
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in getRequestById:", err.message);
        return normalizeRequestRow(fallbackZoomRequests.find(r => r.id === parseInt(id)));
    }
};

export const updateRequestStatus = async (id, updateData) => {
    const { 
        status, 
        zoom_link, 
        meeting_id, 
        passcode, 
        catatan_admin, 
        quiz_link, 
        tipe_rapat, 
        ruangan,
        sertifikat_bg,
        sertifikat_signer,
        sertifikat_signer_role,
        sertifikat_penyelenggara,
        sertifikat_enable_ttd,
        sertifikat_layout_mode,
        sertifikat_format_nomor
    } = updateData;

    try {
        await pool.query(`
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS tipe_rapat VARCHAR(50) DEFAULT 'Rapat Biasa';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS ruangan VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS quiz_link TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS meeting_id VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS passcode VARCHAR(100);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS catatan_admin TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
        `).catch(() => {});

        const isTtdBool = sertifikat_enable_ttd !== undefined && sertifikat_enable_ttd !== null
            ? (sertifikat_enable_ttd !== false && String(sertifikat_enable_ttd) !== 'false' && sertifikat_enable_ttd !== 0 && String(sertifikat_enable_ttd) !== '0')
            : null;

        const query = `
            UPDATE zoom_requests
            SET status = COALESCE($1::varchar, status),
                zoom_link = COALESCE(NULLIF($2::text, ''), zoom_link),
                meeting_id = COALESCE(NULLIF($3::varchar, ''), meeting_id),
                passcode = COALESCE(NULLIF($4::varchar, ''), passcode),
                catatan_admin = COALESCE(NULLIF($5::text, ''), catatan_admin),
                quiz_link = COALESCE(NULLIF($6::text, ''), quiz_link),
                tipe_rapat = COALESCE(NULLIF($7::varchar, ''), tipe_rapat),
                ruangan = COALESCE(NULLIF($8::varchar, ''), ruangan),
                sertifikat_bg = COALESCE(NULLIF($9::text, ''), sertifikat_bg),
                sertifikat_signer = COALESCE(NULLIF($10::varchar, ''), sertifikat_signer),
                sertifikat_signer_role = COALESCE(NULLIF($11::varchar, ''), sertifikat_signer_role),
                sertifikat_penyelenggara = COALESCE(NULLIF($12::varchar, ''), sertifikat_penyelenggara),
                sertifikat_enable_ttd = COALESCE($13::boolean, sertifikat_enable_ttd),
                sertifikat_layout_mode = COALESCE(NULLIF($14::varchar, ''), sertifikat_layout_mode),
                sertifikat_format_nomor = COALESCE(NULLIF($15::varchar, ''), sertifikat_format_nomor)
            WHERE id = $16::int
            RETURNING *;
        `;
        const values = [
            status, 
            zoom_link, 
            meeting_id, 
            passcode, 
            catatan_admin, 
            quiz_link, 
            tipe_rapat, 
            ruangan,
            sertifikat_bg || null,
            sertifikat_signer || null,
            sertifikat_signer_role || null,
            sertifikat_penyelenggara || null,
            isTtdBool,
            sertifikat_layout_mode || null,
            sertifikat_format_nomor || null,
            parseInt(id, 10)
        ];
        const result = await pool.query(query, values);
        if (result.rows.length > 0) return normalizeRequestRow(result.rows[0]);
    } catch (err) {
        console.warn("⚠️ PostgreSQL error in updateRequestStatus, mencoba update esensial:", err.message);
        try {
            const fbQuery = `
                UPDATE zoom_requests
                SET status = COALESCE($1::varchar, status),
                    zoom_link = COALESCE(NULLIF($2::text, ''), zoom_link),
                    meeting_id = COALESCE(NULLIF($3::varchar, ''), meeting_id),
                    passcode = COALESCE(NULLIF($4::varchar, ''), passcode),
                    catatan_admin = COALESCE(NULLIF($5::text, ''), catatan_admin)
                WHERE id = $6::int
                RETURNING *;
            `;
            const fbRes = await pool.query(fbQuery, [status, zoom_link, meeting_id, passcode, catatan_admin, parseInt(id, 10)]);
            if (fbRes.rows.length > 0) return normalizeRequestRow(fbRes.rows[0]);
        } catch (err2) {
            console.error("⚠️ Gagal updateRequestStatus fallback:", err2.message);
        }
        const item = fallbackZoomRequests.find(r => r.id === parseInt(id));
        if (item) {
            if (status !== undefined) item.status = status;
            if (zoom_link !== undefined) item.zoom_link = zoom_link;
            if (meeting_id !== undefined) item.meeting_id = meeting_id;
            if (passcode !== undefined) item.passcode = passcode;
            if (catatan_admin !== undefined) item.catatan_admin = catatan_admin;
            if (quiz_link !== undefined) item.quiz_link = quiz_link;
            if (tipe_rapat !== undefined) item.tipe_rapat = tipe_rapat;
            if (ruangan !== undefined) item.ruangan = ruangan;
        }
        return normalizeRequestRow(item);
    }
};

export const deleteRequest = async (id) => {
    try {
        await pool.query("DELETE FROM zoom_requests WHERE id = $1", [id]);
        return true;
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL error in deleteRequest:", err.message);
        const idx = fallbackZoomRequests.findIndex(r => r.id === parseInt(id));
        if (idx !== -1) {
            fallbackZoomRequests.splice(idx, 1);
        }
        return true;
    }
};

export default {
    normalizeRequestRow,
    createRequest,
    getAllRequests,
    getRequestsByUser,
    getRequestsByNip,
    getRequestById,
    updateRequestStatus,
    deleteRequest
};
