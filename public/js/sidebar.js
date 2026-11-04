/**
 * BKN Meeting App - Sidebar Toggle (Minimize / Expand)
 * Menyediakan fungsi meminimize sidebar untuk memperluas tampilan tengah,
 * serta menyimpan status state di localStorage dan shortcut keyboard Ctrl+B.
 */
(function() {
    function getIsCollapsed() {
        return localStorage.getItem('bkn_sidebar_minimized') === 'true';
    }

    function applySidebarState(collapsed) {
        const aside = document.querySelector('.sidebar');
        if (collapsed) {
            document.body.classList.add('sidebar-minimized');
            if (aside) aside.classList.add('minimized');
        } else {
            document.body.classList.remove('sidebar-minimized');
            if (aside) aside.classList.remove('minimized');
        }
        updateToggleBtnIcon(collapsed);
    }

    function updateToggleBtnIcon(collapsed) {
        const btn = document.getElementById('btnSidebarToggle');
        if (!btn) return;
        
        if (collapsed) {
            btn.setAttribute('title', 'Perluas Sidebar (Klik untuk membuka)');
            btn.setAttribute('aria-label', 'Perluas Sidebar');
        } else {
            btn.setAttribute('title', 'Kecilkan Sidebar (Perluas Tampilan Tengah)');
            btn.setAttribute('aria-label', 'Kecilkan Sidebar');
        }

        const iconSvg = btn.querySelector('.toggle-icon');
        if (iconSvg) {
            iconSvg.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    window.toggleSidebar = function() {
        const nextState = !getIsCollapsed();
        localStorage.setItem('bkn_sidebar_minimized', nextState ? 'true' : 'false');
        applySidebarState(nextState);
    };

    // Jalankan sesegera mungkin untuk mencegah flicker
    if (getIsCollapsed()) {
        document.documentElement.classList.add('sidebar-minimized-init');
        document.addEventListener('DOMContentLoaded', function() {
            applySidebarState(true);
        });
    }

    // === OPTION 3: MOBILE BOTTOM NAVIGATION BAR & MORE SHEET ===
    window.openMobileMoreSheet = function() {
        const sheet = document.getElementById('mobileMoreSheet');
        if (sheet) {
            sheet.classList.add('open');
        }
        document.body.classList.add('mobile-more-open');
    };

    window.closeMobileMoreSheet = function() {
        const sheet = document.getElementById('mobileMoreSheet');
        if (sheet) {
            sheet.classList.remove('open');
        }
        document.body.classList.remove('mobile-more-open');
    };

    window.toggleMobileMoreSheet = function() {
        const sheet = document.getElementById('mobileMoreSheet');
        if (sheet && sheet.classList.contains('open')) {
            window.closeMobileMoreSheet();
        } else {
            window.openMobileMoreSheet();
        }
    };

    // Alias kompatibilitas
    window.toggleMobileSidebar = window.toggleMobileMoreSheet;
    window.openMobileSidebar = window.openMobileMoreSheet;
    window.closeMobileSidebar = window.closeMobileMoreSheet;

    function initMobileNav() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const currentPath = window.location.pathname.toLowerCase();

        // 1. Buat Mobile Top Header (Ramping, Tanpa Hamburger)
        let mobileHeader = document.getElementById('mobileNavHeader');
        if (!mobileHeader) {
            mobileHeader = document.createElement('header');
            mobileHeader.className = 'mobile-nav-header';
            mobileHeader.id = 'mobileNavHeader';

            const userImg = document.querySelector('.profile .avatar img, .user-avatar-badge img, a[href="/profile"] img');
            const avatarSrc = userImg ? userImg.getAttribute('src') : '/images/default_avatar.png';
            const userName = userImg ? (userImg.getAttribute('alt') || 'Profil') : 'Profil';

            mobileHeader.innerHTML = `
                <div class="mobile-nav-brand">
                    <img src="/logo-bkn-asli.png" alt="Logo BKN" class="mobile-nav-logo">
                    <div class="mobile-nav-title-group">
                        <span class="mobile-nav-title">Meeting App</span>
                        <span class="mobile-nav-subtitle">BKN Regional V</span>
                    </div>
                </div>
                <div class="mobile-nav-right">
                    <a href="/profile" class="mobile-nav-profile-link" title="Profil Pegawai">
                        <img src="${avatarSrc}" alt="${userName}" class="mobile-nav-avatar">
                    </a>
                </div>
            `;

            const dashboard = document.querySelector('.dashboard') || document.body;
            dashboard.insertBefore(mobileHeader, dashboard.firstChild);
        }

        // 2. Buat Bottom Navigation Bar (5 Tab Jempol Ergonomis)
        let bottomNav = document.getElementById('mobileBottomNav');
        if (!bottomNav) {
            bottomNav = document.createElement('nav');
            bottomNav.className = 'mobile-bottom-nav';
            bottomNav.id = 'mobileBottomNav';

            const isDashboard = currentPath === '/dashboard' || currentPath === '/' || currentPath === '';
            const isMeeting = currentPath.includes('meeting');
            const isZoom = currentPath.includes('zoom');
            const isInfografis = currentPath.includes('infografis') || currentPath.includes('portal') || currentPath.includes('generator') || currentPath.includes('notulen');
            const isMore = currentPath.includes('manual') || currentPath.includes('manajemenuser') || currentPath.includes('profile');

            bottomNav.innerHTML = `
                <a href="/dashboard" class="mobile-bottom-item ${isDashboard ? 'active' : ''}">
                    <span class="bottom-icon">🏠</span>
                    <span class="bottom-label">Dashboard</span>
                </a>
                <a href="/manajemenmeeting" class="mobile-bottom-item ${isMeeting ? 'active' : ''}">
                    <span class="bottom-icon">📋</span>
                    <span class="bottom-label">Meeting</span>
                </a>
                <a href="/request-zoom" class="mobile-bottom-item ${isZoom ? 'active' : ''}">
                    <span class="bottom-icon">📹</span>
                    <span class="bottom-label">Zoom</span>
                </a>
                <a href="/infografis" class="mobile-bottom-item ${isInfografis ? 'active' : ''}">
                    <span class="bottom-icon">📊</span>
                    <span class="bottom-label">Infografis</span>
                </a>
                <button type="button" class="mobile-bottom-item ${isMore ? 'active' : ''}" id="btnBottomMore" onclick="toggleMobileMoreSheet()">
                    <span class="bottom-icon">⋯</span>
                    <span class="bottom-label">Lainnya</span>
                </button>
            `;

            document.body.appendChild(bottomNav);
        }

        // 3. Buat Pop-up Sheet "Lainnya"
        let moreSheet = document.getElementById('mobileMoreSheet');
        if (!moreSheet) {
            moreSheet = document.createElement('div');
            moreSheet.className = 'mobile-more-sheet';
            moreSheet.id = 'mobileMoreSheet';

            // Cek apakah admin (ada manajemen user di sidebar)
            const hasUserMgmt = !!sidebar.querySelector('a[href="/manajemenuser"]');
            const logoutLink = sidebar.querySelector('.sidebar-bottom .logout');
            const logoutOnclick = logoutLink ? (logoutLink.getAttribute('onclick') || '') : '';

            moreSheet.innerHTML = `
                <a href="/manual-book" class="mobile-more-item ${currentPath.includes('manual') ? 'active' : ''}">
                    <span>📖</span>
                    <span>Manual Book</span>
                </a>
                ${hasUserMgmt ? `
                <a href="/manajemenuser" class="mobile-more-item ${currentPath.includes('manajemenuser') ? 'active' : ''}">
                    <span>👥</span>
                    <span>Manajemen User</span>
                </a>` : ''}
                <a href="/profile" class="mobile-more-item ${currentPath.includes('profile') ? 'active' : ''}">
                    <span>⚙️</span>
                    <span>Format & Profil</span>
                </a>
                <div class="mobile-more-divider"></div>
                <a href="/" class="mobile-more-item logout-item" onclick="${logoutOnclick}">
                    <span>↪</span>
                    <span>Keluar</span>
                </a>
            `;

            moreSheet.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', function() {
                    window.closeMobileMoreSheet();
                });
            });

            document.body.appendChild(moreSheet);
        }

        // 4. Backdrop untuk menutup Pop-up Sheet
        let backdrop = document.getElementById('mobileBottomBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'mobile-bottom-backdrop';
            backdrop.id = 'mobileBottomBackdrop';
            backdrop.addEventListener('click', window.closeMobileMoreSheet);
            document.body.appendChild(backdrop);
        }

        // 5. ESC key menutup Pop-up
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                window.closeMobileMoreSheet();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        applySidebarState(getIsCollapsed());
        initMobileNav();

        // Keyboard Shortcut Ctrl+B atau Cmd+B
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                window.toggleSidebar();
            }
        });
    });
})();
