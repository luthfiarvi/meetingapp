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

    document.addEventListener('DOMContentLoaded', function() {
        applySidebarState(getIsCollapsed());

        // Keyboard Shortcut Ctrl+B atau Cmd+B
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                window.toggleSidebar();
            }
        });
    });
})();
