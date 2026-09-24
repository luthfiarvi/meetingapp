import fs from 'fs';
import pool from './config/database.js';

async function restore() {
    try {
        const raw = fs.readFileSync('backup_dummy_data.json', 'utf8');
        const data = JSON.parse(raw);

        // Truncate current tables first
        await pool.query('TRUNCATE webinar_quiz_votes, webinar_quizzes, webinar_qa, sertifikat, notulen, presensi, meetings, zoom_requests CASCADE');

        // Restore meetings
        for (const row of data.meetings || []) {
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
            await pool.query(`INSERT INTO meetings (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        }

        // Restore zoom_requests
        for (const row of data.zoom_requests || []) {
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
            await pool.query(`INSERT INTO zoom_requests (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        }

        // Restore presensi
        for (const row of data.presensi || []) {
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
            await pool.query(`INSERT INTO presensi (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        }

        // Restore sertifikat
        for (const row of data.sertifikat || []) {
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
            await pool.query(`INSERT INTO sertifikat (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        }

        // Restore notulen
        for (const row of data.notulen || []) {
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
            await pool.query(`INSERT INTO notulen (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        }

        console.log('RESTORE COMPLETED SUCCESSFULLY');
    } catch (err) {
        console.error('Error restoring:', err);
    } finally {
        await pool.end();
    }
}

restore();
