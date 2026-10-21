/**
 * NOTULEN.JS - LOGIKA REAKTIF & GENERATOR NOTULA BKN
 */

// Default initial structure
const defaultNotulenState = {
  id: null,
  meetingId: null,
  title: '',
  meetingDate: new Date().toISOString().split('T')[0],
  formattedDate: '',
  meetingTime: '09.00 – 11.30 WIB',
  meetingPlace: 'Daring melalui Zoom Meeting',
  agenda: [],
  attendees: [],
  activities: [],
  actionItems: [],
  conclusions: [],
  closingText: '',
  notulisName: '',
  notulisNip: '',
  notulisRole: '',
  documentationPhotos: [],
  isMT: false,
  kertasKerjaMT: null
};

// 15 Butir Baku Standar Kertas Kerja Manajemen Talenta BKN (Dit. Bangtarier)
const STANDARD_KERTAS_KERJA_MT = [
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

const rawInit = window.initialNotulenData || {};
const initIsMt = Boolean(rawInit.isMt || (rawInit.kertasKerjaMt && rawInit.kertasKerjaMt.length > 0));

let notulenState = {
  ...defaultNotulenState,
  ...rawInit,
  agenda: Array.isArray(rawInit.agenda) ? [...rawInit.agenda] : [],
  attendees: Array.isArray(rawInit.attendees) ? [...rawInit.attendees] : [],
  activities: Array.isArray(rawInit.activities) ? JSON.parse(JSON.stringify(rawInit.activities)) : [],
  actionItems: Array.isArray(rawInit.actionItems) ? [...rawInit.actionItems] : [],
  conclusions: Array.isArray(rawInit.conclusions) ? [...rawInit.conclusions] : [],
  documentationPhotos: Array.isArray(rawInit.documentationPhotos) ? [...rawInit.documentationPhotos] : [],
  isMT: initIsMt,
  kertasKerjaMT: Array.isArray(rawInit.kertasKerjaMt) && rawInit.kertasKerjaMt.length > 0
    ? JSON.parse(JSON.stringify(rawInit.kertasKerjaMt))
    : (initIsMt ? JSON.parse(JSON.stringify(STANDARD_KERTAS_KERJA_MT)) : null)
};

if (rawInit.title) notulenState.title = rawInit.title;
if (rawInit.meetingDate) notulenState.meetingDate = rawInit.meetingDate;
if (rawInit.formattedDate) notulenState.formattedDate = rawInit.formattedDate;
if (rawInit.meetingTime) notulenState.meetingTime = rawInit.meetingTime;
if (rawInit.meetingPlace) notulenState.meetingPlace = rawInit.meetingPlace;
if (rawInit.closingText) notulenState.closingText = rawInit.closingText;
if (rawInit.notulisName) notulenState.notulisName = rawInit.notulisName;
if (rawInit.notulisNip || rawInit.notulis_nip) notulenState.notulisNip = rawInit.notulisNip || rawInit.notulis_nip;
else if (window.currentUserNip) notulenState.notulisNip = window.currentUserNip;
if (rawInit.notulisRole) notulenState.notulisRole = rawInit.notulisRole;

if (window.selectedMeetingId) {
  notulenState.meetingId = window.selectedMeetingId;
}

document.addEventListener('DOMContentLoaded', () => {
  initFormValues();
  renderDynamicLists();
  renderDocumentationPhotos();
  updateLivePreview();
  setupEventListeners();
});

function initFormValues() {
  const fTitle = document.getElementById('notulaTitle');
  const fDate = document.getElementById('notulaDate');
  const fTime = document.getElementById('notulaTime');
  const fPlace = document.getElementById('notulaPlace');
  const fCustomPlace = document.getElementById('notulaCustomPlace');
  const fClosing = document.getElementById('notulaClosing');
  const fNotulisName = document.getElementById('notulisName');
  const fNotulisNip = document.getElementById('notulisNip');
  const fNotulisRole = document.getElementById('notulisRole');
  const fMeeting = document.getElementById('selectMeetingId');

  if (fMeeting) {
    if (notulenState.meetingId) {
      fMeeting.value = String(notulenState.meetingId);
    } else if (fMeeting.value) {
      notulenState.meetingId = parseInt(fMeeting.value, 10);
    }
  }
  if (fTitle) fTitle.value = notulenState.title || '';
  if (fDate) fDate.value = notulenState.meetingDate || '';
  if (fTime) fTime.value = notulenState.meetingTime || '';
  if (fClosing) fClosing.value = notulenState.closingText || '';
  if (fNotulisName) fNotulisName.value = notulenState.notulisName || '';
  if (fNotulisNip) fNotulisNip.value = notulenState.notulisNip || '';
  if (fNotulisRole) fNotulisRole.value = notulenState.notulisRole || '';

  // Setup Tempat Dropdown
  if (fPlace) {
    if (notulenState.meetingPlace === 'Daring melalui Zoom Meeting') {
      fPlace.value = 'Daring melalui Zoom Meeting';
    } else if (notulenState.meetingPlace === 'Di Tempat') {
      fPlace.value = 'Di Tempat';
    } else {
      fPlace.value = 'custom';
      if (fCustomPlace) {
        fCustomPlace.style.display = 'block';
        fCustomPlace.value = notulenState.meetingPlace;
      }
    }
  }

  // Setup Toggle Kertas Kerja MT
  const toggleMt = document.getElementById('toggleKertasKerjaMt');
  const bodyMt = document.getElementById('kertasKerjaMtBody');
  if (toggleMt) {
    toggleMt.checked = Boolean(notulenState.isMT);
    if (bodyMt) bodyMt.style.display = notulenState.isMT ? 'block' : 'none';
  }
}

function setupEventListeners() {
  // Listener Toggle Kertas Kerja MT
  const toggleMt = document.getElementById('toggleKertasKerjaMt');
  const bodyMt = document.getElementById('kertasKerjaMtBody');
  if (toggleMt) {
    toggleMt.addEventListener('change', (e) => {
      notulenState.isMT = e.target.checked;
      if (e.target.checked) {
        if (!notulenState.kertasKerjaMT || notulenState.kertasKerjaMT.length === 0) {
          notulenState.kertasKerjaMT = JSON.parse(JSON.stringify(STANDARD_KERTAS_KERJA_MT));
        }
        if (bodyMt) bodyMt.style.display = 'block';
        renderKertasKerjaMtEditor();
      } else {
        if (bodyMt) bodyMt.style.display = 'none';
      }
      updateLivePreview();
    });
  }

  // Pilihan Link ke Manajemen Meeting
  const fMeeting = document.getElementById('selectMeetingId');
  if (fMeeting) {
    fMeeting.addEventListener('change', (e) => {
      const chosenId = e.target.value ? parseInt(e.target.value, 10) : null;
      notulenState.meetingId = chosenId;

      if (chosenId && Array.isArray(window.availableMeetings)) {
        const found = window.availableMeetings.find(m => String(m.meeting_id) === String(chosenId));
        if (found) {
          const fTitle = document.getElementById('notulaTitle');
          if (fTitle && (!notulenState.title || !window.isEditingNotulen)) {
            fTitle.value = found.meeting_nama;
            notulenState.title = found.meeting_nama;
          }
          if (found.tanggal) {
            const tglStr = typeof found.tanggal === 'string' 
              ? found.tanggal.split('T')[0] 
              : (found.tanggal.toISOString ? found.tanggal.toISOString().split('T')[0] : '');
            if (tglStr) {
              const fDate = document.getElementById('notulaDate');
              if (fDate) fDate.value = tglStr;
              notulenState.meetingDate = tglStr;
              formatIndonesianDate(tglStr);
            }
          }
          if (found.tipe_meeting && (found.tipe_meeting.toLowerCase().includes('zoom') || found.tipe_meeting.toLowerCase().includes('webinar'))) {
            const fPlace = document.getElementById('notulaPlace');
            if (fPlace) {
              fPlace.value = 'Daring melalui Zoom Meeting';
              notulenState.meetingPlace = 'Daring melalui Zoom Meeting';
            }
          }
          updateLivePreview();
          showNotificationToast(`🔗 Terhubung ke rapat: ${found.meeting_nama}`);
        }
      } else {
        showNotificationToast('Mode notula mandiri aktif.');
      }
    });
  }

  // Input teks dasar
  const fTitle = document.getElementById('notulaTitle');
  if (fTitle) {
    fTitle.addEventListener('input', (e) => {
      notulenState.title = e.target.value;
      updateLivePreview();
    });
  }

  const fDate = document.getElementById('notulaDate');
  if (fDate) {
    fDate.addEventListener('change', (e) => {
      notulenState.meetingDate = e.target.value;
      formatIndonesianDate(e.target.value);
      updateLivePreview();
    });
  }

  const fTime = document.getElementById('notulaTime');
  if (fTime) {
    fTime.addEventListener('input', (e) => {
      notulenState.meetingTime = e.target.value;
      updateLivePreview();
    });
  }

  const fPlace = document.getElementById('notulaPlace');
  const fCustomPlace = document.getElementById('notulaCustomPlace');
  if (fPlace) {
    fPlace.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        if (fCustomPlace) {
          fCustomPlace.style.display = 'block';
          notulenState.meetingPlace = fCustomPlace.value || 'Di Tempat';
        }
      } else {
        if (fCustomPlace) fCustomPlace.style.display = 'none';
        notulenState.meetingPlace = e.target.value;
      }
      updateLivePreview();
    });
  }

  if (fCustomPlace) {
    fCustomPlace.addEventListener('input', (e) => {
      notulenState.meetingPlace = e.target.value;
      updateLivePreview();
    });
  }

  const fClosing = document.getElementById('notulaClosing');
  if (fClosing) {
    fClosing.addEventListener('input', (e) => {
      notulenState.closingText = e.target.value;
      updateLivePreview();
    });
  }

  const fNotulisName = document.getElementById('notulisName');
  if (fNotulisName) {
    fNotulisName.addEventListener('input', (e) => {
      notulenState.notulisName = e.target.value;
      updateLivePreview();
    });
  }

  const fNotulisNip = document.getElementById('notulisNip');
  if (fNotulisNip) {
    fNotulisNip.addEventListener('input', (e) => {
      notulenState.notulisNip = e.target.value;
      updateLivePreview();
    });
  }

  const fNotulisRole = document.getElementById('notulisRole');
  if (fNotulisRole) {
    fNotulisRole.addEventListener('input', (e) => {
      notulenState.notulisRole = e.target.value;
      updateLivePreview();
    });
  }

  // File transkrip upload (.docx, .pdf, .txt, .md)
  const fileTranscriptInput = document.getElementById('transcriptFileInput');
  if (fileTranscriptInput) {
    fileTranscriptInput.addEventListener('change', handleTranscriptFileUpload);
  }

  // Foto Dokumentasi Kegiatan upload
  const fileDocPhotoInput = document.getElementById('documentationFileInput');
  if (fileDocPhotoInput) {
    fileDocPhotoInput.addEventListener('change', handleDocumentationPhotoUpload);
  }

  // Tombol AI Generate
  const btnAi = document.getElementById('btnAiProcess');
  if (btnAi) {
    btnAi.addEventListener('click', handleAiGenerate);
  }

  // Tombol Simpan
  const btnSave = document.getElementById('btnSaveNotulen');
  if (btnSave) {
    btnSave.addEventListener('click', handleSaveNotulen);
  }

  // Tombol Export Docx
  const btnDocx = document.getElementById('btnExportDocx');
  if (btnDocx) {
    btnDocx.addEventListener('click', handleExportDocx);
  }

  // Tombol Cetak / PDF
  const btnPrint = document.getElementById('btnPrintNotulen');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
}

function formatIndonesianDate(isoStr) {
  if (!isoStr) return;
  const d = new Date(isoStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  notulenState.formattedDate = d.toLocaleDateString('id-ID', options);
}

// Render Form Lists & Live Preview
function renderDynamicLists() {
  renderListEditor('agendaContainer', notulenState.agenda, 'agenda');
  renderListEditor('attendeesContainer', notulenState.attendees, 'attendees');
  renderActivitiesEditor();
  renderKertasKerjaMtEditor();
  renderListEditor('actionItemsContainer', notulenState.actionItems, 'actionItems');
  renderListEditor('conclusionsContainer', notulenState.conclusions, 'conclusions');
}

// Editor Kertas Kerja Manajemen Talenta
function renderKertasKerjaMtEditor() {
  const container = document.getElementById('kertasKerjaMtContainer');
  if (!container) return;
  if (!notulenState.isMT || !Array.isArray(notulenState.kertasKerjaMT)) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.775rem; background: #ffffff; border: 1px solid #CBD5E1; border-radius: 4px;">
      <thead>
        <tr style="background: #0A2540; color: #ffffff; text-align: left;">
          <th style="padding: 6px; width: 35px; text-align: center;">No</th>
          <th style="padding: 6px; width: 130px;">Komponen</th>
          <th style="padding: 6px;">Indikator Penilaian & Bukti Output</th>
          <th style="padding: 6px; width: 85px; text-align: center;">Status</th>
          <th style="padding: 6px; width: 180px;">Keterangan Rapat</th>
        </tr>
      </thead>
      <tbody>
  `;

  let currPilar = '';
  notulenState.kertasKerjaMT.forEach((row, idx) => {
    if (row.pilar && row.pilar !== currPilar) {
      currPilar = row.pilar;
      html += `
        <tr style="background: #FEF3C7; color: #92400E; font-weight: bold; border-top: 1px solid #FCD34D;">
          <td colspan="5" style="padding: 6px 8px; font-size: 0.75rem;">${escapeHtml(row.pilar)}</td>
        </tr>
      `;
    }

    const isCeklis = row.status === '✓';
    html += `
      <tr style="border-bottom: 1px solid #E2E8F0; vertical-align: top;">
        <td style="padding: 6px 4px; text-align: center; font-weight: 600; color: #64748B;">${escapeHtml(row.no || '-')}</td>
        <td style="padding: 6px; font-weight: 600; color: #0A2540;">${escapeHtml(row.komponen || '-')}</td>
        <td style="padding: 6px; color: #334155;">
          <div style="font-size: 0.75rem;">${escapeHtml(row.indikator || '-')}</div>
          <div style="font-size: 0.7rem; color: #64748B; margin-top: 2px;">📁 <em>${escapeHtml(row.buktiOutput || '-')}</em></div>
        </td>
        <td style="padding: 6px 4px; text-align: center;">
          <select class="form-input" style="padding: 3px 6px; font-size: 0.825rem; font-weight: bold; width: 72px; text-align: center; cursor: pointer; color: ${isCeklis ? '#059669' : '#DC2626'};" onchange="updateKertasKerjaStatus(${idx}, this.value)">
            <option value="✓" ${isCeklis ? 'selected' : ''}>✓ (Ada)</option>
            <option value="-" ${!isCeklis ? 'selected' : ''}>- (Belum)</option>
          </select>
        </td>
        <td style="padding: 6px;">
          <textarea class="form-input" style="min-height: 44px; font-size: 0.75rem; padding: 4px;" placeholder="Keterangan hasil rapat..." oninput="updateKertasKerjaKet(${idx}, this.value)">${escapeHtml(row.keterangan || '')}</textarea>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

window.updateKertasKerjaStatus = function(idx, val) {
  if (notulenState.kertasKerjaMT && notulenState.kertasKerjaMT[idx]) {
    notulenState.kertasKerjaMT[idx].status = (val === '✓') ? '✓' : '-';
    renderKertasKerjaMtEditor();
    updateLivePreview();
  }
};

window.updateKertasKerjaKet = function(idx, val) {
  if (notulenState.kertasKerjaMT && notulenState.kertasKerjaMT[idx]) {
    notulenState.kertasKerjaMT[idx].keterangan = val;
    updateLivePreview();
  }
};

function renderListEditor(containerId, listArray, stateKey) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  listArray.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'dynamic-list-row';
    row.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: flex-start;';

    row.innerHTML = `
      <span style="font-size: 0.75rem; color: #64748B; padding-top: 0.5rem; width: 18px;">${index + 1}.</span>
      <textarea class="form-input" style="flex: 1; min-height: 48px; font-size: 0.825rem;" data-index="${index}">${item}</textarea>
      <button type="button" class="btn btn-secondary btn-sm" style="color: #EF4444; padding: 0.4rem 0.6rem;" onclick="removeListItem('${stateKey}', ${index})">✕</button>
    `;

    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', (e) => {
      notulenState[stateKey][index] = e.target.value;
      updateLivePreview();
    });

    container.appendChild(row);
  });
}

function addListItem(stateKey) {
  if (!notulenState[stateKey]) notulenState[stateKey] = [];
  notulenState[stateKey].push('');
  renderDynamicLists();
  updateLivePreview();
}

function removeListItem(stateKey, index) {
  if (notulenState[stateKey]) {
    notulenState[stateKey].splice(index, 1);
    renderDynamicLists();
    updateLivePreview();
  }
}

// Editor Uraian Kegiatan (Hierarkis / Subseksi)
function renderActivitiesEditor() {
  const container = document.getElementById('activitiesContainer');
  if (!container) return;
  container.innerHTML = '';

  notulenState.activities.forEach((act, actIndex) => {
    const actCard = document.createElement('div');
    actCard.style.cssText = 'background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0.5rem; padding: 0.85rem; margin-bottom: 0.85rem;';

    let pointsHtml = '';
    (act.points || []).forEach((pt, ptIndex) => {
      pointsHtml += `
        <div style="display: flex; gap: 0.4rem; margin-bottom: 0.4rem;">
          <span style="font-size: 0.75rem; color: #94A3B8; padding-top: 0.4rem;">•</span>
          <textarea class="form-input" style="flex: 1; min-height: 42px; font-size: 0.8rem;" oninput="updateActivityPoint(${actIndex}, ${ptIndex}, this.value)">${pt}</textarea>
          <button type="button" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 0.8rem;" onclick="removeActivityPoint(${actIndex}, ${ptIndex})">✕</button>
        </div>
      `;
    });

    actCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: #0A2540;">Sesi ${actIndex + 1}</span>
        <button type="button" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 0.75rem;" onclick="removeActivitySection(${actIndex})">Hapus Sesi</button>
      </div>
      <input type="text" class="form-input" style="font-size: 0.825rem; font-weight: 600; margin-bottom: 0.5rem;" value="${escapeHtml(act.sectionTitle || '')}" placeholder="Judul Sesi / Paparan" oninput="updateActivityTitle(${actIndex}, this.value)">
      <div style="font-size: 0.725rem; font-weight: 600; color: #64748B; margin-bottom: 0.35rem;">Poin-Poin Pembahasan:</div>
      <div>${pointsHtml}</div>
      <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.725rem; padding: 0.25rem 0.6rem; margin-top: 0.25rem;" onclick="addActivityPoint(${actIndex})">+ Tambah Poin Poin</button>
    `;

    container.appendChild(actCard);
  });
}

function addActivitySection() {
  if (!notulenState.activities) notulenState.activities = [];
  notulenState.activities.push({
    sectionTitle: `${notulenState.activities.length + 1}. Pembahasan Baru`,
    points: ['Poin catatan pembahasan']
  });
  renderActivitiesEditor();
  updateLivePreview();
}

function removeActivitySection(index) {
  notulenState.activities.splice(index, 1);
  renderActivitiesEditor();
  updateLivePreview();
}

function updateActivityTitle(actIndex, val) {
  notulenState.activities[actIndex].sectionTitle = val;
  updateLivePreview();
}

function updateActivityPoint(actIndex, ptIndex, val) {
  notulenState.activities[actIndex].points[ptIndex] = val;
  updateLivePreview();
}

function addActivityPoint(actIndex) {
  if (!notulenState.activities[actIndex].points) notulenState.activities[actIndex].points = [];
  notulenState.activities[actIndex].points.push('');
  renderActivitiesEditor();
  updateLivePreview();
}

function removeActivityPoint(actIndex, ptIndex) {
  notulenState.activities[actIndex].points.splice(ptIndex, 1);
  renderActivitiesEditor();
  updateLivePreview();
}

// Bukti Giat / Dokumentasi Photos Editor
function renderDocumentationPhotos() {
  const container = document.getElementById('documentationPhotosContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!notulenState.documentationPhotos || notulenState.documentationPhotos.length === 0) {
    container.innerHTML = `
      <div style="padding: 1rem; border: 1px dashed #CBD5E1; border-radius: 0.5rem; text-align: center; color: #94A3B8; font-size: 0.775rem;">
        Belum ada foto dokumentasi. Klik "+ Unggah Foto" di atas untuk menambahkan bukti kegiatan.
      </div>
    `;
    return;
  }

  notulenState.documentationPhotos.forEach((photo, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; gap: 0.75rem; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0.5rem; padding: 0.5rem;';

    item.innerHTML = `
      <img src="${photo.url || photo.dataUrl || photo.previewUrl || ''}" alt="Foto" style="width: 56px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #CBD5E1;">
      <div style="flex: 1;">
        <input type="text" class="form-input" style="font-size: 0.775rem; padding: 0.35rem 0.5rem;" value="${escapeHtml(photo.caption || '')}" placeholder="Keterangan / Kepsen Foto" oninput="updatePhotoCaption(${idx}, this.value)">
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="color: #EF4444; padding: 0.35rem 0.55rem;" onclick="removeDocumentationPhoto(${idx})" title="Hapus Foto">✕</button>
    `;

    container.appendChild(item);
  });
}

function updatePhotoCaption(idx, val) {
  if (notulenState.documentationPhotos[idx]) {
    notulenState.documentationPhotos[idx].caption = val;
    updateLivePreview();
  }
}

function removeDocumentationPhoto(idx) {
  if (notulenState.documentationPhotos) {
    notulenState.documentationPhotos.splice(idx, 1);
    renderDocumentationPhotos();
    updateLivePreview();
  }
}

// Upload Bukti Kegiatan Handler
async function handleDocumentationPhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    showNotificationToast('⏳ Mengunggah foto dokumentasi...');
    const res = await fetch('/api/upload-evidence', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      notulenState.documentationPhotos.push({
        url: data.url,
        caption: `Dokumentasi Rapat: ${cleanName}`
      });
      renderDocumentationPhotos();
      updateLivePreview();
      showNotificationToast('✅ Foto berhasil ditambahkan ke bukti kegiatan!');
    } else {
      alert('Gagal mengunggah foto: ' + data.message);
    }
  } catch (err) {
    console.error('Upload photo error:', err);
    alert('Terjadi kesalahan jaringan saat upload foto.');
  } finally {
    e.target.value = '';
  }
}

// Upload File Transkrip Handler (.docx, .pdf, .txt, .md)
async function handleTranscriptFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusText = document.getElementById('transcriptFileStatusText');
  const origText = statusText ? statusText.textContent : 'Pilih File';
  if (statusText) statusText.textContent = 'Membaca...';

  const formData = new FormData();
  formData.append('file', file);

  try {
    showNotificationToast('⏳ Mengekstrak teks dari file transkrip...');
    const res = await fetch('/api/notulen/parse-transcript-file', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.text) {
      const input = document.getElementById('aiTranscriptInput');
      if (input) {
        input.value = data.text;
      }
      showNotificationToast(`📄 File "${file.name}" berhasil diunggah! Sedang mengekstrak notulen dengan AI...`);
      // Otomatis jalankan pemrosesan AI agar data langsung terisi di formulir & pratinjau
      await handleAiGenerate();
    } else {
      alert('Gagal membaca file: ' + (data.message || 'Format tidak didukung'));
    }
  } catch (err) {
    console.error('Transcript parse error:', err);
    alert('Terjadi kesalahan membaca file dokumen transkrip.');
  } finally {
    if (statusText) statusText.textContent = origText;
    e.target.value = '';
  }
}

// Update Live Preview (Realtime BKN Paper)
function updateLivePreview() {
  // Judul
  const pTitle = document.getElementById('previewTitle');
  const rTitle = document.getElementById('runningTitle');
  const titleText = notulenState.title || 'BKN MENYAPA ASN';
  if (pTitle) pTitle.textContent = `(${titleText})`;
  if (rTitle) rTitle.textContent = `Notula ${titleText}`;

  // Waktu & Tanggal
  const pDateTime = document.getElementById('previewDateTime');
  const dateFormatted = notulenState.formattedDate || window.todayFormattedString || 'Kamis, 10 September 2026';
  const timeFormatted = notulenState.meetingTime || '09.00 – 11.30 WIB';
  if (pDateTime) pDateTime.textContent = `${dateFormatted}, Waktu: ${timeFormatted}`;

  // Tempat
  const pPlace = document.getElementById('previewPlace');
  if (pPlace) pPlace.textContent = `Tempat: ${notulenState.meetingPlace || 'Daring melalui Zoom Meeting'}`;

  // Agenda
  const pAgenda = document.getElementById('previewAgendaList');
  if (pAgenda) {
    pAgenda.innerHTML = (notulenState.agenda || []).map(a => a ? `<li>${escapeHtml(a)}</li>` : '').join('');
  }

  // Peserta
  const pAttendees = document.getElementById('previewAttendeesList');
  if (pAttendees) {
    pAttendees.innerHTML = (notulenState.attendees || []).map(att => att ? `<li>${escapeHtml(att)}</li>` : '').join('');
  }

  // Uraian Kegiatan
  const pActivities = document.getElementById('previewActivitiesContainer');
  if (pActivities) {
    let actHtml = '';
    (notulenState.activities || []).forEach(act => {
      actHtml += `
        <div style="margin-bottom: 1.25rem;">
          <div class="notula-subsection-title">${escapeHtml(act.sectionTitle || '')}</div>
          <ul class="notula-list">
            ${(act.points || []).map(pt => pt ? `<li>${escapeHtml(pt)}</li>` : '').join('')}
          </ul>
        </div>
      `;
    });
    pActivities.innerHTML = actHtml;
  }

  // Khusus Rapat MT: Render Live Preview Tabel Kertas Kerja
  const pMtSection = document.getElementById('previewKertasKerjaMtSection');
  const pMtBody = document.getElementById('previewKertasKerjaMtBody');
  if (pMtSection && pMtBody) {
    if (notulenState.isMT && Array.isArray(notulenState.kertasKerjaMT) && notulenState.kertasKerjaMT.length > 0) {
      pMtSection.style.display = 'block';
      let previewRows = '';
      let currP = '';
      notulenState.kertasKerjaMT.forEach(row => {
        if (row.pilar && row.pilar !== currP) {
          currP = row.pilar;
          previewRows += `
            <tr style="background-color: #FDE8D7; font-weight: bold; border: 1px solid #000;">
              <td colspan="6" style="padding: 6px 8px; border: 1px solid #000; font-weight: bold; font-size: 9.5pt;">${escapeHtml(row.pilar)}</td>
            </tr>
          `;
        }
        previewRows += `
          <tr style="border: 1px solid #000;">
            <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; vertical-align: top; font-size: 9.5pt;">${escapeHtml(row.no || '-')}</td>
            <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt; font-weight: 500;">${escapeHtml(row.komponen || '-')}</td>
            <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${escapeHtml(row.indikator || '-')}</td>
            <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${escapeHtml(row.buktiOutput || '-')}</td>
            <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; vertical-align: top; font-size: 11pt; font-weight: bold;">${row.status === '✓' ? '✓' : '-'}</td>
            <td style="border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 9.5pt;">${escapeHtml(row.keterangan || '-')}</td>
          </tr>
        `;
      });
      pMtBody.innerHTML = previewRows;
    } else {
      pMtSection.style.display = 'none';
      pMtBody.innerHTML = '';
    }
  }

  // Pokok Tindak Lanjut
  const pAction = document.getElementById('previewActionList');
  if (pAction) {
    pAction.innerHTML = (notulenState.actionItems || []).map(act => act ? `<li>${escapeHtml(act)}</li>` : '').join('');
  }

  // Kesimpulan
  const pConclusions = document.getElementById('previewConclusionsList');
  if (pConclusions) {
    pConclusions.innerHTML = (notulenState.conclusions || []).map(c => c ? `<li>${escapeHtml(c)}</li>` : '').join('');
  }

  // Penutup
  const pClosing = document.getElementById('previewClosing');
  if (pClosing) {
    pClosing.textContent = notulenState.closingText || '';
  }

  // Bukti Giat / Dokumentasi Kegiatan (DIBAWAH PENUTUP & DIATAS TANDA TANGAN)
  const pEvidenceSection = document.getElementById('previewEvidenceSection');
  const pEvidenceGrid = document.getElementById('previewEvidenceGrid');
  if (pEvidenceSection && pEvidenceGrid) {
    if (notulenState.documentationPhotos && notulenState.documentationPhotos.length > 0) {
      pEvidenceSection.style.display = 'block';
      let gridHtml = '';
      notulenState.documentationPhotos.forEach(photo => {
        gridHtml += `
          <div style="border: 1px solid #CBD5E1; border-radius: 4px; padding: 6px; background: #fafafa; text-align: center;">
            <img src="${photo.url || photo.dataUrl || photo.previewUrl || ''}" alt="${escapeHtml(photo.caption || 'Bukti Kegiatan')}" style="max-height: 180px; width: 100%; object-fit: cover; border-radius: 2px;">
            ${photo.caption ? `<div style="font-size: 8.5pt; color: #475569; margin-top: 4px; font-style: italic;">${escapeHtml(photo.caption)}</div>` : ''}
          </div>
        `;
      });
      pEvidenceGrid.innerHTML = gridHtml;
    } else {
      pEvidenceSection.style.display = 'none';
      pEvidenceGrid.innerHTML = '';
    }
  }

  // Tanda Tangan
  const pSigDate = document.getElementById('previewSigDate');
  if (pSigDate) {
    pSigDate.textContent = `Jakarta, ${extractDateOnly(dateFormatted)}`;
  }

  const pSigName = document.getElementById('previewSigName');
  if (pSigName) pSigName.textContent = notulenState.notulisName || 'Rizky Chandra Satria';

  const pSigNip = document.getElementById('previewSigNip');
  if (pSigNip) {
    const nipVal = (notulenState.notulisNip || '').trim();
    if (nipVal) {
      pSigNip.textContent = nipVal.startsWith('NIP') ? nipVal : `NIP. ${nipVal}`;
      pSigNip.style.display = 'block';
    } else {
      pSigNip.textContent = '';
      pSigNip.style.display = 'none';
    }
  }

  const pSigRole = document.getElementById('previewSigRole');
  if (pSigRole) pSigRole.textContent = notulenState.notulisRole || 'Asisten Analis Sumber Daya Manusia';
}

function extractDateOnly(dateWithDay) {
  if (dateWithDay.includes(',')) {
    return dateWithDay.split(',')[1].trim();
  }
  return dateWithDay;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// AI Generate Handler
async function handleAiGenerate() {
  const input = document.getElementById('aiTranscriptInput');
  if (!input || !input.value.trim()) {
    alert('Harap masukkan transkrip atau upload file catatan rapat terlebih dahulu.');
    return;
  }

  const btn = document.getElementById('btnAiProcess');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Memproses dengan AI...';

  try {
    const res = await fetch('/api/notulen/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: input.value.trim() })
    });

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const errText = await res.text();
      throw new Error(`Respons server bukan JSON (Status ${res.status}): ${errText.substring(0, 100)}`);
    }

    if (!data.success) {
      throw new Error(data.message || 'Gagal memproses AI.');
    }

    // Terapkan hasil AI ke state
    const d = data.data;
    if (d.title) notulenState.title = d.title;
    if (d.meetingTime) notulenState.meetingTime = d.meetingTime;
    if (d.meetingPlace) notulenState.meetingPlace = d.meetingPlace;
    if (Array.isArray(d.agenda)) notulenState.agenda = d.agenda;
    if (Array.isArray(d.attendees)) notulenState.attendees = d.attendees;
    if (Array.isArray(d.activities)) notulenState.activities = d.activities;
    if (Array.isArray(d.actionItems)) notulenState.actionItems = d.actionItems;
    if (Array.isArray(d.conclusions)) notulenState.conclusions = d.conclusions;
    if (d.closingText) notulenState.closingText = d.closingText;
    if (d.notulisName) notulenState.notulisName = d.notulisName;
    if (d.notulisNip) notulenState.notulisNip = d.notulisNip;
    if (d.notulisRole) notulenState.notulisRole = d.notulisRole;

    if (d.isMT && Array.isArray(d.kertasKerjaMT) && d.kertasKerjaMT.length > 0) {
      notulenState.isMT = true;
      notulenState.kertasKerjaMT = d.kertasKerjaMT;
    } else {
      notulenState.isMT = false;
      notulenState.kertasKerjaMT = null;
    }

    // Render ulang form dan live preview
    initFormValues();
    renderDynamicLists();
    updateLivePreview();

    showNotificationToast('✨ Notula berhasil diekstrak dan disusun oleh AI!');
  } catch (err) {
    console.error('AI Error:', err);
    alert('Terjadi kesalahan saat memproses data dengan AI: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Save Notulen Handler
async function handleSaveNotulen() {
  const btn = document.getElementById('btnSaveNotulen');
  const orig = btn ? btn.innerHTML : 'Simpan';

  // Sinkronkan nilai input form terbaru ke state
  const fTitle = document.getElementById('notulaTitle');
  if (fTitle) notulenState.title = fTitle.value;
  const fDate = document.getElementById('notulaDate');
  if (fDate) notulenState.meetingDate = fDate.value;
  const fTime = document.getElementById('notulaTime');
  if (fTime) notulenState.meetingTime = fTime.value;
  const fClosing = document.getElementById('notulaClosing');
  if (fClosing) notulenState.closingText = fClosing.value;
  const fNotulisName = document.getElementById('notulisName');
  if (fNotulisName) notulenState.notulisName = fNotulisName.value;
  const fNotulisNip = document.getElementById('notulisNip');
  if (fNotulisNip) notulenState.notulisNip = fNotulisNip.value;
  const fNotulisRole = document.getElementById('notulisRole');
  if (fNotulisRole) notulenState.notulisRole = fNotulisRole.value;

  // Sinkronkan status Kertas Kerja MT ke notulenState sebelum disimpan
  notulenState.kertasKerjaMt = notulenState.isMT ? notulenState.kertasKerjaMT : null;

  const fPlace = document.getElementById('notulaPlace');
  const fCustomPlace = document.getElementById('notulaCustomPlace');
  if (fPlace) {
    if (fPlace.value === 'custom') {
      notulenState.meetingPlace = fCustomPlace ? fCustomPlace.value : 'Di Tempat';
    } else {
      notulenState.meetingPlace = fPlace.value;
    }
  }

  // Sinkronkan seluruh daftar dinamis langsung dari input DOM agar tidak ada editan yang terlewat
  const domAgendas = Array.from(document.querySelectorAll('#agendaContainer textarea')).map(t => t.value.trim()).filter(Boolean);
  if (domAgendas.length > 0) notulenState.agenda = domAgendas;

  const domAttendees = Array.from(document.querySelectorAll('#attendeesContainer textarea')).map(t => t.value.trim()).filter(Boolean);
  if (domAttendees.length > 0) notulenState.attendees = domAttendees;

  const domActions = Array.from(document.querySelectorAll('#actionItemsContainer textarea')).map(t => t.value.trim()).filter(Boolean);
  if (domActions.length > 0) notulenState.actionItems = domActions;

  const domConclusions = Array.from(document.querySelectorAll('#conclusionsContainer textarea')).map(t => t.value.trim()).filter(Boolean);
  if (domConclusions.length > 0) notulenState.conclusions = domConclusions;

  // Sinkronkan sesi paparan kegiatan dari DOM
  const actCards = document.querySelectorAll('#activitiesContainer > div');
  if (actCards.length > 0) {
    const parsedActs = [];
    actCards.forEach((card, idx) => {
      const titleInput = card.querySelector('input[type="text"]');
      const pointTextareas = card.querySelectorAll('textarea');
      const pts = Array.from(pointTextareas).map(t => t.value.trim()).filter(Boolean);
      parsedActs.push({
        sectionTitle: titleInput ? titleInput.value.trim() : `${idx + 1}. Paparan`,
        points: pts.length > 0 ? pts : ['-']
      });
    });
    if (parsedActs.length > 0) notulenState.activities = parsedActs;
  }

  // Baca pilihan rapat tujuan dari dropdown
  const fMeeting = document.getElementById('selectMeetingId');
  if (fMeeting && fMeeting.value) {
    notulenState.meetingId = parseInt(fMeeting.value, 10);
  } else if (window.selectedMeetingId) {
    notulenState.meetingId = window.selectedMeetingId;
  }

  // Jika rapat tujuan belum terpilih, konfirmasikan ke pengguna
  if (!notulenState.meetingId && Array.isArray(window.availableMeetings) && window.availableMeetings.length > 0) {
    const firstMeeting = window.availableMeetings[0];
    const wantToLink = confirm(
      '⚠️ Anda belum memilih rapat tujuan di Manajemen Meeting.\n\n' +
      'Apakah Anda ingin otomatis menghubungkan notula ini ke rapat "' + firstMeeting.meeting_nama + '"?\n\n' +
      '- Klik [OK] untuk langsung menghubungkan ke rapat "' + firstMeeting.meeting_nama + '".\n' +
      '- Klik [Batal] jika ingin memilih rapat lain pada dropdown.'
    );

    if (wantToLink) {
      notulenState.meetingId = firstMeeting.meeting_id;
      if (fMeeting) fMeeting.value = String(firstMeeting.meeting_id);
    } else {
      if (fMeeting) {
        fMeeting.focus();
        fMeeting.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/notulen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notulenState)
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Gagal menyimpan.');
    }

    if (data.id) notulenState.id = data.id;
    const targetMid = data.meetingId || notulenState.meetingId;
    if (targetMid) notulenState.meetingId = targetMid;

    showNotificationToast(data.message || '✅ Hasil edit notulen berhasil disimpan!');

    // Masuk sesuai ID rapat yang dituju di Manajemen Meeting
    if (targetMid) {
      setTimeout(() => {
        window.location.href = `/manajemenmeeting?meetingId=${targetMid}`;
      }, 1000);
    }

    return data.id;
  } catch (err) {
    console.error('Save error:', err);
    alert('Gagal menyimpan notulen: ' + err.message);
    return null;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}

// Export Docx Handler
async function handleExportDocx() {
  if (!notulenState.id) {
    showNotificationToast('⏳ Menyimpan notulen terlebih dahulu sebelum unduh Word...');
    const savedId = await handleSaveNotulen();
    if (savedId) {
      window.location.href = `/notulen/export-docx/${savedId}`;
    }
  } else {
    // Simpan perubahan terakhir lalu unduh
    await handleSaveNotulen();
    window.location.href = `/notulen/export-docx/${notulenState.id}`;
  }
}

function showNotificationToast(msg) {
  let toast = document.getElementById('notulenToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'notulenToast';
    toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: #0A2540; color: #fff; padding: 0.85rem 1.35rem; border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999; font-size: 0.875rem; font-weight: 600; border-left: 4px solid #10B981; transition: opacity 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 3500);
}
