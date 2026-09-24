document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnToggleMeta = document.getElementById('btn-toggle-meta');
  const metaFields = document.querySelectorAll('.meta-field');
  const btnSave = document.getElementById('btn-save');
  const docIdInput = document.getElementById('doc_id');
  const toast = document.getElementById('toast');

  // Input Fields
  const reportTitleInput = document.getElementById('report_title');
  const reportSubtitleInput = document.getElementById('report_subtitle');
  const reportDateInput = document.getElementById('report_date');

  const metaNama = document.getElementById('meta_nama');
  const metaDivisi = document.getElementById('meta_divisi');
  const metaInstansi = document.getElementById('meta_instansi');
  const metaNip = document.getElementById('meta_nip');
  const metaMentor = document.getElementById('meta_mentor');
  const metaLogo = document.getElementById('meta_logo');
  const metaAvatar = document.getElementById('meta_avatar');

  // Preview Elements
  const pvTitle = document.getElementById('pv-title');
  const pvSubtitle = document.getElementById('pv-subtitle');
  const pvDateBadge = document.getElementById('pv-date-badge');
  const pvLogo = document.getElementById('pv-logo');
  const pvAvatar = document.getElementById('pv-avatar');
  const pvAvatarImg = document.getElementById('pv-avatar-img');
  const pvNama = document.getElementById('pv-nama');
  const pvInstansi = document.getElementById('pv-instansi');
  const pvDivisi = document.getElementById('pv-divisi');
  const pvNip = document.getElementById('pv-nip');
  const pvMentor = document.getElementById('pv-mentor');
  const pvPillars = document.getElementById('pv-pillars');
  const pvTableRows = document.getElementById('pv-table-rows');

  let isMetaEditable = false;

  // 1. Toggle Read-Only Metadata
  if (btnToggleMeta) {
    btnToggleMeta.addEventListener('click', () => {
      isMetaEditable = !isMetaEditable;
      metaFields.forEach(field => {
        field.readOnly = !isMetaEditable;
        if (isMetaEditable) {
          field.style.backgroundColor = '#FFFFFF';
          field.style.borderColor = '#3B82F6';
        } else {
          field.style.backgroundColor = '#F1F5F9';
          field.style.borderColor = '#CBD5E1';
        }
      });

      btnToggleMeta.innerHTML = isMetaEditable
        ? '🔒 Kunci Kembali Meta'
        : '✏️ Buka Kunci / Edit Meta';
      btnToggleMeta.classList.toggle('btn-primary', isMetaEditable);
      btnToggleMeta.classList.toggle('btn-secondary', !isMetaEditable);
    });
  }

  // Indonesian Day & Month Formatter
  function formatIndonesianDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return dateObj.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (e) {
      console.warn(e);
    }
    return dateStr;
  }

  // 2. Real-Time Sync Functions
  function updatePreviewMeta() {
    if (pvNama && metaNama) pvNama.textContent = metaNama.value || 'Nama Pegawai';
    if (pvDivisi && metaDivisi) pvDivisi.textContent = metaDivisi.value || 'Jabatan / Divisi';
    if (pvInstansi && metaInstansi) pvInstansi.textContent = metaInstansi.value || 'Kantor Regional V BKN Jakarta';
    if (pvNip && metaNip) pvNip.textContent = metaNip.value || '-';
    if (pvLogo && metaLogo) pvLogo.src = metaLogo.value || '/images/Logo_Badan_Kepegawaian_Negara.png';
    if (pvAvatarImg && metaAvatar && metaAvatar.value) {
      pvAvatarImg.src = metaAvatar.value;
    }
  }

  function updatePreviewHeader() {
    if (pvTitle && reportTitleInput) pvTitle.textContent = reportTitleInput.value || 'Laporan Kinerja Harian';
    if (pvSubtitle && reportSubtitleInput) pvSubtitle.textContent = reportSubtitleInput.value || '';
    if (pvDateBadge && reportDateInput) {
      pvDateBadge.textContent = formatIndonesianDate(reportDateInput.value);
    }
  }



  function updatePreviewPillars() {
    if (!pvPillars) return;
    const pillarBoxes = document.querySelectorAll('.pillar-input-box');
    let html = '';
    pillarBoxes.forEach(box => {
      const title = box.querySelector('.pillar-title-input')?.value || 'Pilar Aktivitas';
      const itemInputs = box.querySelectorAll('.pillar-item-text');
      let itemsHtml = '';
      itemInputs.forEach(inp => {
        if (inp.value.trim()) {
          itemsHtml += `<li class="pillar-item">${escapeHtml(inp.value)}</li>`;
        }
      });
      html += `
        <div class="pillar-card">
          <div class="pillar-title">${escapeHtml(title)}</div>
          <ul class="pillar-list">
            ${itemsHtml || '<li class="pillar-item" style="color:#94a3b8;">Belum ada butir aktivitas</li>'}
          </ul>
        </div>
      `;
    });
    pvPillars.innerHTML = html;
  }

  function updatePreviewTable() {
    if (!pvTableRows) return;
    const rows = document.querySelectorAll('.matrix-input-row');
    const currentName = metaNama ? metaNama.value : 'Pegawai';
    let html = '';
    rows.forEach(r => {
      const komponen = r.querySelector('.row-komponen')?.value || '';
      const status = r.querySelector('.row-status')?.value || 'Selesai';
      const target = r.querySelector('.row-target')?.value || '100%';
      const ket = r.querySelector('.row-ket')?.value || '';
      const statusClass = status.toLowerCase();

      html += `
        <tr>
          <td style="font-weight: 600;">${escapeHtml(komponen)}</td>
          <td>${escapeHtml(currentName)}</td>
          <td><span class="badge-status ${statusClass}">${escapeHtml(status)}</span></td>
          <td style="font-weight: 600;">${escapeHtml(target)}</td>
          <td>${escapeHtml(ket)}</td>
        </tr>
      `;
    });
    pvTableRows.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Belum ada data komponen</td></tr>';
  }

  // Utility to avoid XSS in preview DOM
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 3. Attach Event Listeners for Live Binding
  [reportTitleInput, reportSubtitleInput, reportDateInput].forEach(inp => {
    if (inp) inp.addEventListener('input', updatePreviewHeader);
  });

  [metaNama, metaDivisi, metaInstansi, metaNip, metaLogo].forEach(inp => {
    if (inp) inp.addEventListener('input', () => {
      updatePreviewMeta();
      updatePreviewTable(); // Updates PIC column
    });
  });



  const pillarsContainer = document.getElementById('pillars-input-container');
  if (pillarsContainer) {
    pillarsContainer.addEventListener('input', updatePreviewPillars);

    // Event Delegation for Adding/Deleting Items in Pillars
    pillarsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add-item')) {
        const pillarBox = e.target.closest('.pillar-input-box');
        const list = pillarBox.querySelector('.pillar-items-list');
        const newRow = document.createElement('div');
        newRow.className = 'pillar-item-row';
        newRow.style.display = 'flex';
        newRow.style.gap = '0.35rem';
        newRow.style.alignItems = 'center';
        newRow.innerHTML = `
          <input type="text" class="form-input pillar-item-text" placeholder="Aktivitas baru..." value="">
          <button type="button" class="btn btn-secondary btn-sm btn-del-item" style="color: #DC2626; padding: 0.25rem 0.4rem;">✕</button>
        `;
        list.appendChild(newRow);
        newRow.querySelector('input').focus();
        updatePreviewPillars();
      }

      if (e.target.classList.contains('btn-del-item')) {
        const row = e.target.closest('.pillar-item-row');
        if (row) {
          row.remove();
          updatePreviewPillars();
        }
      }
    });
  }

  // Table Event Delegation
  const tableRowsContainer = document.getElementById('table-rows-container');
  const btnAddTableRow = document.getElementById('btn-add-table-row');

  if (tableRowsContainer) {
    tableRowsContainer.addEventListener('input', updatePreviewTable);
    tableRowsContainer.addEventListener('change', updatePreviewTable);

    tableRowsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del-row')) {
        const row = e.target.closest('.matrix-input-row');
        if (row) {
          row.remove();
          updatePreviewTable();
        }
      }
    });
  }

  if (btnAddTableRow && tableRowsContainer) {
    btnAddTableRow.addEventListener('click', () => {
      const tr = document.createElement('tr');
      tr.className = 'matrix-input-row';
      tr.style.borderBottom = '1px solid #E2E8F0';
      tr.innerHTML = `
        <td style="padding: 0.35rem;">
          <input type="text" class="form-input row-komponen" placeholder="Komponen / Pekerjaan">
        </td>
        <td style="padding: 0.35rem;">
          <select class="form-input row-status">
            <option value="Selesai">Selesai</option>
            <option value="Berjalan" selected>Berjalan</option>
            <option value="Tertunda">Tertunda</option>
          </select>
        </td>
        <td style="padding: 0.35rem;">
          <input type="text" class="form-input row-target" value="100%" placeholder="100%">
        </td>
        <td style="padding: 0.35rem;">
          <input type="text" class="form-input row-ket" placeholder="Catatan">
        </td>
        <td style="padding: 0.35rem; text-align: center;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-row" style="color: #DC2626; padding: 0.2rem 0.4rem;">✕</button>
        </td>
      `;
      tableRowsContainer.appendChild(tr);
      tr.querySelector('input').focus();
      updatePreviewTable();
    });
  }

  // 4. Evidence Management
  const evidenceInputsContainer = document.getElementById('evidence-inputs-container');
  const btnAddEvidence = document.getElementById('btn-add-evidence');
  const pvEvidenceSection = document.getElementById('pv-evidence-section');
  const pvEvidenceGrid = document.getElementById('pv-evidence-grid');

  function updatePreviewEvidence() {
    if (!pvEvidenceGrid || !pvEvidenceSection) return;
    const rows = document.querySelectorAll('.evidence-input-row');
    const items = [];

    rows.forEach(row => {
      const urlInp = row.querySelector('.evidence-url-input');
      const captionInp = row.querySelector('.evidence-caption-input');
      const thumb = row.querySelector('.evidence-thumb');
      const url = urlInp && urlInp.value ? urlInp.value : (thumb ? thumb.src : '');
      const caption = captionInp ? captionInp.value : '';

      if (url && !url.endsWith('default_avatar.png')) {
        items.push({ url, caption });
      }
    });

    if (items.length === 0) {
      pvEvidenceSection.style.display = 'none';
      pvEvidenceGrid.innerHTML = '';
      return;
    }

    pvEvidenceSection.style.display = 'block';
    let html = '';
    items.forEach(it => {
      html += `
        <div class="evidence-card">
          <div class="evidence-img-box">
            <img src="${escapeHtml(it.url)}" alt="${escapeHtml(it.caption || 'Bukti Visual')}">
          </div>
          <div class="evidence-caption">${escapeHtml(it.caption || 'Dokumentasi Kegiatan')}</div>
        </div>
      `;
    });
    pvEvidenceGrid.innerHTML = html;
  }

  function attachEvidenceRowEvents(row) {
    const fileInp = row.querySelector('.evidence-file-input');
    const urlInp = row.querySelector('.evidence-url-input');
    const captionInp = row.querySelector('.evidence-caption-input');
    const thumb = row.querySelector('.evidence-thumb');
    const delBtn = row.querySelector('.btn-del-evidence');

    if (fileInp) {
      fileInp.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Instant local preview
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (thumb) {
            thumb.src = ev.target.result;
            thumb.style.opacity = '1';
          }
          if (urlInp && !urlInp.value) {
            urlInp.value = ev.target.result;
          }
          updatePreviewEvidence();
        };
        reader.readAsDataURL(file);

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-evidence', {
            method: 'POST',
            body: formData
          });
          const json = await res.json();
          if (json.success && json.url) {
            if (urlInp) urlInp.value = json.url;
            if (thumb) thumb.src = json.url;
            updatePreviewEvidence();
          }
        } catch (err) {
          console.warn('Upload error, using local preview data:', err);
        }
      });
    }

    if (captionInp) {
      captionInp.addEventListener('input', updatePreviewEvidence);
    }

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        row.remove();
        updatePreviewEvidence();
      });
    }
  }

  // Attach events to existing rows
  document.querySelectorAll('.evidence-input-row').forEach(row => {
    attachEvidenceRowEvents(row);
  });

  if (btnAddEvidence && evidenceInputsContainer) {
    btnAddEvidence.addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'evidence-input-row';
      div.style.cssText = 'background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0.5rem; padding: 0.75rem; display: flex; gap: 0.75rem; align-items: center;';
      div.innerHTML = `
        <div style="width: 70px; height: 55px; border-radius: 0.375rem; overflow: hidden; background: #E2E8F0; flex-shrink: 0; border: 1px solid #CBD5E1; display: flex; align-items: center; justify-content: center;">
          <img class="evidence-thumb" src="/images/default_avatar.png" alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 0.35rem;">
          <input type="file" class="form-input evidence-file-input" accept="image/*" style="font-size: 0.725rem; padding: 0.25rem 0.4rem;">
          <input type="hidden" class="evidence-url-input" value="">
          <input type="text" class="form-input evidence-caption-input" placeholder="Keterangan foto kegiatan (misal: Rapat Koordinasi ASN)" value="">
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-del-evidence" style="color: #DC2626; padding: 0.35rem 0.5rem;">✕</button>
      `;
      evidenceInputsContainer.appendChild(div);
      attachEvidenceRowEvents(div);
      div.querySelector('.evidence-file-input').click();
    });
  }

  // 5. Toast Notification
  function showToast(message, isSuccess = true) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = isSuccess ? '#0F172A' : '#991B1B';
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // 6. Save to Database via API
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      btnSave.disabled = true;
      btnSave.innerHTML = `<span>Menyimpan...</span>`;

      try {
        const metrics = [];

        // Collect pillars
        const pillars = [];
        document.querySelectorAll('.pillar-input-box').forEach(p => {
          const title = p.querySelector('.pillar-title-input')?.value || '';
          const items = [];
          p.querySelectorAll('.pillar-item-text').forEach(itemInp => {
            if (itemInp.value.trim()) items.push(itemInp.value.trim());
          });
          pillars.push({ title, items });
        });

        // Collect table rows
        const tableRows = [];
        document.querySelectorAll('.matrix-input-row').forEach(r => {
          tableRows.push({
            komponen: r.querySelector('.row-komponen')?.value || '',
            status: r.querySelector('.row-status')?.value || 'Selesai',
            target: r.querySelector('.row-target')?.value || '100%',
            ket: r.querySelector('.row-ket')?.value || ''
          });
        });

        // Collect visual evidence
        const visualEvidence = [];
        document.querySelectorAll('.evidence-input-row').forEach(r => {
          const url = r.querySelector('.evidence-url-input')?.value || '';
          const caption = r.querySelector('.evidence-caption-input')?.value || '';
          if (url) {
            visualEvidence.push({ url, caption });
          }
        });

        const payload = {
          id: docIdInput ? docIdInput.value : null,
          title: reportTitleInput ? reportTitleInput.value : '',
          subtitle: reportSubtitleInput ? reportSubtitleInput.value : '',
          date: reportDateInput ? reportDateInput.value : '',
          metrics,
          pillars,
          tableRows,
          visualEvidence
        };

        const response = await fetch('/api/infographics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          if (docIdInput && result.id) {
            docIdInput.value = result.id;
          }
          showToast('✅ ' + result.message, true);
        } else {
          showToast('❌ ' + (result.message || 'Gagal menyimpan infografis'), false);
        }
      } catch (err) {
        console.error('Save error:', err);
        showToast('❌ Terjadi kesalahan jaringan saat menyimpan', false);
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `
          <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
          <span>Simpan ke Database</span>
        `;
      }
    });
  }

  // 6. AI Infographic Assistant Handler (Single Input Prompt)
  const btnAiGenerate = document.getElementById('btn-ai-generate');
  const btnAiSample = document.getElementById('btn-ai-sample');
  const aiRawInput = document.getElementById('ai_raw_input');
  const aiStatus = document.getElementById('ai-status');

  if (btnAiSample && aiRawInput) {
    btnAiSample.addEventListener('click', () => {
      aiRawInput.value = `Hari ini menyelesaikan modul autentikasi login dan keamanan sesi sistem untuk pegawai Kantor Regional V BKN Jakarta. Mengintegrasikan fitur auto-binding data profil pegawai ke formulir laporan, serta memperbaiki tata letak visual logo navbar dan header. Sebanyak 28 tiket layanan kepegawaian berhasil diselesaikan dengan SLA kecepatan respon rata-rata 14 menit. Uptime efisiensi sistem terjaga di angka 99.4%, dan progres capaian sprint mingguan berhasil menyentuh target 88%. Seluruh komponen telah teruji dan siap dicetak ke dokumen PDF resmi.`;
      aiRawInput.focus();
    });
  }

  if (btnAiGenerate && aiRawInput) {
    btnAiGenerate.addEventListener('click', async () => {
      const rawText = aiRawInput.value.trim();
      if (!rawText) {
        showToast('⚠️ Harap masukkan teks catatan laporan harian terlebih dahulu.', false);
        aiRawInput.focus();
        return;
      }

      btnAiGenerate.disabled = true;
      const originalBtnHtml = btnAiGenerate.innerHTML;
      btnAiGenerate.innerHTML = `<span>⏳ Menganalisis dengan AI...</span>`;
      if (aiStatus) {
        aiStatus.innerHTML = `<span>⚡ AI sedang menyusun metrik, pilar, dan matriks...</span>`;
        aiStatus.style.color = '#93C5FD';
      }

      try {
        const response = await fetch('/api/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText })
        });

        const resData = await response.json();

        if (resData.success && resData.data) {
          const d = resData.data;

          // 1. Populate Header & Dates
          if (reportTitleInput && d.reportTitle) reportTitleInput.value = d.reportTitle;
          if (reportSubtitleInput && d.reportSubtitle) reportSubtitleInput.value = d.reportSubtitle;
          if (reportDateInput && d.reportDate) reportDateInput.value = d.reportDate;



          // 3. Populate 2 Pillars
          if (Array.isArray(d.pillars) && d.pillars.length > 0) {
            const pillarBoxes = document.querySelectorAll('.pillar-input-box');
            d.pillars.slice(0, 2).forEach((p, pIdx) => {
              if (pillarBoxes[pIdx]) {
                const titleInp = pillarBoxes[pIdx].querySelector('.pillar-title-input');
                if (titleInp && p.title) titleInp.value = p.title;

                const list = pillarBoxes[pIdx].querySelector('.pillar-items-list');
                if (list && Array.isArray(p.items)) {
                  list.innerHTML = '';
                  p.items.forEach(itemText => {
                    const row = document.createElement('div');
                    row.className = 'pillar-item-row';
                    row.style.display = 'flex';
                    row.style.gap = '0.35rem';
                    row.style.alignItems = 'center';
                    row.innerHTML = `
                      <input type="text" class="form-input pillar-item-text" value="${escapeHtml(itemText)}" placeholder="Aktivitas...">
                      <button type="button" class="btn btn-secondary btn-sm btn-del-item" style="color: #DC2626; padding: 0.25rem 0.4rem;">✕</button>
                    `;
                    list.appendChild(row);
                  });
                }
              }
            });
          }

          // 4. Populate Table Rows
          if (Array.isArray(d.tableRows) && d.tableRows.length > 0 && tableRowsContainer) {
            tableRowsContainer.innerHTML = '';
            d.tableRows.forEach(r => {
              const tr = document.createElement('tr');
              tr.className = 'matrix-input-row';
              tr.style.borderBottom = '1px solid #E2E8F0';
              tr.innerHTML = `
                <td style="padding: 0.35rem;">
                  <input type="text" class="form-input row-komponen" value="${escapeHtml(r.komponen || '')}" placeholder="Komponen">
                </td>
                <td style="padding: 0.35rem;">
                  <select class="form-input row-status">
                    <option value="Selesai" ${r.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    <option value="Berjalan" ${r.status === 'Berjalan' ? 'selected' : ''}>Berjalan</option>
                    <option value="Tertunda" ${r.status === 'Tertunda' ? 'selected' : ''}>Tertunda</option>
                  </select>
                </td>
                <td style="padding: 0.35rem;">
                  <input type="text" class="form-input row-target" value="${escapeHtml(r.target || '100%')}" placeholder="100%">
                </td>
                <td style="padding: 0.35rem;">
                  <input type="text" class="form-input row-ket" value="${escapeHtml(r.ket || '')}" placeholder="Catatan">
                </td>
                <td style="padding: 0.35rem; text-align: center;">
                  <button type="button" class="btn btn-secondary btn-sm btn-del-row" style="color: #DC2626; padding: 0.2rem 0.4rem;">✕</button>
                </td>
              `;
              tableRowsContainer.appendChild(tr);
            });
          }

          // 5. Update Live Preview Instantly!
          updatePreviewHeader();
          updatePreviewPillars();
          updatePreviewTable();

          showToast('✨ Infografis berhasil disusun secara otomatis oleh AI!', true);
          if (aiStatus) {
            aiStatus.innerHTML = `<span>✅ Infografis selesai disusun & siap dicetak / disimpan.</span>`;
            aiStatus.style.color = '#6EE7B7';
          }
        } else {
          showToast('❌ ' + (resData.message || 'Gagal memproses dengan AI.'), false);
        }
      } catch (err) {
        console.error('AI error:', err);
        showToast('❌ Terjadi kesalahan jaringan saat memanggil AI.', false);
      } finally {
        btnAiGenerate.disabled = false;
        btnAiGenerate.innerHTML = originalBtnHtml;
      }
    });
  }

  // Download PNG HD via html2canvas
  const btnDownloadPng = document.getElementById('btn-download-png');
  if (btnDownloadPng) {
    btnDownloadPng.addEventListener('click', async () => {
      const canvasEl = document.getElementById('infographicPreview') || document.querySelector('.infographic-canvas');
      if (!canvasEl) return;
      btnDownloadPng.disabled = true;
      const originalText = btnDownloadPng.innerHTML;
      btnDownloadPng.innerHTML = '<span>Menyiapkan HD...</span>';
      try {
        const canvas = await html2canvas(canvasEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF'
        });
        const link = document.createElement('a');
        const filename = (reportTitleInput && reportTitleInput.value ? reportTitleInput.value.replace(/[^a-zA-Z0-9]/g, '_') : 'infografis_bkn') + '.png';
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('✅ Berhasil mengunduh gambar infografis resolusi tinggi (PNG HD)!', true);
      } catch (err) {
        console.error('PNG download error:', err);
        showToast('❌ Gagal mengunduh gambar: ' + err.message, false);
      } finally {
        btnDownloadPng.disabled = false;
        btnDownloadPng.innerHTML = originalText;
      }
    });
  }

  // Initial Sync
  updatePreviewHeader();
  updatePreviewMeta();
});
