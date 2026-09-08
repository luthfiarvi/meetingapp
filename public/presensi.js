// ===================================
// PRESENSI & TANDA TANGAN CONTROLLER
// ===================================

const form = document.getElementById("presensiForm");
const tandaTanganInput = document.getElementById("tandaTangan");
const submitButton = document.getElementById("submitPresensiBtn") || (form ? form.querySelector("button[type='submit']") : null);

// --- TAB ELEMENTS ---
const sigTabBtns = document.querySelectorAll(".sig-tab-btn");
const sigPanelCanvas = document.getElementById("sigPanelCanvas");
const sigPanelUpload = document.getElementById("sigPanelUpload");

let currentSigMode = "canvas"; // 'canvas' | 'upload'

// --- CANVAS ELEMENTS & STATE ---
const canvas = document.getElementById("signatureCanvas");
const signatureWrapper = document.getElementById("signatureWrapper");
const signatureHint = document.getElementById("signatureHint");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");

let ctx = null;
let isDrawing = false;
let hasCanvasSignature = false;
let lastX = 0;
let lastY = 0;

// --- UPLOAD ELEMENTS & STATE ---
const uploadZone = document.getElementById("uploadZone");
const sigFileInput = document.getElementById("sigFileInput");
const uploadEmpty = document.getElementById("uploadEmpty");
const uploadPreview = document.getElementById("uploadPreview");
const uploadPreviewImg = document.getElementById("uploadPreviewImg");
const removeUploadBtn = document.getElementById("removeUploadBtn");

let uploadedSignatureData = "";

// --- MODAL ELEMENTS ---
const modalBackdrop = document.getElementById("modalBackdrop");
const modalIconSuccess = document.getElementById("modalIconSuccess");
const modalIconWarning = document.getElementById("modalIconWarning");
const modalIconError = document.getElementById("modalIconError");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalInfoBox = document.getElementById("modalInfoBox");
const modalInfoNama = document.getElementById("modalInfoNama");
const modalInfoWaktu = document.getElementById("modalInfoWaktu");
const modalBtnClose = document.getElementById("modalBtnClose");

let modalCallback = null;

// ===================================
// 1. CANVAS DRAWING SETUP (FIXED & HIGH-DPI)
// ===================================

function initCanvas() {
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Preserve current signature if any
        let savedData = null;
        if (hasCanvasSignature && canvas.width > 0 && canvas.height > 0) {
            savedData = canvas.toDataURL();
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);

        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = "#0f172a";

        if (savedData) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
            };
            img.src = savedData;
        }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDraw(e) {
        if (e.type.startsWith("touch")) e.preventDefault();
        
        isDrawing = true;
        const pos = getCanvasPos(e);
        lastX = pos.x;
        lastY = pos.y;

        // Draw an initial point/dot
        ctx.beginPath();
        ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        hasCanvasSignature = true;
        if (signatureHint) signatureHint.classList.add("hidden");
    }

    function moveDraw(e) {
        if (!isDrawing) return;
        if (e.type.startsWith("touch")) e.preventDefault();

        const pos = getCanvasPos(e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        lastX = pos.x;
        lastY = pos.y;
    }

    function endDraw(e) {
        if (isDrawing) {
            isDrawing = false;
        }
    }

    // Pointer & Mouse Events (Keeps crosshair cursor visible)
    canvas.addEventListener("mousedown", startDraw);
    window.addEventListener("mousemove", (e) => {
        if (isDrawing) moveDraw(e);
    });
    window.addEventListener("mouseup", endDraw);

    // Touch Events for mobile & tablet
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", endDraw);
    canvas.addEventListener("touchcancel", endDraw);
}

function clearCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasCanvasSignature = false;
    if (signatureHint) signatureHint.classList.remove("hidden");
}

if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener("click", clearCanvas);
}

// ===================================
// 2. TABS CONTROLLER (CANVAS vs UPLOAD)
// ===================================

sigTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        currentSigMode = tab;

        sigTabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (sigPanelCanvas) sigPanelCanvas.style.display = tab === "canvas" ? "block" : "none";
        if (sigPanelUpload) sigPanelUpload.style.display = tab === "upload" ? "block" : "none";

        if (tab === "canvas") {
            setTimeout(() => {
                initCanvas();
            }, 50);
        }
    });
});

// ===================================
// 3. UPLOAD FILE CONTROLLER
// ===================================

if (uploadZone && sigFileInput) {
    uploadZone.addEventListener("click", (e) => {
        if (e.target !== removeUploadBtn && !removeUploadBtn?.contains(e.target)) {
            sigFileInput.click();
        }
    });

    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragover");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });

    sigFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUploadedFile(e.target.files[0]);
        }
    });
}

function handleUploadedFile(file) {
    if (!file.type.startsWith("image/")) {
        showModal({
            type: "warning",
            title: "Format File Tidak Sesuai",
            message: "Silakan unggah file gambar berformat PNG, JPG, atau JPEG."
        });
        return;
    }

    if (file.size > 3 * 1024 * 1024) {
        showModal({
            type: "warning",
            title: "Ukuran File Terlalu Besar",
            message: "Ukuran gambar tanda tangan maksimal 3 MB."
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        uploadedSignatureData = event.target.result;
        if (uploadPreviewImg) uploadPreviewImg.src = uploadedSignatureData;
        if (uploadEmpty) uploadEmpty.style.display = "none";
        if (uploadPreview) uploadPreview.style.display = "flex";
    };
    reader.readAsDataURL(file);
}

if (removeUploadBtn) {
    removeUploadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        uploadedSignatureData = "";
        if (sigFileInput) sigFileInput.value = "";
        if (uploadPreview) uploadPreview.style.display = "none";
        if (uploadEmpty) uploadEmpty.style.display = "block";
    });
}

// ===================================
// 4. MODAL HELPER SYSTEM
// ===================================

function showModal({ type = "success", title, message, nama, waktu, callback }) {
    if (!modalBackdrop) return;

    modalCallback = callback || null;

    if (modalIconSuccess) modalIconSuccess.style.display = type === "success" ? "flex" : "none";
    if (modalIconWarning) modalIconWarning.style.display = type === "warning" ? "flex" : "none";
    if (modalIconError) modalIconError.style.display = type === "error" ? "flex" : "none";

    if (modalTitle) modalTitle.textContent = title || (type === "success" ? "Presensi Berhasil!" : "Pemberitahuan");
    if (modalDesc) modalDesc.textContent = message || "";

    if (nama || waktu) {
        if (modalInfoBox) modalInfoBox.style.display = "flex";
        if (modalInfoNama) modalInfoNama.textContent = nama || "-";
        if (modalInfoWaktu) modalInfoWaktu.textContent = waktu || "-";
    } else {
        if (modalInfoBox) modalInfoBox.style.display = "none";
    }

    modalBackdrop.classList.add("show");
    modalBackdrop.setAttribute("aria-hidden", "false");
}

function hideModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("show");
    modalBackdrop.setAttribute("aria-hidden", "true");

    if (typeof modalCallback === "function") {
        const cb = modalCallback;
        modalCallback = null;
        cb();
    }
}

if (modalBtnClose) {
    modalBtnClose.addEventListener("click", hideModal);
}

if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            hideModal();
        }
    });
}

// Check server flash on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    initCanvas();

    const serverState = document.getElementById("serverState");
    if (serverState) {
        const successMsg = serverState.getAttribute("data-success");
        const errorMsg = serverState.getAttribute("data-error");

        if (successMsg) {
            showModal({
                type: "success",
                title: "Presensi Berhasil!",
                message: successMsg
            });
            if (window.history.replaceState) {
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
            }
        } else if (errorMsg) {
            showModal({
                type: "error",
                title: "Gagal Mengisi Presensi",
                message: errorMsg
            });
        }
    }
});

// ===================================
// 5. FORM SUBMISSION
// ===================================

if (form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const namaInput = form.querySelector("#nama");
        if (namaInput && !namaInput.value.trim()) {
            showModal({
                type: "warning",
                title: "Nama Lengkap Wajib Diisi",
                message: "Silakan masukkan nama lengkap Anda terlebih dahulu."
            });
            namaInput.focus();
            return;
        }

        // Determine signature data based on active mode
        let finalSignature = "";

        if (currentSigMode === "canvas") {
            if (!hasCanvasSignature) {
                showModal({
                    type: "warning",
                    title: "Tanda Tangan Diperlukan",
                    message: "Silakan goreskan tanda tangan Anda pada canvas, atau pilih tab 'Unggah Gambar Tanda Tangan'."
                });
                return;
            }
            finalSignature = canvas.toDataURL("image/png");
        } else if (currentSigMode === "upload") {
            if (!uploadedSignatureData) {
                showModal({
                    type: "warning",
                    title: "Gambar Tanda Tangan Diperlukan",
                    message: "Silakan pilih atau seret file gambar tanda tangan Anda."
                });
                return;
            }
            finalSignature = uploadedSignatureData;
        }

        if (tandaTanganInput) {
            tandaTanganInput.value = finalSignature;
        }

        // Button loading state
        const originalBtnHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="btn-spinner"></span> Menyimpan Presensi...`;

        const formData = {
            meeting_id: form.querySelector("input[name='meeting_id']")?.value || "",
            nama: form.querySelector("#nama")?.value.trim() || "",
            nip: form.querySelector("#nip")?.value.trim() || "",
            instansi: form.querySelector("#instansi")?.value.trim() || "",
            jabatan: form.querySelector("#jabatan")?.value.trim() || "",
            email: form.querySelector("#email")?.value.trim() || "",
            keterangan: form.querySelector("#keterangan")?.value.trim() || "",
            tanda_tangan: finalSignature
        };

        try {
            const response = await fetch("/presensi", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showModal({
                    type: "success",
                    title: "Presensi Berhasil!",
                    message: "Terima kasih, data kehadiran Anda telah berhasil tercatat dalam sistem.",
                    nama: formData.nama,
                    waktu: result.data?.waktu_presensi || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                });

                // Reset form fields and signature states
                form.reset();
                clearCanvas();
                uploadedSignatureData = "";
                if (uploadPreview) uploadPreview.style.display = "none";
                if (uploadEmpty) uploadEmpty.style.display = "block";

            } else {
                showModal({
                    type: "error",
                    title: "Gagal Menyimpan",
                    message: result.message || "Terjadi kesalahan saat menyimpan presensi. Silakan coba lagi."
                });
            }
        } catch (err) {
            console.error("Error submitting presensi:", err);
            showModal({
                type: "error",
                title: "Koneksi Terganggu",
                message: "Tidak dapat terhubung ke server. Pastikan jaringan atau server aktif."
            });
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalBtnHtml;
        }
    });
}


