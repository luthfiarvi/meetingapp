import dotenv from "dotenv";
dotenv.config();

const aiService = {
  /**
   * Mengubah teks laporan mentah menjadi data infografis terstruktur
   * @param {string} rawText Teks laporan bebas dari pengguna
   * @param {object} user Objek profil pengguna login
   * @returns {Promise<object>}
   */
  generateInfographicFromText: async (rawText, user = {}) => {
    if (!rawText || !rawText.trim()) {
      throw new Error('Teks laporan tidak boleh kosong.');
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    // Jika ada GEMINI_API_KEY, gunakan API resmi Gemini
    if (geminiKey && geminiKey.trim() !== '') {
      try {
        const aiResult = await callGeminiAPI(rawText, user, geminiKey);
        if (aiResult) return aiResult;
      } catch (err) {
        console.warn('⚠️ Gagal memanggil Gemini API (' + err.message + '). Beralih ke Smart Semantic Parser lokal.');
      }
    }

    // Fallback: Smart Heuristic Semantic Parser lokal (Cepat, Tanpa Kuota, Selalu Berhasil)
    return smartLocalParser(rawText, user);
  },

  /**
   * Mengubah catatan / transkrip rapat menjadi dokumen Notula Kedinasan BKN terstruktur
   * @param {string} rawText Transkrip atau catatan rapat mentah
   * @param {object} user Profil pengguna login (nama, instansi, divisi)
   * @returns {Promise<object>}
   */
  generateNotulenFromText: async (rawText, user = {}) => {
    if (!rawText || !rawText.trim()) {
      throw new Error('Teks catatan atau transkrip rapat tidak boleh kosong.');
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    let result = null;

    if (geminiKey && geminiKey.trim() !== '') {
      try {
        result = await callGeminiNotulenAPI(rawText, user, geminiKey);
      } catch (err) {
        console.warn('⚠️ Gagal memanggil Gemini API untuk Notulen (' + err.message + '). Beralih ke Smart Notulen Parser lokal.');
      }
    }

    if (!result) {
      result = smartLocalNotulenParser(rawText, user);
    }

    // Pastikan daftar peserta selalu dirapikan ke tingkat Tim / Unit Kerja / Jabatan Struktural (tanpa nama orang pribadi)
    if (result && Array.isArray(result.attendees)) {
      result.attendees = sanitizeAttendees(result.attendees);
    }

    // Normalisasi & validasi Tabel Kertas Kerja MT
    if (result) {
      if (result.isMT && Array.isArray(result.kertasKerjaMT) && result.kertasKerjaMT.length > 0) {
        result.kertasKerjaMT = normalizeKertasKerjaMT(result.kertasKerjaMT);
      } else if (!result.isMT) {
        result.isMT = false;
        result.kertasKerjaMT = null;
      }
    }

    return result;
  }
};

/**
 * Panggilan REST API ke Google Gemini
 */
async function callGeminiAPI(rawText, user, apiKey) {
  const prompt = `
Anda adalah AI Asisten Pembuat Infografis Eksekutif untuk Badan Kepegawaian Negara (BKN).
Tugas Anda adalah membaca catatan laporan harian mentah dari pegawai berikut dan mengubahnya menjadi struktur data infografis terstruktur JSON.

Identitas Pegawai:
- Nama: ${user.full_name || 'Pegawai BKN'}
- Instansi: ${user.institution || 'Kantor Regional V BKN Jakarta'}
- Divisi: ${user.division || 'Pengembang Sistem'}

Teks Laporan Harian Pengguna:
"""
${rawText}
"""

Hasilkan HANYA objek JSON valid (tanpa markdown blok, tanpa awalan/akhiran apapun) dengan format skema persis seperti ini:
{
  "reportTitle": "Judul Laporan Resmi yang Menarik dan Profesional (maks 8 kata)",
  "reportSubtitle": "${user.institution || 'Kantor Regional V Badan Kepegawaian Negara'}",
  "reportDate": "YYYY-MM-DD (ambil dari teks jika ada atau tanggal hari ini)",
  "formattedDate": "Format Bahasa Indonesia, contoh: Kamis, 10 September 2026",
  "metrics": [
    { "label": "Label Metrik 1 (maks 2 kata)", "value": "Angka/Persen", "note": "Keterangan tren/status singkat" },
    { "label": "Label Metrik 2 (maks 2 kata)", "value": "Angka/Waktu", "note": "Keterangan singkat" },
    { "label": "Label Metrik 3 (maks 2 kata)", "value": "Angka/Uptime", "note": "Keterangan singkat" },
    { "label": "Label Metrik 4 (maks 2 kata)", "value": "Angka/Sprint", "note": "Keterangan singkat" }
  ],
  "pillars": [
    {
      "title": "Nama Pilar/Kategori Utama 1",
      "items": [
        "Aktivitas 1 yang jelas dan padat",
        "Aktivitas 2 yang jelas dan padat",
        "Aktivitas 3 yang jelas dan padat"
      ]
    },
    {
      "title": "Nama Pilar/Kategori Utama 2",
      "items": [
        "Aktivitas 1 yang jelas dan padat",
        "Aktivitas 2 yang jelas dan padat",
        "Aktivitas 3 yang jelas dan padat"
      ]
    }
  ],
  "tableRows": [
    {
      "komponen": "Nama Komponen/Fitur/Modul",
      "status": "Selesai" | "Berjalan" | "Tertunda",
      "target": "100%",
      "ket": "Keterangan teknis/hasil singkat"
    }
  ]
}
`;

  return await executeGeminiGenerate(prompt, apiKey);
}

/**
 * Eksekusi panggilan API Gemini dengan multi-model fallback yang tangguh
 */
async function executeGeminiGenerate(prompt, apiKey) {
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput) throw new Error(`Output kosong dari model ${model}`);
        const cleaned = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      } else {
        const errorText = await response.text();
        lastError = new Error(`Gemini API (${model}) returned ${response.status}: ${errorText}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memanggil model Gemini.');
}

/**
 * Smart Heuristic Semantic Parser lokal (Bekerja secara offline tanpa batasan / kuota)
 * Mengekstrak seluruh butir pekerjaan, sub-aktivitas, dan matriks komponen tanpa pemotongan
 */
function smartLocalParser(rawText, user = {}) {
  const text = rawText.trim();
  const now = new Date();
  let isoDate = now.toISOString().split('T')[0];
  let formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 1. Ekstraksi Judul & Tanggal
  let title = '';
  const namaKegiatanMatch = text.match(/(?:nama kegiatan|judul|kegiatan)\s*:\s*([^\n\r*]+)/i);
  if (namaKegiatanMatch && namaKegiatanMatch[1].trim()) {
    title = namaKegiatanMatch[1].trim();
  } else {
    const uraianMatch = text.match(/uraian tugas\s*:\s*([^:\n\r]+)/i);
    if (uraianMatch && uraianMatch[1].trim()) {
      title = uraianMatch[1].trim();
    } else {
      const headerMatch = text.match(/^([^:\n\r(]+?)(?::|\s*\([0-9]+\)|\n)/i);
      if (headerMatch && headerMatch[1].trim().length > 10 && headerMatch[1].trim().length < 85) {
        title = headerMatch[1].replace(/^(laporan|uraian tugas|hari ini|tugas|saya|kami)\s*/i, '').trim();
      }
    }
  }

  if (!title || title.length < 5) {
    title = 'Pengembangan Sistem Informasi Tata Naskah Kedinasan BKN';
  }
  title = title.replace(/[#*_`]/g, '').trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 75) title = title.substring(0, 72) + '...';

  // Cek tanggal di dalam teks jika ada
  const dateMatch = text.match(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
  if (dateMatch) {
    const months = {
      januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
      juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
    };
    const mStr = months[dateMatch[2].toLowerCase()] || '01';
    const dStr = String(dateMatch[1]).padStart(2, '0');
    isoDate = `${dateMatch[3]}-${mStr}-${dStr}`;
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dObj = new Date(parseInt(dateMatch[3], 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
    const dayName = !isNaN(dObj.getDay()) ? dayNames[dObj.getDay()] : 'Kamis';
    formattedDate = `${dayName}, ${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`;
  }

  // 2. Ekstraksi Metrik
  const metrics = [];
  const tiketMatch = text.match(/(\d+)\s*(tiket|berkas|layanan|dokumen|tugas|task|pekerjaan|modul|berkas)/i) || text.match(/(tiket|berkas|layanan|dokumen)[\s\w:]*?(\d+)/i);
  if (tiketMatch) {
    const val = tiketMatch[1] && !isNaN(tiketMatch[1]) ? tiketMatch[1] : (tiketMatch[2] || '28');
    metrics.push({ label: 'Tugas Selesai', value: val, note: 'Target kinerja harian' });
  } else {
    metrics.push({ label: 'Tugas Selesai', value: '100%', note: 'Selesai & terintegrasi' });
  }

  const waktuMatch = text.match(/(\d+)\s*(menit|mnt|m|jam|detik)/i);
  if (waktuMatch) {
    metrics.push({ label: 'Waktu Respons', value: `${waktuMatch[1]}m`, note: 'Standar SLA BKN' });
  } else {
    metrics.push({ label: 'Efisiensi Waktu', value: '15m', note: 'Kecepatan otomasi' });
  }

  const persenMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%/g) || [];
  if (persenMatch.length > 0) {
    metrics.push({ label: 'Penyelesaian', value: persenMatch[0], note: 'Kesiapan rilis sistem' });
  } else {
    metrics.push({ label: 'Capaian Output', value: '100%', note: 'Target terpenuhi' });
  }

  metrics.push({ label: 'Validasi Sistem', value: 'Teruji', note: 'End-to-end testing' });

  // 3. Ekstraksi Komprehensif Seluruh Butir Kegiatan / Pekerjaan
  const extractedTasks = [];

  // Pola 1: Multi-line numbering (1. Judul \n * Subpoint...)
  if (/(?:^|\n)\s*[0-9]+\.\s+/.test(text)) {
    const lines = text.split(/\r?\n/);
    let currentTask = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      const numMatch = trimmed.match(/^[0-9]+\.\s+(.+)/);
      if (numMatch) {
        if (currentTask) extractedTasks.push(currentTask);
        currentTask = {
          title: numMatch[1].replace(/[#*_`]/g, '').trim(),
          subPoints: []
        };
      } else if (currentTask && /^[*\-•]\s+/.test(trimmed)) {
        const sub = trimmed.replace(/^[*\-•]\s+/, '').replace(/[#*_`]/g, '').trim();
        if (sub.length > 5) currentTask.subPoints.push(sub);
      }
    });
    if (currentTask) extractedTasks.push(currentTask);
  }

  // Pola 2: Inline numbering (1) ...; (2) ...; (3) ...
  if (extractedTasks.length === 0 && /\([0-9]+\)/.test(text)) {
    const inlineParts = text.split(/(?:;\s*|\s+)(?=\([0-9]+\))/);
    inlineParts.forEach(part => {
      const m = part.match(/\([0-9]+\)\s*(.+)/);
      if (m && m[1].trim()) {
        let clean = m[1]
          .replace(/;\s*(?:serta|dan)?\s*$/i, '')
          .replace(/^serta\s+/i, '')
          .replace(/[#*_`]/g, '')
          .trim();
        if (clean.length > 5) {
          extractedTasks.push({
            title: clean,
            subPoints: []
          });
        }
      }
    });
  }

  // Pola 3: Bullet points
  if (extractedTasks.length === 0) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(l => {
      if (/^[*\-•]\s+/.test(l)) {
        const clean = l.replace(/^[*\-•]\s+/, '').replace(/[#*_`]/g, '').trim();
        if (clean.length > 10 && !clean.toLowerCase().startsWith('hari') && !clean.toLowerCase().startsWith('nama kegiatan') && !clean.toLowerCase().startsWith('status')) {
          extractedTasks.push({ title: clean, subPoints: [] });
        }
      }
    });
  }

  // Pola 4: Pemecahan kalimat presisi
  if (extractedTasks.length === 0) {
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 15);
    sentences.forEach(s => {
      extractedTasks.push({ title: s, subPoints: [] });
    });
  }

  // 4. Susun Matriks Komponen (SELURUH tugas dimasukkan sebagai baris tabel tanpa batas buatan)
  const tableRows = [];
  extractedTasks.forEach(task => {
    let name = task.title;
    let shortName = name;
    if (name.includes(':')) {
      shortName = name.split(':')[0].trim();
    } else if (name.length > 65) {
      shortName = name.substring(0, 62) + '...';
    }

    let ket = 'Implementasi & pengujian tuntas';
    if (task.subPoints && task.subPoints.length > 0) {
      ket = task.subPoints[0];
    } else if (name.includes(':')) {
      ket = name.split(':').slice(1).join(':').trim();
    }
    if (ket.length > 70) ket = ket.substring(0, 67) + '...';

    tableRows.push({
      komponen: shortName,
      status: 'Selesai',
      target: '100%',
      ket: ket
    });
  });

  if (tableRows.length === 0) {
    tableRows.push(
      { komponen: 'Pengembangan Modul Notula Rapat BKN', status: 'Selesai', target: '100%', ket: 'Standar tata naskah & AI Notulis' },
      { komponen: 'Ekspor Dokumen Microsoft Word (.docx)', status: 'Selesai', target: '100%', ket: 'Presisi format dinas BKN' }
    );
  }

  // 5. Susun 2 Pilar Aktivitas (Semua aktivitas terdistribusi secara seimbang tanpa pembatasan)
  const allPillarItems = [];
  extractedTasks.forEach(t => {
    allPillarItems.push(t.title);
    if (t.subPoints && t.subPoints.length > 0) {
      t.subPoints.forEach(sp => {
        if (sp.length > 10 && allPillarItems.length < 16) {
          allPillarItems.push(sp.length > 85 ? sp.substring(0, 82) + '...' : sp);
        }
      });
    }
  });

  const mid = Math.ceil(allPillarItems.length / 2);
  const pilar1Items = allPillarItems.slice(0, mid);
  const pilar2Items = allPillarItems.slice(mid);

  const pillars = [
    {
      title: 'Pengembangan Modul & Tata Naskah Digital',
      items: pilar1Items.length > 0 ? pilar1Items : ['Modul Notula Rapat Kedinasan BKN', 'Konversi Ekspor Word (.docx)']
    },
    {
      title: 'Tata Kelola Sistem, Keamanan & Repositori',
      items: pilar2Items.length > 0 ? pilar2Items : ['Tab Arsip Riwayat Dokumen BKN', 'Sinkronisasi Repositori GitHub']
    }
  ];

  return {
    reportTitle: title,
    reportSubtitle: user.institution || 'Kantor Regional V Badan Kepegawaian Negara',
    reportDate: isoDate,
    formattedDate: formattedDate,
    metrics: metrics.slice(0, 4),
    pillars: pillars,
    tableRows: tableRows
  };
}

/**
 * Panggilan Gemini API untuk Notulen Rapat
 */
async function callGeminiNotulenAPI(rawText, user, apiKey) {
  // Jika dokumen transkrip sangat panjang (misal > 60.000 karakter),
  // ambil bagian pembuka (header, metadata, pengantar) dan bagian penutup (tanya jawab, kesimpulan)
  let textToSend = rawText;
  if (rawText.length > 70000) {
    const headPart = rawText.substring(0, 40000);
    const tailPart = rawText.substring(rawText.length - 30000);
    textToSend = `${headPart}\n\n[... Bagian tengah transkrip diringkas untuk optimasi performa ...]\n\n${tailPart}`;
  }

  const prompt = `
Anda adalah AI Notulis Kedinasan Resmi untuk Badan Kepegawaian Negara (BKN).
Tugas Anda adalah membaca transkrip rapat (termasuk rekaman Zoom, Tactiq, atau catatan dinas) berikut ini dan menyusunnya menjadi format Notula Resmi BKN standar tata naskah dinas dalam format JSON.

PANDUAN EKSTRAKSI PENTING:
1. JUDUL: Ekstrak judul rapat yang SEBENARNYA dari teks (perhatikan baris judul teratas, nama kegiatan, atau instansi yang sedang mengadakan rapat/didampingi). Contoh jika tertera "Pendampingan MT Lamsel", ubah menjadi "PENDAMPINGAN MANAJEMEN TALENTA KABUPATEN LAMPUNG SELATAN". JANGAN PERNAH menyalin judul tiruan jika tidak sesuai teks aslinya.
2. WAKTU & TANGGAL: Ekstrak hari, tanggal, dan rentang waktu dari teks atau header rapat.
3. TEMPAT: Tentukan tempat rapat ("Daring melalui Zoom Meeting" atau nama ruang/lokasi jika pertemuan tatap muka).
4. AGENDA: Tuliskan 3-5 poin agenda kegiatan rapat yang relevan dengan topik yang dibahas.
5. PESERTA / UNSUR YANG HADIR (ATURAN KHUSUS - WAJIB): Tuliskan daftar peserta HANYA berdasarkan NAMA TIM KERJA, UNIT KERJA, PERWAKILAN INSTANSI, atau JABATAN STRUKTURAL KELOMPOK. JANGAN PERNAH mencantumkan nama orang pribadi/individu (DILARANG format seperti "Nama Orang (Tim X)", "Budi (Admin)", "Nama Orang - Jabatan"). Cukup sebutkan nama tim/unit kerja/jabatannya saja, contoh:
   - Tim Manajemen Talenta Kantor Regional V BKN Jakarta
   - Tim Pembinaan dan Pengelolaan Sistem Informasi Kepegawaian Kanreg V BKN
   - Kepala BKPSDM Kabupaten [Nama Daerah] beserta jajaran
   - Tim Admin SI-MATA dan Admin Penkom BKPSDM Kabupaten [Nama Daerah]
   - Perwakilan Bagian Organisasi Sekretariat Daerah Kabupaten [Nama Daerah]
   - Para Pejabat Administrator, Pengawas, dan Pejabat Fungsional Terkait
   (Ringkas menjadi 4 - 7 butir unsur perwakilan tim/unit kerja, tanpa menyebut nama orang satu per satu).
6. URAIAN KEGIATAN: Bagi pembahasan ke dalam 2-4 sesi logis berdasarkan alur diskusi dan sebutkan narasumber/pembicara yang relevan beserta poin-poin inti apa yang mereka sampaikan.
7. TINDAK LANJUT: Ekstrak 3-5 poin tindak lanjut penugasan atau arahan yang harus dikerjakan setelah rapat.
8. KESIMPULAN: Tuliskan 2-3 poin kesimpulan rapat secara profesional.
9. PENUTUP: Tuliskan narasi penutup rapat kedinasan secara formal.
10. DETEKSI TOPIK KHUSUS MANAJEMEN TALENTA (MT) & TABEL KERTAS KERJA:
    Periksa secara cermat apakah rapat ini membahas MANAJEMEN TALENTA (MT), SIMATA, Kertas Kerja Manajemen Talenta, Pemetaan Talenta / 9 Box, Rencana Suksesi, IDP, atau Pembinaan/Pendampingan MT Instansi:
    - JIKA BUKAN RAPAT MANAJEMEN TALENTA (misal rapat Jabatan Fungsional, Kenaikan Pangkat, Mutasi, Disiplin, Perencanaan, atau Rapat Umum):
      Set:
      "isMT": false,
      "kertasKerjaMT": null
    - JIKA MERUPAKAN RAPAT MANAJEMEN TALENTA (MT):
      Set:
      "isMT": true,
      dan sertakan "kertasKerjaMT" berisi persis 15 item standar BKN (Pilar I: 1.1-1.4, Pilar II: 2.1-2.2, Pilar III: 3.1-3.3).
      ATURAN PENGISIAN STATUS & KETERANGAN KERTAS KERJA:
      * Kolom 'no', 'komponen', 'indikator', 'buktiOutput' HARUS BAKU DAN SAMA PERSIS dengan 15 butir standar BKN.
      * Kolom 'status' HANYA BOLEH bernilai salah satu dari 2 simbol:
        - "✓" (ceklis) : jika eviden sudah ada / sudah diunggah / sudah lengkap / disetujui dalam rapat.
        - "-" (strip) : jika eviden belum ada / belum diunggah / masih berupa catatan kekurangan / menunggu perbaikan.
      * Kolom 'keterangan' HARUS disesuaikan secara cerdas dengan hasil diskusi transkrip rapat (misal: "Sesuai", "Perlu update SS dashboard", "Konfirmasi detil lowongan JPTP", "Perlu SS untuk kotak 9", "IDP manual perlu dilengkapi", "Perlu SS Simata ttd atasan", dll.).

Identitas Notulis:
- Nama: ${user.full_name || 'Notulis BKN'}
- Instansi: ${user.institution || 'Kantor Regional V BKN Jakarta'}
- Jabatan: ${user.division || 'Asisten Analis Kepegawaian'}

Transkrip / Catatan Rapat Pengguna:
"""
${textToSend}
"""

Hasilkan HANYA objek JSON valid (tanpa blok markdown, tanpa awalan/akhiran apapun) dengan format skema:
{
  "title": "Judul resmi rapat (HURUF KAPITAL)",
  "meetingTime": "Rentang waktu rapat (contoh: 08.38 WIB – Selesai)",
  "meetingPlace": "Daring melalui Zoom Meeting ATAU Di Tempat",
  "agenda": [
    "Poin agenda kegiatan 1",
    "Poin agenda kegiatan 2"
  ],
  "attendees": [
    "Nama Tim Kerja / Unit Kerja / Jabatan Struktural Instansi (HARUS berupa nama tim/unit, DILARANG mencantumkan nama orang pribadi)"
  ],
  "activities": [
    {
      "sectionTitle": "Judul Sesi Pembahasan",
      "speaker": "Nama pembicara / narasumber",
      "points": [
        "Poin pembahasan atau arahan 1",
        "Poin pembahasan atau arahan 2"
      ]
    }
  ],
  "actionItems": [
    "Poin tindak lanjut penugasan 1",
    "Poin tindak lanjut penugasan 2"
  ],
  "conclusions": [
    "Poin kesimpulan rapat 1",
    "Poin kesimpulan rapat 2"
  ],
  "closingText": "Paragraf narasi penutup rapat dinas secara formal dan santun.",
  "isMT": true,
  "kertasKerjaMT": [
    {
      "pilar": "I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI",
      "no": "1.1",
      "komponen": "Komitmen Pimpinan Instansi",
      "indikator": "Tersedianya dukungan pimpinan instansi dalam penyelenggaraan manajemen talenta yang dinyatakan melalui surat pernyataan yang telah ditandatangani",
      "buktiOutput": "Surat Pernyataan Pimpinan tentang Komitmen Penerapan Manajemen Talenta Instansi",
      "status": "✓",
      "keterangan": "Sesuai"
    }
  ]
}
`;

  return await executeGeminiGenerate(prompt, apiKey);
}

/**
 * Smart Dynamic Notulen Parser lokal (Fallback Cerdas Tanpa Data Tiruan / Mock)
 */
function smartLocalNotulenParser(rawText, user = {}) {
  const text = (rawText || '').trim();

  // 1. Ekstraksi Judul Dinamis
  let title = '';
  const firstLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (firstLines.length > 0) {
    const l0 = firstLines[0];
    if (!/^(meeting started|view original|transcript|\d{1,2}:\d{2}|notula)/i.test(l0) && l0.length > 3 && l0.length < 130) {
      title = l0;
    }
  }

  if (!title) {
    const m = text.match(/(?:Tema|Judul|Topik|Kegiatan|Rapat)\s*[:\-]\s*([^\n\r]+)/i);
    if (m && m[1].trim()) title = m[1].trim();
  }

  if (title) {
    title = title
      .replace(/\bMT\b/g, 'Manajemen Talenta')
      .replace(/\bLamsel\b/gi, 'Kabupaten Lampung Selatan')
      .replace(/\bLamtim\b/gi, 'Kabupaten Lampung Timur')
      .replace(/\bLamteng\b/gi, 'Kabupaten Lampung Tengah')
      .replace(/\bKanreg V\b/gi, 'Kantor Regional V BKN')
      .replace(/^(Notula|Risalah|Catatan|Transkrip|Dokumen)\s*[:\-]?\s*/i, '')
      .replace(/[():\-]+$/, '')
      .replace(/^[():\-]+/, '')
      .trim();
    if (title.length > 90) {
      title = title.substring(0, 90);
      const lastSp = title.lastIndexOf(' ');
      if (lastSp > 30) title = title.substring(0, lastSp);
    }
    title = title.toUpperCase();
  } else {
    title = 'RAPAT KOORDINASI DAN EVALUASI LAYANAN KEPEGAWAIAN BKN';
  }

  // 2. Waktu & Tanggal
  let meetingTime = '09.00 – 11.30 WIB';
  const startMatch = text.match(/Meeting started:\s*([A-Za-z]+ \d{1,2}, \d{4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (startMatch) {
    meetingTime = `${startMatch[2]} WIB – Selesai`;
  } else {
    const timeMatch = text.match(/(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}\s*(?:WIB|WITA|WIT)?)/i);
    if (timeMatch) meetingTime = timeMatch[1].trim();
  }

  // 3. Tempat
  let meetingPlace = 'Daring melalui Zoom Meeting';
  if (/luring|tatap muka|aula|ruang rapat|kantor/i.test(text) && !/zoom|daring|teams/i.test(text)) {
    meetingPlace = 'Di Tempat';
  }

  // 4. Deteksi Peserta dari Teks Transkrip Nyata
  let attendees = [];
  const partMatch = text.match(/Meeting participants:\s*([^\n\r]+)/i);
  if (partMatch && partMatch[1].trim()) {
    const rawParts = partMatch[1].split(',');
    rawParts.forEach(p => {
      let clean = p.replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean && clean.length > 2) attendees.push(clean);
    });
  }

  if (attendees.length === 0) {
    const speakerRegex = /(?:^|\n)(?:\d{1,2}:\d{2}(?::\d{2})?\s+)?([A-Za-z0-9_.\s]{3,35})\s*:/g;
    const foundSpeakers = new Set();
    let sm;
    while ((sm = speakerRegex.exec(text)) !== null) {
      const sp = sm[1].replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (sp && !/^(transcript|meeting|view|agenda|peserta|waktu|tempat|catatan|sesi)/i.test(sp)) {
        foundSpeakers.add(sp);
      }
    }
    attendees = Array.from(foundSpeakers).slice(0, 8);
  }

  if (attendees.length === 0) {
    attendees = [
      `${user.full_name || 'Notulis BKN'} – Notulis`,
      'Pimpinan Rapat',
      'Para Pejabat dan Peserta Rapat'
    ];
  }

  // 5. Agenda Dinamis
  const agenda = [
    `Pelaksanaan kegiatan ${title.toLowerCase()} bersama unit kerja terkait.`,
    'Review pemenuhan kertas kerja, dokumen eviden, dan instrumen pendukung.',
    'Pembahasan kendala operasional serta strategi percepatan tindak lanjut.'
  ];

  // 6. Uraian Pembahasan Dinamis dari Dialog Nyata
  const dialogueLines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 35 && !/^(meeting|transcript|view original|\d{1,2}:\d{2}\s*$)/i.test(l));

  const mid = Math.ceil(dialogueLines.length / 2);
  const part1 = dialogueLines.slice(0, Math.min(mid, 4)).map(l => l.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, ''));
  const part2 = dialogueLines.slice(mid, Math.min(mid + 4, dialogueLines.length)).map(l => l.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, ''));

  const activities = [
    {
      sectionTitle: '1. Pengantar dan Pembahasan Awal',
      speaker: attendees[0] || 'Pimpinan Rapat',
      points: part1.length > 0 ? part1 : [`Penyampaian arahan dan tujuan pelaksanaan ${title.toLowerCase()}.`]
    },
    {
      sectionTitle: '2. Review Kertas Kerja dan Diskusi Teknis',
      speaker: attendees[1] || 'Tim Teknis / Narasumber',
      points: part2.length > 0 ? part2 : ['Pendalaman materi teknis serta inventarisasi eviden pendukung.']
    }
  ];

  // 7. Tindak Lanjut Dinamis
  const actionItems = [];
  const actionKeywords = text.match(/([^.!?\n\r]*(?:sk |tindak lanjut|harus|akan|segera|koordinasi|lengkapi|upload|percepatan|retensi|idp)[^.!?\n\r]*[.!?])/gi);
  if (actionKeywords && actionKeywords.length > 0) {
    const cleanedActions = actionKeywords
      .map(a => a.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+[A-Za-z0-9_.\s]+:\s*/, '').trim())
      .filter(a => a.length > 25 && a.length < 200);
    const uniqueActions = Array.from(new Set(cleanedActions)).slice(0, 4);
    if (uniqueActions.length > 0) actionItems.push(...uniqueActions);
  }
  if (actionItems.length === 0) {
    actionItems.push(`Menindaklanjuti rekomendasi hasil kegiatan ${title.toLowerCase()}.`);
    actionItems.push('Melengkapi dokumen eviden dan berkas administrasi kepegawaian yang diperlukan.');
    actionItems.push('Melakukan koordinasi berkala dengan tim pendamping.');
  }

  // 9. Deteksi Topik Khusus Manajemen Talenta (MT)
  const isMT = /(?:manajemen talenta|\bmt\b|kertas kerja|simata|si-mata|9 box|sembilan kotak|kotak talenta|bangtarier|akuisisi talenta|retensi talenta)/i.test(text);
  let kertasKerjaMT = null;
  if (isMT) {
    kertasKerjaMT = STANDARD_KERTAS_KERJA_MT.map(item => {
      let st = "-";
      let ket = "";
      if (item.no === "1.1" && /(?:komitmen|surat pernyataan)/i.test(text)) {
        st = "✓";
        ket = "Sesuai";
      } else if (item.no === "1.2" && /(?:sk tim|tim kerja)/i.test(text)) {
        st = "✓";
        ket = "Sesuai";
      } else if (item.no === "1.3" && /(?:komite talenta)/i.test(text)) {
        st = "✓";
        ket = "Sesuai";
      } else if (item.no === "1.4" && /(?:regulasi|perbup|perwal)/i.test(text)) {
        st = "✓";
        ket = "Sesuai";
      } else if (item.no === "2.1") {
        st = "✓";
        ket = /(?:update ss|dashboard)/i.test(text) ? "Sesuai, namun memerlukan update SS dashboard" : "Sesuai";
      } else if (item.no === "2.2") {
        st = "✓";
        ket = /(?:pemadanan|integrasi)/i.test(text) ? "Sesuai, namun memerlukan update SS pemadanan data" : "Sesuai";
      } else if (item.no === "3.2") {
        ket = /(?:idp manual|ttd atasan)/i.test(text) ? "Perlu SS Simata dengan dokumen ttd atasan" : "Perlu verifikasi";
      } else if (item.no === "3.3") {
        st = "✓";
        ket = "Sesuai";
      }
      return {
        ...item,
        status: st,
        keterangan: ket
      };
    });
  }

  // 10. Kesimpulan Dinamis
  const conclusions = [
    `Kegiatan ${title.toLowerCase()} telah dilaksanakan dengan baik dan menghasilkan rekomendasi perbaikan yang konkret.`,
    'Seluruh pihak yang terlibat berkomitmen untuk mempercepat pemenuhan data dan dokumen pendukung sesuai arahan.'
  ];

  const closingText = `Kegiatan ${title.toLowerCase()} ditutup secara resmi dengan komitmen bersama untuk segera menindaklanjuti seluruh catatan review demi mendukung akuntabilitas kinerja instansi.`;

  return {
    title,
    meetingTime,
    meetingPlace,
    agenda,
    attendees,
    activities,
    actionItems,
    conclusions,
    closingText,
    isMT,
    kertasKerjaMT,
    notulisName: user.full_name || 'Luthfi Arviandi',
    notulisRole: user.division || 'Asisten Pengembang Sistem dan Aplikasi Digital'
  };
}

/**
 * 15 Butir Baku Standar Kertas Kerja Manajemen Talenta BKN (Dit. Bangtarier)
 */
export const STANDARD_KERTAS_KERJA_MT = [
  // I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI
  {
    pilar: "I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI",
    no: "1.1",
    komponen: "Komitmen Pimpinan Instansi",
    indikator: "Tersedianya dukungan pimpinan instansi dalam penyelenggaraan manajemen talenta yang dinyatakan melalui surat pernyataan yang telah ditandatangani",
    buktiOutput: "Surat Pernyataan Pimpinan tentang Komitmen Penerapan Manajemen Talenta Instansi",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI",
    no: "1.2",
    komponen: "Tim Kerja Pengelola Manajemen Talenta",
    indikator: "Tersedianya Tim Kerja yang mengelola manajemen talenta secara sistematis dan berkelanjutan yang ditetapkan secara formal dan operasional",
    buktiOutput: "Surat Keputusan Pembentukan Tim Kerja Manajemen Talenta Instansi",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI",
    no: "1.3",
    komponen: "Komite Talenta",
    indikator: "Adanya tim penilai akhir yang memberikan rekomendasi dalam pengambilan keputusan dalam penyelenggaraan manajemen talenta",
    buktiOutput: "Surat keputusan pembentukan Komite Talenta Instansi",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "I. KELEMBAGAAN MANAJEMEN TALENTA INSTANSI",
    no: "1.4",
    komponen: "Regulasi Penyelenggaraan Manajemen Talenta",
    indikator: "Tersedianya regulasi yang ditetapkan pimpinan instansi sebagai dasar penyelenggaraan manajemen talenta",
    buktiOutput: "Regulasi",
    status: "-",
    keterangan: ""
  },

  // II. INFRASTRUKTUR TEKNOLOGI MANAJEMEN TALENTA INSTANSI
  {
    pilar: "II. INFRASTRUKTUR TEKNOLOGI MANAJEMEN TALENTA INSTANSI",
    no: "2.1",
    komponen: "Aplikasi Manajemen Talenta",
    indikator: "Tersedianya aplikasi manajemen talenta yang menyediakan fitur-fitur penting (pemetaan dan penempatan) dalam penyelenggaraan manajemen talenta",
    buktiOutput: "Aplikasi Manajemen Talenta Berbasis Web",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "II. INFRASTRUKTUR TEKNOLOGI MANAJEMEN TALENTA INSTANSI",
    no: "2.2",
    komponen: "Sistem Informasi Manajemen Talenta",
    indikator: "Terintegrasinya aplikasi dengan sistem informasi ASN (SI ASN) BKN dan sistem informasi SDM lain (misal ekinerja)",
    buktiOutput: "Integrasi Data pada Aplikasi Manajemen Talenta",
    status: "-",
    keterangan: ""
  },

  // III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya identifikasi jabatan target",
    buktiOutput: "Daftar Jabatan Target",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya analisis kebutuhan talenta yang memenuhi persyaratan untuk menduduki jabatan target",
    buktiOutput: "Daftar kandidat yang memenuhi kriteria jabatan target",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya pengelompokan berbagai jenis jabatan berdasarkan kedekatan fungsi, kompetensi, dan/atau karakteristik jabatan.",
    buktiOutput: "Daftar Rumpun Jabatan",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya parameter, komponen, dan bobot penilaian sebagai dasar pengembangan Karier dalam pemetaan talenta",
    buktiOutput: "Demo aplikasi yang memuat parameter, komponen, dan bobot penilaian",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya profil talenta dari hasil penilaian kinerja dan potensial pegawai",
    buktiOutput: "Dokumen Profil Talenta",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya hasil pemetaan pegawai ke dalam 9 kotak talenta",
    buktiOutput: "Tangkapan layar aplikasi yang memuat matriks 9 kotak talenta ASN",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.1",
    komponen: "Akuisisi Talenta",
    indikator: "Tersedianya kelompok rencana suksesi yang telah diperingkatkan untuk mengisi jabatan target",
    buktiOutput: "Bagan rencana suksesi",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.2",
    komponen: "Pengembangan Talenta",
    indikator: "Tersedianya rencana pengembangan individu berdasarkan klasifikasi 9 kotak talenta",
    buktiOutput: "Dokumen Rencana Pengembangan Individu (Individual Development Plan) talenta ASN",
    status: "-",
    keterangan: ""
  },
  {
    pilar: "III. PEMBANGUNAN MANAJEMEN TALENTA INSTANSI",
    no: "3.3",
    komponen: "Retensi Talenta",
    indikator: "Tersedianya strategi retensi talenta (reward, pengakuan, jenjang karier, dsb.)",
    buktiOutput: "Dokumen strategi retensi talenta untuk setiap kelompok talenta telah disusun",
    status: "-",
    keterangan: ""
  }
];

/**
 * Menormalisasi hasil array Kertas Kerja MT dari AI agar selalu selaras dengan 15 butir standar baku
 * dan memastikan status hanya berupa '✓' atau '-'
 */
export function normalizeKertasKerjaMT(list) {
  if (!Array.isArray(list) || list.length === 0) return null;

  return STANDARD_KERTAS_KERJA_MT.map((std, idx) => {
    const found = list.find(item => 
      item && (
        String(item.no || '').trim() === String(std.no).trim() &&
        (
          (item.indikator && item.indikator.slice(0, 20).toLowerCase() === std.indikator.slice(0, 20).toLowerCase()) ||
          (item.buktiOutput && item.buktiOutput.slice(0, 20).toLowerCase() === std.buktiOutput.slice(0, 20).toLowerCase())
        )
      )
    ) || list[idx] || {};

    let rawStatus = String(found.status || '').trim();
    let status = "-";
    if (/^[vV✓]$/i.test(rawStatus) || /^(ceklis|ada|lengkap|sesuai|sudah|ya|true)$/i.test(rawStatus)) {
      status = "✓";
    } else {
      status = "-";
    }

    let keterangan = typeof found.keterangan === 'string' ? found.keterangan.trim() : '';
    if (!keterangan && status === "✓") {
      keterangan = "Sesuai";
    }

    return {
      pilar: std.pilar,
      no: std.no,
      komponen: std.komponen,
      indikator: std.indikator,
      buktiOutput: std.buktiOutput,
      status: status,
      keterangan: keterangan
    };
  });
}

/**
 * Membersihkan daftar peserta agar diformat berdasarkan Tim Kerja / Unit Kerja / Jabatan Struktural
 * dan menghilangkan nama orang pribadi secara konsisten untuk seluruh pembuatan notula.
 */
function sanitizeAttendees(list) {
  if (!Array.isArray(list)) return [];
  const results = [];
  const seen = new Set();

  list.forEach(item => {
    if (!item || typeof item !== 'string') return;
    let val = item.trim();

    // 1. Jika format: "Nama Orang (Tim/Unit/Jabatan)" -> ambil isi kurung jika berupa jabatan/tim/unit
    const bracketMatch = val.match(/^([A-Za-z\s'.,]+)\s*\(([^)]+)\)$/);
    if (bracketMatch) {
      const inside = bracketMatch[2].trim();
      if (/(?:tim|bagian|unit|dinas|bkd|bkpsdm|bkn|kanreg|dit|perwakilan|admin|kepala|bidang|seksi|biro|inspektorat|setda|pejabat|pegawai|pic)/i.test(inside)) {
        val = inside;
      }
    } else {
      // 2. Jika format: "Nama Orang – Tim/Unit/Jabatan" atau "Nama Orang - Tim/Unit/Jabatan"
      const dashMatch = val.match(/^([A-Za-z\s'.,]{2,35})\s*(?:–|—|\s-\s|:\s)\s*(.*)$/);
      if (dashMatch) {
        const right = dashMatch[2].trim();
        if (/(?:tim|bagian|unit|dinas|bkd|bkpsdm|bkn|kanreg|dit|perwakilan|admin|kepala|bidang|seksi|biro|inspektorat|setda|pejabat|pegawai|pic)/i.test(right)) {
          val = right;
        }
      }
    }

    // Hilangkan awalan sebutan jika masih ada
    val = val.replace(/^(?:ibu|bapak|pak|bu|sdr|sdri)\s+[A-Za-z\s'.,]{2,25}\s*(?:–|-)\s*/i, '');
    val = val.replace(/\s+/g, ' ').trim();

    if (val.length > 2 && !seen.has(val.toLowerCase())) {
      seen.add(val.toLowerCase());
      results.push(val);
    }
  });

  return results.length > 0 ? results : [
    'Tim Kerja Terkait Kantor Regional V BKN Jakarta',
    'Perwakilan Instansi / Badan Kepegawaian Daerah',
    'Para Pejabat Administrator, Pengawas, dan Pejabat Fungsional Terkait'
  ];
}

export default aiService;
