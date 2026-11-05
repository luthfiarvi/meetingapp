/**
 * meetingReminder.js
 * Sistem Pengingat & Notifikasi Rapat Otomatis BKN Regional V
 * - Floating In-App Banner Alert
 * - Browser Desktop Native Notification (Windows/Mac/Android)
 * - Gentle Web Audio API Chime Synthesizer
 * - Ikon Lonceng Header Interaktif
 */

(function () {
    'use strict';

    // State & cache
    let todaysReminders = [];
    let isChecking = false;

    // Inisialisasi Audio Context
    function playChimeSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const now = ctx.currentTime;

            // Nada 1: C5 (523.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.18, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Nada 2: E5 (659.25 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.12);
            gain2.gain.setValueAtTime(0.22, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.55);

            // Nada 3: G5 (783.99 Hz)
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(783.99, now + 0.24);
            gain3.gain.setValueAtTime(0.26, now + 0.24);
            gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.start(now + 0.24);
            osc3.stop(now + 0.75);
        } catch (_) {}
    }

    // Pastikan container floating banner terpasang
    function ensureBannerContainer() {
        let container = document.getElementById('bknFloatingReminderContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'bknFloatingReminderContainer';
            container.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 100005;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                max-width: 420px;
                width: calc(100vw - 32px);
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    // Tampilkan Floating Banner Notifikasi
    function showFloatingBanner(meeting, typeText, timeSubtext, isUrgent = false) {
        const container = ensureBannerContainer();
        const bannerId = `banner_notif_${meeting.meeting_id}_${Date.now()}`;

        const banner = document.createElement('div');
        banner.id = bannerId;
        banner.style.cssText = `
            pointer-events: auto;
            background: #ffffff;
            border-radius: 14px;
            padding: 16px 18px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
            border-left: 5px solid ${isUrgent ? '#ef4444' : '#4f46e5'};
            border-top: 1px solid rgba(226, 232, 240, 0.8);
            border-right: 1px solid rgba(226, 232, 240, 0.8);
            border-bottom: 1px solid rgba(226, 232, 240, 0.8);
            transform: translateX(110%);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
        `;

        const safeTitle = (meeting.meeting_nama || 'Agenda Rapat').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const zoomLink = (meeting.zoom_link || '').trim();

        banner.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: ${isUrgent ? '#fee2e2' : '#eef2ff'}; color: ${isUrgent ? '#dc2626' : '#4f46e5'}; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                    ${isUrgent ? '🔴' : '⏰'}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
                        <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${isUrgent ? '#dc2626' : '#4f46e5'};">
                            ${typeText}
                        </span>
                        <button type="button" onclick="this.closest('#${bannerId}').remove()" style="background: none; border: none; font-size: 16px; color: #94a3b8; cursor: pointer; padding: 0 4px; line-height: 1;">×</button>
                    </div>
                    <h4 style="font-size: 13.5px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0; line-height: 1.35; word-break: break-word;">
                        ${safeTitle}
                    </h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 10px 0;">
                        ${timeSubtext}
                    </p>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${zoomLink ? `
                            <a href="${zoomLink}" target="_blank"
                                style="display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 6px 13px; border-radius: 8px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(37,99,235,0.3); transition: all 0.2s;">
                                <span>📹</span>
                                <span>Buka Zoom ↗</span>
                            </a>
                        ` : ''}
                        <button type="button" onclick="this.closest('#${bannerId}').remove()"
                            style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(banner);

        // Slide in
        requestAnimationFrame(() => {
            banner.style.transform = 'translateX(0)';
            banner.style.opacity = '1';
        });

        // Bunyikan chime
        playChimeSound();

        // Auto dismiss setelah 20 detik jika bukan urgent
        if (!isUrgent) {
            setTimeout(() => {
                if (banner && banner.parentNode) {
                    banner.style.transform = 'translateX(110%)';
                    banner.style.opacity = '0';
                    setTimeout(() => banner.remove(), 400);
                }
            }, 20000);
        }
    }

    // Kirim Desktop Native Notification
    function sendDesktopNotification(title, body, url) {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            try {
                const notif = new Notification(title, {
                    body: body,
                    icon: "/logo-bkn-asli.png",
                    badge: "/logo-bkn-asli.png"
                });
                notif.onclick = function () {
                    window.focus();
                    if (url) window.open(url, '_blank');
                    notif.close();
                };
            } catch (_) {}
        }
    }

    // Hitung selisih menit antara waktu mulai dan waktu saat ini (WIB)
    function getMinutesDifference(startHM, curHM) {
        if (!startHM || !curHM) return null;
        const [sH, sM] = startHM.replace('.', ':').split(':').map(Number);
        const [cH, cM] = curHM.replace('.', ':').split(':').map(Number);
        if (isNaN(sH) || isNaN(sM) || isNaN(cH) || isNaN(cM)) return null;
        const startMins = sH * 60 + sM;
        const curMins = cH * 60 + cM;
        return startMins - curMins;
    }

    // Evaluasi Notifikasi untuk Seluruh Rapat Hari Ini
    function evaluateReminders(meetings, curHM, todayStr) {
        if (!meetings || meetings.length === 0) return;

        meetings.forEach(m => {
            const mId = m.meeting_id;
            const title = m.meeting_nama || 'Agenda Rapat';
            const wMulai = (m.waktu_mulai || '').replace('.', ':');
            const zoomUrl = (m.zoom_link || '').trim();

            if (wMulai) {
                const diff = getMinutesDifference(wMulai, curHM);
                if (diff === null) return;

                // 1. KONDISI H-15 MENIT: Selisih antara 1 sampai 15 menit
                if (diff > 0 && diff <= 15) {
                    const storageKey = `bkn_notif_15m_${mId}_${todayStr}`;
                    if (!sessionStorage.getItem(storageKey)) {
                        sessionStorage.setItem(storageKey, 'true');
                        const label = `Pengingat Rapat (H-${diff} Menit)`;
                        const subtext = `Rapat akan dimulai pukul ${wMulai} WIB. Silakan bersiap-siap.`;
                        
                        showFloatingBanner(m, label, subtext, false);
                        sendDesktopNotification(`⏰ Rapat Segera Dimulai (${diff} Menit Lagi)`, `${title}\nPukul: ${wMulai} WIB. Klik untuk membuka tautan rapat.`, zoomUrl);
                    }
                }

                // 2. KONDISI TEPAT WAKTU (0 MENIT / SEDANG DIMULAI): Selisih 0 atau sudah lewat s.d 45 menit
                else if (diff <= 0 && diff >= -45) {
                    const storageKey = `bkn_notif_0m_${mId}_${todayStr}`;
                    if (!sessionStorage.getItem(storageKey)) {
                        sessionStorage.setItem(storageKey, 'true');
                        const label = `Rapat Dimulai Sekarang!`;
                        const subtext = `Rapat telah dimulai (pukul ${wMulai} WIB). Ruang rapat sudah aktif.`;

                        showFloatingBanner(m, label, subtext, true);
                        sendDesktopNotification(`🔴 Rapat Dimulai Sekarang!`, `${title}\nRuang rapat telah aktif. Silakan masuk sekarang.`, zoomUrl);
                    }
                }
            } else {
                // Rapat hari ini tanpa jam spesifik (diingatkan 1x saat pertama buka halaman)
                const storageKey = `bkn_notif_day_${mId}_${todayStr}`;
                if (!sessionStorage.getItem(storageKey)) {
                    sessionStorage.setItem(storageKey, 'true');
                    const label = `Agenda Hari Ini`;
                    const subtext = `Anda memiliki agenda rapat "${title}" hari ini.`;
                    showFloatingBanner(m, label, subtext, false);
                }
            }
        });
    }

    // Fetch dan periksa pengingat dari server
    async function checkReminders() {
        if (isChecking) return;
        isChecking = true;
        try {
            const res = await fetch('/api/user/my-agenda-reminders');
            if (res.ok) {
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    todaysReminders = json.data;
                    const curHM = json.server_time;
                    const todayStr = json.today;

                    updateBellBadge(todaysReminders.length);
                    evaluateReminders(todaysReminders, curHM, todayStr);
                }
            }
        } catch (_) {
        } finally {
            isChecking = false;
        }
    }

    // Update Badge Lonceng Notifikasi
    function updateBellBadge(count) {
        const badges = [document.getElementById('bknBellBadge'), document.getElementById('mobileBellBadge')];
        badges.forEach(badge => {
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
    }

    // Toggle Dropdown Pengingat Lonceng
    function toggleBellDropdown() {
        let dropdown = document.getElementById('bknBellDropdown');
        if (!dropdown) {
            dropdown = createBellDropdown();
        }
        if (dropdown.style.display === 'none' || !dropdown.style.display) {
            renderBellDropdownContent(dropdown);
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    }

    // Buat Dropdown Lonceng
    function createBellDropdown() {
        const dropdown = document.createElement('div');
        dropdown.id = 'bknBellDropdown';
        const isMobile = window.innerWidth <= 800;
        
        dropdown.style.cssText = `
            display: none;
            position: ${isMobile ? 'fixed' : 'absolute'};
            top: ${isMobile ? '58px' : '48px'};
            right: ${isMobile ? '12px' : '0'};
            left: ${isMobile ? '12px' : 'auto'};
            width: ${isMobile ? 'auto' : '340px'};
            max-width: calc(100vw - 24px);
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.22);
            z-index: 100010;
            padding: 16px;
        `;
        const bellWrapper = document.getElementById('bknBellWrapper');
        if (!isMobile && bellWrapper) {
            bellWrapper.style.position = 'relative';
            bellWrapper.appendChild(dropdown);
        } else {
            document.body.appendChild(dropdown);
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !e.target.closest('#bknBellBtn') && !e.target.closest('#mobileBellBtn')) {
                dropdown.style.display = 'none';
            }
        });

        return dropdown;
    }

    // Render Konten Dropdown Lonceng
    function renderBellDropdownContent(dropdown) {
        const notifGranted = ("Notification" in window && Notification.permission === "granted");

        let itemsHtml = '';
        if (todaysReminders.length === 0) {
            itemsHtml = `
                <div style="text-align: center; padding: 20px 8px; color: #64748b; font-size: 13px;">
                    <span style="font-size: 26px; display: block; margin-bottom: 6px;">☕</span>
                    Tidak ada agenda rapat yang tersisa hari ini.
                </div>
            `;
        } else {
            itemsHtml = todaysReminders.map(m => `
                <div style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
                        <span style="font-size: 10.5px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 5px;">
                            ${m.tipe_meeting || 'Rapat'}
                        </span>
                        <span style="font-size: 11px; font-weight: 600; color: #64748b;">
                            🕒 ${m.waktu_mulai ? m.waktu_mulai + ' WIB' : 'Hari Ini'}
                        </span>
                    </div>
                    <h5 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">
                        ${(m.meeting_nama || '').replace(/</g, '&lt;')}
                    </h5>
                    ${m.zoom_link ? `
                        <a href="${m.zoom_link}" target="_blank"
                            style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #2563eb; text-decoration: none;">
                            <span>📹 Buka Zoom ↗</span>
                        </a>
                    ` : ''}
                </div>
            `).join('');
        }

        dropdown.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 16px;">🔔</span>
                    <strong style="font-size: 13.5px; color: #1e293b;">Agenda Hari Ini</strong>
                </div>
                <button type="button" onclick="window.testBknReminder()"
                    style="font-size: 11px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 3px 8px; cursor: pointer;"
                    title="Coba simulasi suara chime dan banner pengingat rapat">
                    Tes Notifikasi
                </button>
            </div>

            <div style="max-height: 240px; overflow-y: auto; margin-bottom: 12px;">
                ${itemsHtml}
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 13px; color: #16a34a; line-height: 1;">✓</span>
                        <span style="font-size: 12px; font-weight: 700; color: #166534;">Pengingat Rapat Aktif</span>
                    </div>
                    <span style="font-size: 11px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 2px 7px; border-radius: 6px;">
                        Otomatis
                    </span>
                </div>
                <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0; line-height: 1.35;">
                    Banner pengingat & suara lonceng otomatis muncul di layar web 15 menit sebelum rapat dimulai.
                </p>
            </div>
        `;
    }

    // Fungsi Test Notifikasi Interaktif
    window.testBknReminder = function () {
        const dummy = {
            meeting_id: 'test',
            meeting_nama: 'Simulasi: Rapat Koordinasi BKN Regional V',
            waktu_mulai: '11:00',
            zoom_link: 'https://zoom.us'
        };
        showFloatingBanner(dummy, '⏰ PENGINGAT RAPAT (H-15 MENIT)', 'Rapat akan segera dimulai pukul 11:00 WIB. Silakan bersiap-siap.', false);
        sendDesktopNotification("⏰ Pengingat: Rapat BKN Segera Dimulai!", "Simulasi: Rapat Koordinasi BKN Regional V dimulai pukul 11:00 WIB.", "https://zoom.us");
    };

    window.toggleBknBellDropdown = toggleBellDropdown;

    // Inisialisasi Lonceng di Topbar bila ada tempatnya
    function mountTopbarBell() {
        // Cari container yang tepat: .management-actions atau .profile
        const targetContainer = document.querySelector('.management-actions') || document.querySelector('.topbar-right-only') || document.querySelector('.profile');
        if (!targetContainer || document.getElementById('bknBellWrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'bknBellWrapper';
        wrapper.style.cssText = 'position: relative; display: inline-flex; align-items: center;';

        wrapper.innerHTML = `
            <button type="button" id="bknBellBtn" onclick="window.toggleBknBellDropdown()"
                style="width: 40px; height: 40px; border-radius: 10px; background: #ffffff; border: 1.5px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; position: relative; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.04);"
                title="Pengingat & Notifikasi Rapat Hari Ini">
                🔔
                <span id="bknBellBadge"
                    style="display: none; position: absolute; top: -5px; right: -5px; background: #ef4444; color: #ffffff; font-size: 10.5px; font-weight: 800; border-radius: 999px; width: 18px; height: 18px; align-items: center; justify-content: center; border: 2px solid #ffffff;">
                    0
                </span>
            </button>
        `;

        if (targetContainer.classList.contains('management-actions')) {
            // Tempatkan di paling kanan (setelah tombol Tambah Meeting) agar dropdown tidak terpotong sidebar
            targetContainer.appendChild(wrapper);
        } else {
            targetContainer.insertBefore(wrapper, targetContainer.firstChild);
        }
    }

    // Auto-start saat DOM siap
    function init() {
        mountTopbarBell();
        checkReminders();
        // Cek secara berkala setiap 30 detik
        setInterval(checkReminders, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

