import pool from "../config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const metaFile = path.resolve(__dirname, "..", "public", "uploads", "meeting_metadata.json");

function getMetadataStore() {
    try {
        if (fs.existsSync(metaFile)) {
            const data = fs.readFileSync(metaFile, "utf-8");
            return JSON.parse(data || "{}");
        }
    } catch (e) {
        console.warn("⚠️ Warning read meeting_metadata.json:", e.message);
    }
    return {};
}

function saveMetadataStore(store) {
    try {
        const dir = path.dirname(metaFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
        fs.writeFileSync(metaFile, JSON.stringify(store, null, 2), "utf-8");
    } catch (e) {
        console.warn("⚠️ Warning write meeting_metadata.json:", e.message);
    }
}

export const createMeeting = async ({ m_nama, deskripsi, tanggal, m_tipe, user_id }) => {
    try {
        const today = new Date();
        const tgl = today.toISOString().split('T')[0];

        const result = await pool.query(`
            INSERT INTO meetings (meeting_nama, deskripsi, tanggal, tipe_meeting, tgl_buat, user_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `, [m_nama, deskripsi, tanggal, m_tipe, tgl, user_id || 'admin']);
        return result.rows[0];
    } catch (err) {
        console.warn("⚠️ [DEV MODE] PostgreSQL database error in createMeeting:", err.message);
        return { m_nama, deskripsi, tanggal, m_tipe, user_id };
    }
};

export const updateMeeting = async ({
    meeting_id,
    m_nama,
    deskripsi,
    tanggal,
    m_tipe,
    thumbnail,
    notulen_pdf,
    bahan_rapat,
    video_url,
    absensi,
    zoom_link,
    zoom_meeting_id,
    zoom_passcode,
    sertifikat_bg,
    sertifikat_signer,
    sertifikat_signer_role,
    sertifikat_penyelenggara,
    sertifikat_enable_ttd,
    sertifikat_layout_mode,
    sertifikat_format_nomor
}) => {
    try {
        // Pastikan kolom-kolom pendukung tersedia di database
        await pool.query(`
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS absensi TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS thumbnail TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS video_url TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen_pdf TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notulen TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS bahan_rapat TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_passcode VARCHAR(100);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS zoom_request_id INT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipe_meeting VARCHAR(50);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_signer_role VARCHAR(150);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_penyelenggara VARCHAR(255);
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
            ALTER TABLE zoom_requests ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS bahan_rapat TEXT;
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_bg TEXT;
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_enable_ttd BOOLEAN DEFAULT TRUE;
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_layout_mode VARCHAR(50) DEFAULT 'full';
            ALTER TABLE meeting_media ADD COLUMN IF NOT EXISTS sertifikat_format_nomor VARCHAR(255);
        `).catch(() => {});

        let tipeVal = m_tipe;
        if (m_tipe && m_tipe.length > 1) {
            if (m_tipe.toLowerCase().includes('webinar')) tipeVal = '3';
            else if (m_tipe.toLowerCase().includes('zoom')) tipeVal = '2';
            else tipeVal = '1';
        }

        const setClauses = [];
        const values = [];
        let pIndex = 1;

        if (m_nama !== undefined && m_nama !== null) {
            setClauses.push(`meeting_nama = $${pIndex++}`);
            values.push(m_nama);
        }
        if (deskripsi !== undefined && deskripsi !== null) {
            setClauses.push(`deskripsi = $${pIndex++}`);
            values.push(deskripsi ? deskripsi.substring(0, 500) : "");
        }
        if (tanggal !== undefined && tanggal !== null) {
            setClauses.push(`tanggal = $${pIndex++}::date`);
            values.push(tanggal);
        }
        if (tipeVal !== undefined && tipeVal !== null) {
            setClauses.push(`tipe_meeting = $${pIndex++}`);
            values.push(tipeVal);
        }
        if (thumbnail !== undefined && thumbnail !== null) {
            setClauses.push(`thumbnail = $${pIndex++}`);
            values.push(thumbnail);
        }
        if (notulen_pdf !== undefined && notulen_pdf !== null) {
            setClauses.push(`notulen_pdf = $${pIndex++}`);
            values.push(notulen_pdf);
            setClauses.push(`notulen = $${pIndex++}`);
            values.push(notulen_pdf);
        }
        if (bahan_rapat !== undefined && bahan_rapat !== null) {
            setClauses.push(`bahan_rapat = $${pIndex++}`);
            values.push(bahan_rapat);
        }
        if (video_url !== undefined && video_url !== null) {
            setClauses.push(`video_url = $${pIndex++}`);
            values.push(video_url);
        }
        if (absensi !== undefined && absensi !== null) {
            setClauses.push(`absensi = $${pIndex++}`);
            values.push(absensi);
        }
        if (zoom_link !== undefined && zoom_link !== null) {
            setClauses.push(`zoom_link = $${pIndex++}`);
            values.push(zoom_link);
        }
        if (zoom_meeting_id !== undefined && zoom_meeting_id !== null) {
            setClauses.push(`zoom_meeting_id = $${pIndex++}`);
            values.push(zoom_meeting_id);
        }
        if (zoom_passcode !== undefined && zoom_passcode !== null) {
            setClauses.push(`zoom_passcode = $${pIndex++}`);
            values.push(zoom_passcode);
        }
        if (sertifikat_bg !== undefined && sertifikat_bg !== null) {
            setClauses.push(`sertifikat_bg = $${pIndex++}`);
            values.push(sertifikat_bg);
        }
        if (sertifikat_signer !== undefined && sertifikat_signer !== null) {
            setClauses.push(`sertifikat_signer = $${pIndex++}`);
            values.push(sertifikat_signer);
        }
        if (sertifikat_signer_role !== undefined && sertifikat_signer_role !== null) {
            setClauses.push(`sertifikat_signer_role = $${pIndex++}`);
            values.push(sertifikat_signer_role);
        }
        if (sertifikat_penyelenggara !== undefined && sertifikat_penyelenggara !== null) {
            setClauses.push(`sertifikat_penyelenggara = $${pIndex++}`);
            values.push(sertifikat_penyelenggara);
        }
        if (sertifikat_enable_ttd !== undefined && sertifikat_enable_ttd !== null) {
            const isTtd = sertifikat_enable_ttd !== false && String(sertifikat_enable_ttd) !== 'false' && sertifikat_enable_ttd !== 0 && String(sertifikat_enable_ttd) !== '0';
            setClauses.push(`sertifikat_enable_ttd = $${pIndex++}`);
            values.push(isTtd);
        }
        if (sertifikat_layout_mode !== undefined && sertifikat_layout_mode !== null) {
            setClauses.push(`sertifikat_layout_mode = $${pIndex++}`);
            values.push(sertifikat_layout_mode);
        }
        if (sertifikat_format_nomor !== undefined && sertifikat_format_nomor !== null) {
            setClauses.push(`sertifikat_format_nomor = $${pIndex++}`);
            values.push(sertifikat_format_nomor);
        }

        const mId = parseInt(meeting_id, 10) || meeting_id;

        let finalRow = null;
        if (setClauses.length > 0) {
            values.push(mId);
            const query = `
                UPDATE meetings 
                SET ${setClauses.join(', ')} 
                WHERE meeting_id = $${pIndex}::int
                RETURNING *;
            `;
            const result = await pool.query(query, values);
            finalRow = result.rows[0] || null;
        }

        // Simpan ke tabel meeting_media di database PostgreSQL
        const isTtdBool = sertifikat_enable_ttd !== undefined && sertifikat_enable_ttd !== null
            ? (sertifikat_enable_ttd !== false && String(sertifikat_enable_ttd) !== 'false' && sertifikat_enable_ttd !== 0 && String(sertifikat_enable_ttd) !== '0')
            : null;

        try {
            await pool.query(`
                INSERT INTO meeting_media (meeting_id, thumbnail, notulen_pdf, bahan_rapat, video_url, absensi, sertifikat_bg, sertifikat_enable_ttd, sertifikat_layout_mode, sertifikat_format_nomor, updated_at)
                VALUES ($1::int, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                ON CONFLICT (meeting_id) DO UPDATE SET
                    thumbnail = COALESCE(NULLIF(EXCLUDED.thumbnail, ''), meeting_media.thumbnail),
                    notulen_pdf = COALESCE(NULLIF(EXCLUDED.notulen_pdf, ''), meeting_media.notulen_pdf),
                    bahan_rapat = COALESCE(NULLIF(EXCLUDED.bahan_rapat, ''), meeting_media.bahan_rapat),
                    video_url = COALESCE(NULLIF(EXCLUDED.video_url, ''), meeting_media.video_url),
                    absensi = COALESCE(NULLIF(EXCLUDED.absensi, ''), meeting_media.absensi),
                    sertifikat_bg = COALESCE(NULLIF(EXCLUDED.sertifikat_bg, ''), meeting_media.sertifikat_bg),
                    sertifikat_enable_ttd = COALESCE(EXCLUDED.sertifikat_enable_ttd, meeting_media.sertifikat_enable_ttd),
                    sertifikat_layout_mode = COALESCE(NULLIF(EXCLUDED.sertifikat_layout_mode, ''), meeting_media.sertifikat_layout_mode),
                    sertifikat_format_nomor = COALESCE(NULLIF(EXCLUDED.sertifikat_format_nomor, ''), meeting_media.sertifikat_format_nomor),
                    updated_at = CURRENT_TIMESTAMP
            `, [mId, thumbnail || null, notulen_pdf || null, bahan_rapat || null, video_url || null, absensi || null, sertifikat_bg || null, isTtdBool, sertifikat_layout_mode || null, sertifikat_format_nomor || null]);
        } catch (mmErr) {
            console.warn("⚠️ Warning upsert meeting_media:", mmErr.message);
        }

        // Sinkronisasi juga ke tabel zoom_requests jika rapat terhubung dengan permohonan zoom
        try {
            await pool.query(`
                UPDATE zoom_requests
                SET sertifikat_bg = COALESCE(NULLIF($1, ''), sertifikat_bg),
                    sertifikat_signer = COALESCE(NULLIF($2, ''), sertifikat_signer),
                    sertifikat_signer_role = COALESCE(NULLIF($3, ''), sertifikat_signer_role),
                    sertifikat_penyelenggara = COALESCE(NULLIF($4, ''), sertifikat_penyelenggara),
                    sertifikat_enable_ttd = COALESCE($5, sertifikat_enable_ttd),
                    sertifikat_layout_mode = COALESCE(NULLIF($6, ''), sertifikat_layout_mode),
                    sertifikat_format_nomor = COALESCE(NULLIF($7, ''), sertifikat_format_nomor)
                WHERE id = (SELECT zoom_request_id FROM meetings WHERE meeting_id = $8::int)
            `, [sertifikat_bg || null, sertifikat_signer || null, sertifikat_signer_role || null, sertifikat_penyelenggara || null, isTtdBool, sertifikat_layout_mode || null, sertifikat_format_nomor || null, mId]);
        } catch (_) {}

        // Simpan ke persistent metadata store agar TIDAK PERNAH HILANG saat restart/refresh
        try {
            const metaStore = getMetadataStore();
            const mIdStr = String(mId);
            if (!metaStore[mIdStr]) metaStore[mIdStr] = {};
            if (sertifikat_bg !== undefined && sertifikat_bg !== null) metaStore[mIdStr].sertifikat_bg = sertifikat_bg;
            if (sertifikat_signer !== undefined && sertifikat_signer !== null) metaStore[mIdStr].sertifikat_signer = sertifikat_signer;
            if (sertifikat_signer_role !== undefined && sertifikat_signer_role !== null) metaStore[mIdStr].sertifikat_signer_role = sertifikat_signer_role;
            if (sertifikat_penyelenggara !== undefined && sertifikat_penyelenggara !== null) metaStore[mIdStr].sertifikat_penyelenggara = sertifikat_penyelenggara;
            if (sertifikat_enable_ttd !== undefined && sertifikat_enable_ttd !== null) metaStore[mIdStr].sertifikat_enable_ttd = sertifikat_enable_ttd;
            if (sertifikat_layout_mode !== undefined && sertifikat_layout_mode !== null) metaStore[mIdStr].sertifikat_layout_mode = sertifikat_layout_mode;
            if (sertifikat_format_nomor !== undefined && sertifikat_format_nomor !== null) metaStore[mIdStr].sertifikat_format_nomor = sertifikat_format_nomor;
            if (thumbnail) metaStore[mIdStr].thumbnail = thumbnail;
            if (notulen_pdf) metaStore[mIdStr].notulen_pdf = notulen_pdf;
            if (bahan_rapat) metaStore[mIdStr].bahan_rapat = bahan_rapat;
            if (video_url) metaStore[mIdStr].video_url = video_url;
            if (absensi) metaStore[mIdStr].absensi = absensi;
            saveMetadataStore(metaStore);
        } catch (_) {}

        if (!finalRow) {
            finalRow = await getMeetingById(mId);
        }
        return finalRow;
    } catch (err) {
        console.warn("⚠️ PostgreSQL database error in updateMeeting, mencoba fallback:", err.message);
        const mId = parseInt(meeting_id, 10) || meeting_id;
        try {
            const fbResult = await pool.query(
                `UPDATE meetings 
                 SET meeting_nama = COALESCE($1, meeting_nama),
                     sertifikat_bg = COALESCE(NULLIF($2, ''), sertifikat_bg)
                 WHERE meeting_id = $3::int
                 RETURNING *`,
                [m_nama || null, sertifikat_bg || null, mId]
            );
            // Simpan juga ke metadata saat fallback
            try {
                const metaStore = getMetadataStore();
                const mIdStr = String(mId);
                if (!metaStore[mIdStr]) metaStore[mIdStr] = {};
                if (sertifikat_bg) metaStore[mIdStr].sertifikat_bg = sertifikat_bg;
                saveMetadataStore(metaStore);
            } catch (_) {}

            return fbResult.rows[0] || (await getMeetingById(mId));
        } catch (err2) {
            console.error("❌ Gagal updateMeeting fallback:", err2.message);
            return await getMeetingById(mId);
        }
    }
};

export const getAllMeeting = async () => {
    let rows = [];
    try {
        const result = await pool.query("SELECT * FROM meetings ORDER BY meeting_id DESC");
        rows = result.rows || [];
    } catch (err) {
        console.error("⚠️ Gagal mengambil data dasar meetings:", err.message);
        return [];
    }

    if (rows.length === 0) return [];

    // 1. Perkaya dengan data dari meeting_media jika tabel tersedia
    try {
        const mmRes = await pool.query("SELECT * FROM meeting_media");
        const mmMap = {};
        for (const mm of (mmRes.rows || [])) {
            mmMap[String(mm.meeting_id)] = mm;
        }
        for (const row of rows) {
            const mm = mmMap[String(row.meeting_id)];
            if (mm) {
                if (!row.thumbnail && mm.thumbnail) row.thumbnail = mm.thumbnail;
                if (!row.notulen_pdf && mm.notulen_pdf) row.notulen_pdf = mm.notulen_pdf;
                if (!row.bahan_rapat && mm.bahan_rapat) row.bahan_rapat = mm.bahan_rapat;
                if (!row.video_url && mm.video_url) row.video_url = mm.video_url;
                if (!row.absensi && mm.absensi) row.absensi = mm.absensi;
                if (!row.sertifikat_bg && mm.sertifikat_bg) row.sertifikat_bg = mm.sertifikat_bg;
                if (row.sertifikat_enable_ttd === undefined && mm.sertifikat_enable_ttd !== undefined) row.sertifikat_enable_ttd = mm.sertifikat_enable_ttd;
                if (!row.sertifikat_layout_mode && mm.sertifikat_layout_mode) row.sertifikat_layout_mode = mm.sertifikat_layout_mode;
                if (!row.sertifikat_format_nomor && mm.sertifikat_format_nomor) row.sertifikat_format_nomor = mm.sertifikat_format_nomor;
            }
        }
    } catch (_) {}

    // 2. Perkaya dengan zoom_requests jika tersedia
    try {
        const zRes = await pool.query("SELECT * FROM zoom_requests");
        const zMap = {};
        for (const z of (zRes.rows || [])) {
            zMap[String(z.id)] = z;
        }
        for (const row of rows) {
            const z = (row.zoom_request_id && zMap[String(row.zoom_request_id)]) 
                   || (zRes.rows || []).find(zr => zr.judul_rapat && row.meeting_nama && zr.judul_rapat.trim().toLowerCase() === row.meeting_nama.trim().toLowerCase());
            if (z) {
                if (!row.zoom_link && z.zoom_link) row.zoom_link = z.zoom_link;
                if (!row.zoom_meeting_id && z.meeting_id) row.zoom_meeting_id = z.meeting_id;
                if (!row.zoom_passcode && z.passcode) row.zoom_passcode = z.passcode;
                row.zoom_nip = z.nip || '';
                row.zoom_pemohon = z.nama_pemohon || '';
                if (!row.sertifikat_bg && z.sertifikat_bg) row.sertifikat_bg = z.sertifikat_bg;
                if (!row.creator_user_id) row.creator_user_id = z.user_id || z.nip || 'admin';
            }
            if (!row.creator_user_id) row.creator_user_id = row.user_id || row.pembuat || 'admin';
        }
    } catch (_) {
        for (const row of rows) {
            if (!row.creator_user_id) row.creator_user_id = row.user_id || row.pembuat || 'admin';
        }
    }

    // 3. Perkaya data dengan persistent metadata store
    try {
        const metaStore = getMetadataStore();
        for (const row of rows) {
            const mIdStr = String(row.meeting_id);
            if (metaStore[mIdStr]) {
                const meta = metaStore[mIdStr];
                if (!row.sertifikat_bg && meta.sertifikat_bg) row.sertifikat_bg = meta.sertifikat_bg;
                if (!row.sertifikat_signer && meta.sertifikat_signer) row.sertifikat_signer = meta.sertifikat_signer;
                if (!row.sertifikat_signer_role && meta.sertifikat_signer_role) row.sertifikat_signer_role = meta.sertifikat_signer_role;
                if (!row.sertifikat_penyelenggara && meta.sertifikat_penyelenggara) row.sertifikat_penyelenggara = meta.sertifikat_penyelenggara;
                if (row.sertifikat_enable_ttd === undefined && meta.sertifikat_enable_ttd !== undefined) row.sertifikat_enable_ttd = meta.sertifikat_enable_ttd;
                if (!row.sertifikat_layout_mode && meta.sertifikat_layout_mode) row.sertifikat_layout_mode = meta.sertifikat_layout_mode;
                if (!row.sertifikat_format_nomor && meta.sertifikat_format_nomor) row.sertifikat_format_nomor = meta.sertifikat_format_nomor;
                if (!row.thumbnail && meta.thumbnail) row.thumbnail = meta.thumbnail;
                if (!row.notulen_pdf && meta.notulen_pdf) row.notulen_pdf = meta.notulen_pdf;
                if (!row.bahan_rapat && meta.bahan_rapat) row.bahan_rapat = meta.bahan_rapat;
                if (!row.video_url && meta.video_url) row.video_url = meta.video_url;
                if (!row.absensi && meta.absensi) row.absensi = meta.absensi;
            }
        }
    } catch (_) {}

    return rows;
};

export const getMeetingById = async (id) => {
    let meeting = null;
    const mId = parseInt(id, 10) || id;
    try {
        const res = await pool.query("SELECT * FROM meetings WHERE meeting_id = $1::int", [mId]);
        meeting = res.rows[0] || null;
    } catch (e) {
        try {
            const res2 = await pool.query("SELECT * FROM meetings WHERE meeting_id = $1", [id]);
            meeting = res2.rows[0] || null;
        } catch (_) {}
    }

    if (!meeting) return null;

    // Perkaya dari meeting_media
    try {
        const mmRes = await pool.query("SELECT * FROM meeting_media WHERE meeting_id = $1::int", [mId]);
        if (mmRes.rows && mmRes.rows.length > 0) {
            const mm = mmRes.rows[0];
            if (!meeting.thumbnail && mm.thumbnail) meeting.thumbnail = mm.thumbnail;
            if (!meeting.notulen_pdf && mm.notulen_pdf) meeting.notulen_pdf = mm.notulen_pdf;
            if (!meeting.bahan_rapat && mm.bahan_rapat) meeting.bahan_rapat = mm.bahan_rapat;
            if (!meeting.video_url && mm.video_url) meeting.video_url = mm.video_url;
            if (!meeting.absensi && mm.absensi) meeting.absensi = mm.absensi;
            if (!meeting.sertifikat_bg && mm.sertifikat_bg) meeting.sertifikat_bg = mm.sertifikat_bg;
            if (meeting.sertifikat_enable_ttd === undefined && mm.sertifikat_enable_ttd !== undefined) meeting.sertifikat_enable_ttd = mm.sertifikat_enable_ttd;
            if (!meeting.sertifikat_layout_mode && mm.sertifikat_layout_mode) meeting.sertifikat_layout_mode = mm.sertifikat_layout_mode;
            if (!meeting.sertifikat_format_nomor && mm.sertifikat_format_nomor) meeting.sertifikat_format_nomor = mm.sertifikat_format_nomor;
        }
    } catch (_) {}

    // Perkaya dari zoom_requests
    try {
        let zRes = null;
        if (meeting.zoom_request_id) {
            zRes = await pool.query("SELECT * FROM zoom_requests WHERE id = $1::int", [meeting.zoom_request_id]);
        } else if (meeting.meeting_nama) {
            zRes = await pool.query("SELECT * FROM zoom_requests WHERE LOWER(TRIM(judul_rapat)) = LOWER(TRIM($1)) ORDER BY id DESC LIMIT 1", [meeting.meeting_nama]);
        }
        if (zRes && zRes.rows && zRes.rows.length > 0) {
            const z = zRes.rows[0];
            if (!meeting.zoom_link && z.zoom_link) meeting.zoom_link = z.zoom_link;
            if (!meeting.zoom_meeting_id && z.meeting_id) meeting.zoom_meeting_id = z.meeting_id;
            if (!meeting.zoom_passcode && z.passcode) meeting.zoom_passcode = z.passcode;
            meeting.zoom_nip = z.nip || '';
            meeting.zoom_pemohon = z.nama_pemohon || '';
            if (!meeting.creator_user_id) meeting.creator_user_id = z.user_id || z.nip || 'admin';
            if (!meeting.sertifikat_bg && z.sertifikat_bg) meeting.sertifikat_bg = z.sertifikat_bg;
        }
    } catch (_) {}

    if (!meeting.creator_user_id) meeting.creator_user_id = meeting.user_id || meeting.pembuat || 'admin';

    // Perkaya dari meeting_metadata.json
    try {
        const metaStore = getMetadataStore();
        const mIdStr = String(meeting.meeting_id);
        if (metaStore[mIdStr]) {
            const meta = metaStore[mIdStr];
            if (!meeting.sertifikat_bg && meta.sertifikat_bg) meeting.sertifikat_bg = meta.sertifikat_bg;
            if (!meeting.sertifikat_signer && meta.sertifikat_signer) meeting.sertifikat_signer = meta.sertifikat_signer;
            if (!meeting.sertifikat_signer_role && meta.sertifikat_signer_role) meeting.sertifikat_signer_role = meta.sertifikat_signer_role;
            if (!meeting.sertifikat_penyelenggara && meta.sertifikat_penyelenggara) meeting.sertifikat_penyelenggara = meta.sertifikat_penyelenggara;
            if (meeting.sertifikat_enable_ttd === undefined && meta.sertifikat_enable_ttd !== undefined) meeting.sertifikat_enable_ttd = meta.sertifikat_enable_ttd;
            if (!meeting.sertifikat_layout_mode && meta.sertifikat_layout_mode) meeting.sertifikat_layout_mode = meta.sertifikat_layout_mode;
            if (!meeting.sertifikat_format_nomor && meta.sertifikat_format_nomor) meeting.sertifikat_format_nomor = meta.sertifikat_format_nomor;
            if (!meeting.thumbnail && meta.thumbnail) meeting.thumbnail = meta.thumbnail;
            if (!meeting.notulen_pdf && meta.notulen_pdf) meeting.notulen_pdf = meta.notulen_pdf;
            if (!meeting.bahan_rapat && meta.bahan_rapat) meeting.bahan_rapat = meta.bahan_rapat;
            if (!meeting.video_url && meta.video_url) meeting.video_url = meta.video_url;
            if (!meeting.absensi && meta.absensi) meeting.absensi = meta.absensi;
        }
    } catch (_) {}

    return meeting;
};

export const initPegawaiMeetingsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pegawai_meetings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                meeting_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, meeting_id)
            );
            CREATE INDEX IF NOT EXISTS idx_pegawai_meetings_user ON pegawai_meetings(user_id);
        `);
    } catch (err) {
        console.warn("⚠️ Warning initPegawaiMeetingsTable:", err.message);
    }
};

export const getPegawaiMeetings = async (userId) => {
    await initPegawaiMeetingsTable();
    try {
        const res = await pool.query(
            "SELECT meeting_id FROM pegawai_meetings WHERE user_id = $1 ORDER BY created_at DESC",
            [String(userId).trim()]
        );
        const meetingIds = new Set(res.rows.map(r => String(r.meeting_id)));
        const all = await getAllMeeting();
        return all.filter(m => meetingIds.has(String(m.meeting_id)));
    } catch (e) {
        console.error("Error getPegawaiMeetings:", e.message);
        return [];
    }
};

export const addPegawaiMeeting = async (userId, meetingId) => {
    await initPegawaiMeetingsTable();
    const res = await pool.query(
        `INSERT INTO pegawai_meetings (user_id, meeting_id) 
         VALUES ($1, $2::int) 
         ON CONFLICT (user_id, meeting_id) DO NOTHING 
         RETURNING *`,
        [String(userId).trim(), parseInt(meetingId, 10)]
    );
    return res.rows[0] || null;
};

export const removePegawaiMeeting = async (userId, meetingId) => {
    await initPegawaiMeetingsTable();
    await pool.query(
        "DELETE FROM pegawai_meetings WHERE user_id = $1 AND meeting_id = $2::int",
        [String(userId).trim(), parseInt(meetingId, 10)]
    );
    return true;
};

export const getAvailableMeetingsForPegawai = async (userId) => {
    await initPegawaiMeetingsTable();
    try {
        const enrolledRes = await pool.query(
            "SELECT meeting_id FROM pegawai_meetings WHERE user_id = $1",
            [String(userId).trim()]
        );
        const enrolledIds = new Set(enrolledRes.rows.map(r => String(r.meeting_id)));
        const all = await getAllMeeting();

        // Waktu WIB saat ini (UTC+7)
        const nowUtc = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
        const nowWIB = new Date(nowUtc + (7 * 3600000));
        const y = nowWIB.getFullYear();
        const mo = String(nowWIB.getMonth() + 1).padStart(2, '0');
        const dt = String(nowWIB.getDate()).padStart(2, '0');
        const todayStr = `${y}-${mo}-${dt}`;
        const curHM = `${String(nowWIB.getHours()).padStart(2, '0')}:${String(nowWIB.getMinutes()).padStart(2, '0')}`;

        // Filter: HANYA tampilkan rapat yang belum berakhir (rapat yang sudah berakhir jangan ditampilkan di pilihan)
        const activeMeetings = all.filter(m => {
            let rawIsoDate = '';
            if (m.tanggal) {
                if (typeof m.tanggal === 'string' && m.tanggal.match(/^\d{4}-\d{2}-\d{2}/)) {
                    rawIsoDate = m.tanggal.substring(0, 10);
                } else {
                    const d = new Date(m.tanggal);
                    if (!isNaN(d.getTime())) {
                        const yr = d.getFullYear();
                        const mon = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        rawIsoDate = `${yr}-${mon}-${day}`;
                    }
                }
            }

            // Jika tanggal tidak ada atau tidak valid, jangan tampilkan di pilihan rapat
            if (!rawIsoDate) return false;

            // Ekstrak waktu selesai jika ada
            let wSelesai = m.waktu_selesai || '';
            if (!wSelesai && m.deskripsi) {
                const matchSelesai = m.deskripsi.match(/-\s*(\d{1,2}[:.]\d{2})/i);
                if (matchSelesai) wSelesai = matchSelesai[1];
            }
            if (wSelesai) wSelesai = wSelesai.replace(':', '.');
            const endHM = wSelesai ? wSelesai.replace('.', ':') : '23:59';

            // 1. Rapat dengan tanggal di masa lalu (sebelum hari ini) -> SUDAH BERAKHIR (JANGAN TAMPILKAN)
            if (rawIsoDate < todayStr) {
                return false;
            }

            // 2. Rapat hari ini dengan jam selesai sudah lewat -> SUDAH BERAKHIR (JANGAN TAMPILKAN)
            if (rawIsoDate === todayStr && endHM && curHM > endHM) {
                return false;
            }

            return true;
        });

        return activeMeetings.map(m => {
            let rawIsoDate = '';
            if (m.tanggal) {
                if (typeof m.tanggal === 'string' && m.tanggal.match(/^\d{4}-\d{2}-\d{2}/)) {
                    rawIsoDate = m.tanggal.substring(0, 10);
                } else {
                    const d = new Date(m.tanggal);
                    if (!isNaN(d.getTime())) {
                        const yr = d.getFullYear();
                        const mon = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        rawIsoDate = `${yr}-${mon}-${day}`;
                    }
                }
            }

            let wMulai = m.waktu_mulai || '';
            let wSelesai = m.waktu_selesai || '';
            if (!wMulai && m.deskripsi) {
                const matchMulai = m.deskripsi.match(/Waktu:\s*(\d{1,2}[:.]\d{2})/i);
                if (matchMulai) wMulai = matchMulai[1];
            }
            if (!wSelesai && m.deskripsi) {
                const matchSelesai = m.deskripsi.match(/-\s*(\d{1,2}[:.]\d{2})/i);
                if (matchSelesai) wSelesai = matchSelesai[1];
            }
            if (wMulai) wMulai = wMulai.replace(':', '.');
            if (wSelesai) wSelesai = wSelesai.replace(':', '.');
            const startHM = wMulai ? wMulai.replace('.', ':') : '';

            let statusWaktu = 'upcoming'; // Belum Mulai
            if (rawIsoDate === todayStr) {
                if (startHM && curHM >= startHM) {
                    statusWaktu = 'active'; // Sedang Berlangsung
                }
            }

            return {
                meeting_id: m.meeting_id,
                meeting_nama: m.meeting_nama || m.m_nama || 'Agenda Rapat BKN',
                tanggal: m.tanggal,
                waktu_mulai: wMulai,
                waktu_selesai: wSelesai,
                status_waktu: statusWaktu,
                tipe_meeting: m.tipe_meeting || m.m_tipe || 'Rapat',
                deskripsi: m.deskripsi,
                zoom_link: m.zoom_link,
                thumbnail: m.thumbnail,
                is_enrolled: enrolledIds.has(String(m.meeting_id))
            };
        });
    } catch (e) {
        console.error("Error getAvailableMeetingsForPegawai:", e.message);
        return [];
    }
};

export default {
    createMeeting,
    updateMeeting,
    getAllMeeting,
    getMeetingById,
    initPegawaiMeetingsTable,
    getPegawaiMeetings,
    addPegawaiMeeting,
    removePegawaiMeeting,
    getAvailableMeetingsForPegawai
};