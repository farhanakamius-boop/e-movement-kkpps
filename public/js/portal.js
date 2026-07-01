// e-Hadir KKPPS - Lecturer Portal Scripting (Login & Control Panel)

const API_LOGIN = '/api/login';
const API_STATUS = '/api/status';
const API_LECTURERS = '/api/lecturers';

document.addEventListener('DOMContentLoaded', () => {
    // Detect which page is loaded
    const loginForm = document.getElementById('loginForm');
    const statusForm = document.getElementById('statusForm');

    if (loginForm) {
        initLoginPage();
    } else if (statusForm) {
        initPortalPage();
    }
});

// ==========================================
// 1. LOGIN PAGE CONTROLLERS
// ==========================================
async function initLoginPage() {
    initTheme('authThemeToggle', 'authThemeIcon');
    const lecturerSelect = document.getElementById('lecturerSelect');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const errorText = document.getElementById('errorText');
    const btnSubmit = document.getElementById('btnSubmit');

    // Populate dropdown with lecturers from CSV API
    try {
        const response = await fetch(API_LECTURERS);
        if (!response.ok) throw new Error('Gagal mendapatkan senarai pensyarah.');
        
        const lecturers = await response.json();
        
        // Clear placeholder
        lecturerSelect.innerHTML = '<option value="" disabled selected>Pilih nama anda...</option>';
        
        // Sort lecturers alphabetically by name
        lecturers.sort((a, b) => a.name.localeCompare(b.name));
        
        lecturers.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = `${l.name} (${l.role})`;
            lecturerSelect.appendChild(opt);
        });
    } catch (error) {
        console.error(error);
        lecturerSelect.innerHTML = '<option value="" disabled>Gagal memuatkan nama staf</option>';
        showToast('Ralat memuatkan pangkalan data. Sila refresh.', 'error');
    }

    // Submit handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const lecturerId = lecturerSelect.value;
        const icVal = document.getElementById('icInput').value.trim();
        
        if (!lecturerId || !icVal) return;

        // Visual loading state
        loginError.style.display = 'none';
        btnSubmit.disabled = true;
        const origSubmitText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<div class="spinner"></div><span>Menghubung...</span>';

        try {
            const response = await fetch(API_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lecturerId, ic: icVal })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Store session
                localStorage.setItem('kkpps_lecturer_id', result.lecturer.id);
                localStorage.setItem('kkpps_lecturer_name', result.lecturer.name);
                localStorage.setItem('kkpps_lecturer_role', result.lecturer.role);
                localStorage.setItem('kkpps_token', result.token);

                showToast('Log masuk berjaya!', 'success');
                setTimeout(() => {
                    window.location.href = 'portal.html';
                }, 800);
            } else {
                throw new Error(result.message || 'Log masuk gagal');
            }
        } catch (error) {
            console.error(error);
            errorText.textContent = error.message;
            loginError.style.display = 'flex';
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origSubmitText;
        }
    });
}

// ==========================================
// 2. PORTAL PANEL CONTROLLERS
// ==========================================
async function initPortalPage() {
    initTheme('portalThemeToggle', 'portalThemeIcon');

    // Page session guard
    const lecturerId = localStorage.getItem('kkpps_lecturer_id');
    const token = localStorage.getItem('kkpps_token');
    const lecturerName = localStorage.getItem('kkpps_lecturer_name');
    const lecturerRole = localStorage.getItem('kkpps_lecturer_role');

    if (!lecturerId || !token) {
        // Redirect to login if session missing
        window.location.href = 'login.html';
        return;
    }

    // Populate header UI details
    document.getElementById('portalLecturerName').textContent = lecturerName;
    document.getElementById('portalLecturerRole').textContent = lecturerRole;
    document.getElementById('portalAvatar').textContent = getInitials(lecturerName);

    // Form inputs and triggers
    const statusIn = document.getElementById('statusIn');
    const statusOut = document.getElementById('statusOut');
    const outDetailsForm = document.getElementById('outDetailsForm');
    const destinationInput = document.getElementById('destinationInput');
    const waktuKeluarInput = document.getElementById('waktuKeluarInput');
    const waktuKembaliInput = document.getElementById('waktuKembaliInput');
    const statusForm = document.getElementById('statusForm');
    const btnSaveStatus = document.getElementById('btnSaveStatus');
    const btnLogout = document.getElementById('btnLogout');

    // Load active status details from server database
    try {
        const response = await fetch(API_LECTURERS);
        if (response.ok) {
            const list = await response.json();
            const self = list.find(l => l.id === parseInt(lecturerId));
            
            if (self) {
                // Populate existing records
                if (self.status === 'Keluar') {
                    statusOut.checked = true;
                    outDetailsForm.classList.add('active');
                    destinationInput.value = self.destination || '';
                    waktuKeluarInput.value = self.waktu_keluar || '';
                    waktuKembaliInput.value = self.waktu_kembali || '';
                } else {
                    statusIn.checked = true;
                    outDetailsForm.classList.remove('active');
                }
            }
        }
    } catch (e) {
        console.error("Gagal mendapatkan status sedia ada:", e);
    }

    // Toggle fields based on status option selected
    statusIn.addEventListener('change', () => {
        if (statusIn.checked) outDetailsForm.classList.remove('active');
    });

    statusOut.addEventListener('change', () => {
        if (statusOut.checked) outDetailsForm.classList.add('active');
    });

    // Handle Form Submit
    statusForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const statusValue = statusIn.checked ? 'Dalam Kampus' : 'Keluar';
        const destVal = destinationInput.value.trim();
        const wKeluar = waktuKeluarInput.value.trim();
        const wKembali = waktuKembaliInput.value.trim();

        if (statusValue === 'Keluar' && (!destVal || !wKeluar || !wKembali)) {
            showToast('Sila isikan destinasi, waktu keluar dan jangka kembali.', 'error');
            return;
        }

        // Show spinner state
        btnSaveStatus.disabled = true;
        const origText = btnSaveStatus.innerHTML;
        btnSaveStatus.innerHTML = '<div class="spinner"></div><span>Menyimpan...</span>';

        try {
            const response = await fetch(API_STATUS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(lecturerId),
                    token: token,
                    status: statusValue,
                    destination: statusValue === 'Keluar' ? destVal : '',
                    waktu_keluar: statusValue === 'Keluar' ? wKeluar : '',
                    waktu_kembali: statusValue === 'Keluar' ? wKembali : ''
                })
            });

            const res = await response.json();

            if (response.ok && res.success) {
                showToast('Status anda berjaya dikemaskini!', 'success');
            } else {
                throw new Error(res.message || 'Gagal menyimpan status');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            btnSaveStatus.disabled = false;
            btnSaveStatus.innerHTML = origText;
        }
    });

    // Handle Logout
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('kkpps_lecturer_id');
        localStorage.removeItem('kkpps_lecturer_name');
        localStorage.removeItem('kkpps_lecturer_role');
        localStorage.removeItem('kkpps_token');
        showToast('Berjaya log keluar.', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 600);
    });
}

// ==========================================
// 3. UTILITIES & HELPER FUNCTIONS
// ==========================================
function initTheme(btnId, iconId) {
    const btn = document.getElementById(btnId);
    const icon = document.getElementById(iconId);
    if (!btn || !icon) return;

    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    icon.textContent = currentTheme === 'dark' ? 'light_mode' : 'dark_mode';

    btn.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('theme', nextTheme);
        icon.textContent = nextTheme === 'dark' ? 'light_mode' : 'dark_mode';
    });
}

function getInitials(name) {
    if (!name) return 'S';
    let cleaned = name.toUpperCase()
        .replace(/^(TS\.|DR\.|HJ\.|HAJI|PUAN|EN\.|ENCIK)\s+/i, '')
        .trim();
        
    const parts = cleaned.split(' ');
    if (parts.length > 1) {
        return parts[0][0] + parts[1][0];
    }
    return parts[0].substring(0, 2);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Animate and remove
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
