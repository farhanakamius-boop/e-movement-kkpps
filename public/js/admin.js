// e-Hadir KKPPS - Admin Scripting (Login & Management Panel)

const API_ADMIN_LOGIN = '/api/admin/login';
const API_ADMIN_LECTURERS = '/api/admin/lecturers';
const API_ADMIN_ADD = '/api/admin/add_lecturer';
const API_ADMIN_UPDATE = '/api/admin/update_lecturer';
const API_ADMIN_DELETE = '/api/admin/delete_lecturer';
const API_ADMIN_RESET_ALL = '/api/admin/reset_all';
const API_ADMIN_RESET_SINGLE = '/api/admin/reset_single';

const ADMIN_TOKEN_KEY = 'kkpps_admin_token';
const ADMIN_SECURE_TOKEN = 'admin_secure_token_kkpps_2026';

let lecturersList = [];
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminTableBody = document.getElementById('adminTableBody');

    // Run clock on all pages
    updateLiveTime();
    setInterval(updateLiveTime, 1000);

    if (adminLoginForm) {
        initAdminLoginPage();
    } else if (adminTableBody) {
        initAdminDashboardPage();
    }
});

// ==========================================
// 1. ADMIN LOGIN PAGE CONTROLLER
// ==========================================
function initAdminLoginPage() {
    initTheme('adminThemeToggle', 'adminThemeIcon');
    const form = document.getElementById('adminLoginForm');
    const errorBox = document.getElementById('adminLoginError');
    const errorText = document.getElementById('adminErrorText');
    const btnSubmit = document.getElementById('btnAdminSubmit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('usernameInput').value.trim();
        const password = document.getElementById('passwordInput').value.trim();

        errorBox.style.display = 'none';
        btnSubmit.disabled = true;
        const origText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<div class="spinner"></div><span>Memproses...</span>';

        try {
            const response = await fetch(API_ADMIN_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const res = await response.json();

            if (response.ok && res.success) {
                localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
                showToast('Log masuk Pentadbir berjaya!', 'success');
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 800);
            } else {
                throw new Error(res.message || 'Log masuk gagal');
            }
        } catch (error) {
            console.error(error);
            errorText.textContent = error.message;
            errorBox.style.display = 'flex';
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origText;
        }
    });
}

// ==========================================
// 2. ADMIN DASHBOARD PAGE CONTROLLER
// ==========================================
async function initAdminDashboardPage() {
    initTheme('adminPanelThemeToggle', 'adminPanelThemeIcon');

    // Admin Session Guard
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token !== ADMIN_SECURE_TOKEN) {
        window.location.href = 'admin_login.html';
        return;
    }

    // Set up toolbar elements
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');
    const btnTriggerResetAll = document.getElementById('btnTriggerResetAll');
    const adminSearchInput = document.getElementById('adminSearchInput');
    const addForm = document.getElementById('addLecturerForm');
    const editForm = document.getElementById('editLecturerForm');
    const btnAdminLogout = document.getElementById('btnAdminLogout');

    // Fetch initial list
    fetchAdminLecturers();

    // Event listeners
    btnOpenAddModal.addEventListener('click', () => openModal('addModal'));
    
    adminSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderAdminTable();
    });

    // Add Form Submit
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('addName').value.trim();
        const role = document.getElementById('addRole').value.trim();
        const phone = document.getElementById('addPhone').value.trim();
        const ic = document.getElementById('addIC').value.trim();

        try {
            const response = await fetch(API_ADMIN_ADD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, name, role, phone, ic })
            });

            const res = await response.json();
            if (response.ok && res.success) {
                showToast(res.message || 'Pensyarah berjaya ditambah!', 'success');
                addForm.reset();
                closeModal('addModal');
                fetchAdminLecturers(); // Reload list
            } else {
                throw new Error(res.message || 'Gagal menambah pensyarah');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    });

    // Edit Form Submit
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('editId').value);
        const name = document.getElementById('editName').value.trim();
        const role = document.getElementById('editRole').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const ic = document.getElementById('editIC').value.trim();

        try {
            const response = await fetch(API_ADMIN_UPDATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, id, name, role, phone, ic })
            });

            const res = await response.json();
            if (response.ok && res.success) {
                showToast(res.message || 'Profil berjaya dikemaskini!', 'success');
                closeModal('editModal');
                fetchAdminLecturers();
            } else {
                throw new Error(res.message || 'Gagal menyimpan perubahan');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    });

    // Reset All Statuses
    btnTriggerResetAll.addEventListener('click', async () => {
        if (!confirm('Adakah anda pasti mahu set semula SEMUA status pensyarah kembali ke "Dalam Kampus"?')) return;

        try {
            const response = await fetch(API_ADMIN_RESET_ALL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const res = await response.json();
            if (response.ok && res.success) {
                showToast(res.message, 'success');
                fetchAdminLecturers();
            } else {
                throw new Error(res.message || 'Gagal reset status');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    });

    // Logout
    btnAdminLogout.addEventListener('click', () => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        showToast('Berjaya log keluar daripada Panel Pentadbir.', 'success');
        setTimeout(() => {
            window.location.href = 'admin_login.html';
        }, 600);
    });
}

// Fetch lists from Admin endpoint (includes IC numbers)
async function fetchAdminLecturers() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    try {
        const response = await fetch(`${API_ADMIN_LECTURERS}?token=${token}`);
        if (!response.ok) throw new Error('Tiada kebenaran untuk mengakses directory.');
        
        lecturersList = await response.json();
        updateAdminStats();
        renderAdminTable();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
        document.getElementById('adminTableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--danger); padding: 3rem; font-weight: 700;">
                    ${error.message}. Sila log masuk semula.
                </td>
            </tr>
        `;
    }
}

function updateAdminStats() {
    const total = lecturersList.length;
    const inCampus = lecturersList.filter(l => l.status === 'Dalam Kampus').length;
    const outCampus = total - inCampus;
    
    document.getElementById('adminStatTotal').textContent = total;
    document.getElementById('adminStatIn').textContent = inCampus;
    document.getElementById('adminStatOut').textContent = outCampus;
}

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    
    const filteredList = lecturersList.filter(lecturer => {
        const query = searchQuery.toLowerCase().trim();
        return query === '' || 
            lecturer.name.toLowerCase().includes(query) || 
            lecturer.role.toLowerCase().includes(query) ||
            lecturer.ic.toLowerCase().includes(query);
    });

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                    Tiada rekod pensyarah dijumpai bagi carian "${searchQuery}"
                </td>
            </tr>
        `;
        return;
    }

    // Sort alphabetically by name
    filteredList.sort((a, b) => a.name.localeCompare(b.name));

    tbody.innerHTML = filteredList.map((lecturer, index) => {
        const isOut = lecturer.status === 'Keluar';
        const badgeColorClass = isOut ? 'badge-status status-out' : 'badge-status status-in';
        const statusLabel = isOut ? `Keluar (${lecturer.destination || '-'})` : 'Dalam Kampus';
        
        // Custom background style for badges based on state
        const badgeStyle = isOut 
            ? 'background: var(--warning-light); color: var(--warning); padding: 0.25rem 0.6rem; border-radius: 8px;' 
            : 'background: var(--success-light); color: var(--success); padding: 0.25rem 0.6rem; border-radius: 8px;';

        return `
            <tr>
                <td style="font-weight: 700;">${index + 1}</td>
                <td>
                    <div style="font-weight: 700; color: var(--text-main);">${lecturer.name}</div>
                </td>
                <td style="color: var(--text-muted);">${lecturer.role}</td>
                <td>${lecturer.phone || '<span style="color:var(--text-muted); font-style:italic;">Tiada</span>'}</td>
                <td style="font-family: monospace; font-size: 0.85rem; letter-spacing: 0.5px;">${lecturer.ic}</td>
                <td>
                    <span style="${badgeStyle} font-weight:700; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.25rem;">
                        <span class="pulse-dot" style="width:6px; height:6px; background-color:${isOut ? 'var(--warning)' : 'var(--success)'};"></span>
                        <span>${statusLabel}</span>
                    </span>
                </td>
                <td>
                    <div class="admin-action-btns">
                        <button class="admin-btn-action edit" onclick="triggerEdit(${lecturer.id})" title="Kemaskini data staf">
                            <span class="material-symbols-outlined" style="font-size:1rem;">edit</span>
                            <span>Edit</span>
                        </button>
                        <button class="admin-btn-action reset" onclick="triggerSingleReset(${lecturer.id})" title="Set semula status ke Dalam Kampus">
                            <span class="material-symbols-outlined" style="font-size:1rem;">restart_alt</span>
                            <span>Reset</span>
                        </button>
                        <button class="admin-btn-action delete" onclick="triggerDelete(${lecturer.id})" title="Padam staf daripada rekod">
                            <span class="material-symbols-outlined" style="font-size:1rem;">delete</span>
                            <span>Padam</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 3. ACTION EVENT TRIGGERS
// ==========================================
window.triggerEdit = function(id) {
    const lecturer = lecturersList.find(l => l.id === id);
    if (!lecturer) return;

    // Populate edit modal fields
    document.getElementById('editId').value = lecturer.id;
    document.getElementById('editName').value = lecturer.name;
    document.getElementById('editRole').value = lecturer.role;
    document.getElementById('editPhone').value = lecturer.phone || '';
    document.getElementById('editIC').value = lecturer.ic;

    openModal('editModal');
};

window.triggerSingleReset = async function(id) {
    const lecturer = lecturersList.find(l => l.id === id);
    if (!lecturer) return;

    if (!confirm(`Adakah anda pasti mahu set semula status "${lecturer.name}" kembali ke "Dalam Kampus"?`)) return;

    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    try {
        const response = await fetch(API_ADMIN_RESET_SINGLE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, id })
        });

        const res = await response.json();
        if (response.ok && res.success) {
            showToast(res.message, 'success');
            fetchAdminLecturers();
        } else {
            throw new Error(res.message || 'Gagal reset status');
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
};

window.triggerDelete = async function(id) {
    const lecturer = lecturersList.find(l => l.id === id);
    if (!lecturer) return;

    if (!confirm(`PERINGATAN: Adakah anda pasti mahu memadam rekod "${lecturer.name}" sepenuhnya daripada sistem?`)) return;

    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    try {
        const response = await fetch(API_ADMIN_DELETE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, id })
        });

        const res = await response.json();
        if (response.ok && res.success) {
            showToast(res.message, 'success');
            fetchAdminLecturers();
        } else {
            throw new Error(res.message || 'Gagal memadam staf');
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
};

// ==========================================
// 4. UTILITIES & HELPERS
// ==========================================
window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add('active');
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

// Handle clicks outside modal to close it
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

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

function updateLiveTime() {
    const liveDateEl = document.getElementById('liveDate');
    const liveTimeEl = document.getElementById('liveTime');
    if (!liveDateEl || !liveTimeEl) return;

    const now = new Date();
    
    const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('ms-MY', optionsDate);
    
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const timeStr = now.toLocaleTimeString('ms-MY', optionsTime).toUpperCase();
    
    liveDateEl.textContent = dateStr;
    liveTimeEl.textContent = timeStr;
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
