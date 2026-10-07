/**
 * NOTULEN.JS - LOGIKA REAKTIF & GENERATOR NOTULA BKN
 */

// State dokumen notulen
let notulenState = window.initialNotulenData || {
  id: null,
  meetingId: null,
  title: 'BKN MENYAPA ASN : Penguatan Implementasi Manajemen Talenta melalui SIMATA dan MyASN',
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
  notulisRole: '',
  documentationPhotos: []
};

if (window.selectedMeetingId && !notulenState.meetingId) {
  notulenState.meetingId = window.selectedMeetingId;
}

if (!Array.isArray(notulenState.documentationPhotos)) {
  notulenState.documentationPhotos = [];
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
  const fNotulisRole = document.getElementById('notulisRole');
  const fMeeting = document.getElementById('selectMeetingId');

  if (fMeeting && notulenState.meetingId) {
    fMeeting.value = String(notulenState.meetingId);
  }
  if (fTitle) fTitle.value = notulenState.title || '';
  if (fDate) fDate.value = notulenState.meetingDate || '';
  if (fTime) fTime.value = notulenState.meetingTime || '';
  if (fClosing) fClosing.value = notulenState.closingText || '';
  if (fNotulisName) fNotulisName.value = notulenState.notulisName || '';
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
}

function setupEventListeners() {
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
          if (fTitle) {
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

  const fNotulisRole = document.getElementById('notulisRole');
  if (fNotulisRole) {
    fNotulisRole.addEventListener('input', (e) => {
      notulenState.notulisRole = e.target.value;
      updateLivePreview();
    });
  }

  // File transkrip upload (.docx, .txt, .md)
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
  renderListEditor('actionItemsContainer', notulenState.actionItems, 'actionItems');
  renderListEditor('conclusionsContainer', notulenState.conclusions, 'conclusions');
}

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
      <img src="${photo.url}" alt="Foto" style="width: 56px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #CBD5E1;">
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

// Upload File Transkrip Handler (.docx, .txt, .md)
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
      showNotificationToast(`📄 File "${file.name}" berhasil dibaca! Klik tombol AI di bawah untuk menyusun notulen.`);
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
            <img src="${photo.url}" alt="${escapeHtml(photo.caption || 'Bukti Kegiatan')}" style="max-height: 180px; width: 100%; object-fit: cover; border-radius: 2px;">
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
    if (d.notulisRole) notulenState.notulisRole = d.notulisRole;

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
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Menyimpan...';

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
    showNotificationToast(data.message || '✅ Dokumen notulen berhasil disimpan ke database!');
    return data.id;
  } catch (err) {
    console.error('Save error:', err);
    alert('Gagal menyimpan notulen: ' + err.message);
    return null;
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
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
