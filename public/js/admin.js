// e-Hadir KKPPS - Admin Panel Firebase Logic

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPA1p1KTESOts7JVVGDooQGVk9EP8oGi0",
  authDomain: "e-movement-kkpps.firebaseapp.com",
  projectId: "e-movement-kkpps",
  storageBucket: "e-movement-kkpps.firebasestorage.app",
  messagingSenderId: "61180910117",
  appId: "1:61180910117:web:354efb21bbdb0a74fbbdcc"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// Theme Setup
function initTheme(toggleId, iconId) {
    const themeToggle = document.getElementById(toggleId);
    const themeIcon = document.getElementById(iconId);
    if (!themeToggle || !themeIcon) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme, themeIcon, themeToggle);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme, themeIcon, themeToggle);
    });
}

function updateThemeUI(theme, iconEl, toggleEl) {
    if (theme === 'dark') {
        iconEl.textContent = 'light_mode';
        toggleEl.setAttribute('title', 'Tukar ke tema Cerah');
    } else {
        iconEl.textContent = 'dark_mode';
        toggleEl.setAttribute('title', 'Tukar ke tema Gelap');
    }
}

// ----------------------------------------------------
// 1. ADMIN LOGIN PAGE CONTROLLER
// ----------------------------------------------------
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

        if (!username || !password) {
            showLoginError('Sila isi semua medan.');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<div class="spinner" style="width:18px; height:18px; border-top-color:#fff;"></div>`;

        // Direct client side authentication matching secure token config
        if (username === 'admin' && password === 'admin123') {
            localStorage.setItem(ADMIN_TOKEN_KEY, ADMIN_SECURE_TOKEN);
            showToast('Log masuk Pentadbir berjaya!', 'success');
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 800);
        } else {
            showLoginError('Nama pengguna atau kata laluan salah.');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `
                <span class="material-symbols-outlined">admin_panel_settings</span>
                <span>Log Masuk</span>
            `;
        }
    });

    function showLoginError(msg) {
        errorText.textContent = msg;
        errorBox.style.display = 'flex';
    }
}

// ----------------------------------------------------
// 2. ADMIN DASHBOARD PAGE CONTROLLER
// ----------------------------------------------------
function initAdminDashboardPage() {
    initTheme('adminDashThemeToggle', 'adminDashThemeIcon');
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);

    // Guard Clause
    if (token !== ADMIN_SECURE_TOKEN) {
        window.location.href = 'admin_login.html';
        return;
    }

    const adminTableBody = document.getElementById('adminTableBody');
    const searchAdmin = document.getElementById('searchAdmin');
    const btnAddModal = document.getElementById('btnAddModal');
    const btnResetAll = document.getElementById('btnResetAll');
    const btnLogout = document.getElementById('btnAdminLogout');
    
    const addModal = document.getElementById('addModal');
    const editModal = document.getElementById('editModal');
    const addForm = document.getElementById('addLecturerForm');
    const editForm = document.getElementById('editLecturerForm');

    // Load initial list from Firestore
    loadAdminData();

    // Event Listeners
    searchAdmin.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderAdminTable();
    });

    // Add Modal Actions
    btnAddModal.addEventListener('click', () => openModal('addModal'));
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('addName').value.trim();
        const role = document.getElementById('addRole').value.trim();
        const phone = document.getElementById('addPhone').value.trim();
        const ic = document.getElementById('addIC').value.trim();

        const btnSave = addForm.querySelector('.btn-submit');
        btnSave.disabled = true;
        btnSave.innerHTML = `<div class="spinner" style="width:16px; height:16px; border-top-color:#fff;"></div>`;

        try {
            // Compute a new unique ID based on max ID
            const newId = lecturersList.length > 0 ? Math.max(...lecturersList.map(l => l.id)) + 1 : 1;
            const newDocRef = doc(db, "lecturers", newId.toString());

            await setDoc(newDocRef, {
                id: newId,
                name: name,
                role: role || "Pensyarah / Kakitangan",
                phone: phone,
                ic: ic,
                status: "Dalam Kampus",
                destination: "",
                waktu_keluar: "",
                waktu_kembali: "",
                updated_at: formatCurrentDateTime(new Date())
            });

            showToast('Kakitangan berjaya ditambah!', 'success');
            closeModal('addModal');
            addForm.reset();
            loadAdminData(); // Reload table
        } catch (err) {
            showToast('Gagal menambah rekod: ' + err.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = `
                <span class="material-symbols-outlined">save</span>
                <span>Simpan Rekod</span>
            `;
        }
    });

    // Edit Modal Actions
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editId').value;
        const name = document.getElementById('editName').value.trim();
        const role = document.getElementById('editRole').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const ic = document.getElementById('editIC').value.trim();

        const btnSave = editForm.querySelector('.btn-submit');
        btnSave.disabled = true;
        btnSave.innerHTML = `<div class="spinner" style="width:16px; height:16px; border-top-color:#fff;"></div>`;

        try {
            const docRef = doc(db, "lecturers", id.toString());

            await updateDoc(docRef, {
                name: name,
                role: role || "Pensyarah / Kakitangan",
                phone: phone,
                ic: ic,
                updated_at: formatCurrentDateTime(new Date())
            });

            showToast('Profil kakitangan berjaya dikemaskini!', 'success');
            closeModal('editModal');
            loadAdminData(); // Reload table
        } catch (err) {
            showToast('Gagal mengemaskini maklumat: ' + err.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = `
                <span class="material-symbols-outlined">save</span>
                <span>Simpan Perubahan</span>
            `;
        }
    });

    // Reset All statuses
    btnResetAll.addEventListener('click', async () => {
        if (!confirm('Adakah anda pasti mahu set semula (Reset) status SEMUA pensyarah kepada "Dalam Kampus"?')) return;

        btnResetAll.disabled = true;
        const originalText = btnResetAll.innerHTML;
        btnResetAll.innerHTML = `<div class="spinner" style="width:16px; height:16px; border-top-color:#fff; margin-right:0.25rem;"></div> Resetting...`;

        try {
            const batch = writeBatch(db);
            const collRef = collection(db, "lecturers");
            const snapshot = await getDocs(collRef);
            const dateStr = formatCurrentDateTime(new Date());

            snapshot.forEach(docSnap => {
                batch.update(docSnap.ref, {
                    status: "Dalam Kampus",
                    destination: "",
                    waktu_keluar: "",
                    waktu_kembali: "",
                    updated_at: dateStr
                });
            });

            await batch.commit();
            showToast('Semua status pensyarah berjaya di-reset!', 'success');
            loadAdminData(); // Reload table
        } catch (err) {
            showToast('Ralat set semula status: ' + err.message, 'error');
        } finally {
            btnResetAll.disabled = false;
            btnResetAll.innerHTML = originalText;
        }
    });

    // Admin Logout
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        showToast('Sesi pentadbir ditutup.', 'success');
        setTimeout(() => {
            window.location.href = 'admin_login.html';
        }, 800);
    });

    // Make functions globally available for inline onclick attributes in modal buttons
    window.closeModal = closeModal;
    window.editLecturer = editLecturer;
    window.deleteLecturer = deleteLecturer;
    window.resetLecturerStatus = resetLecturerStatus;
}

// ----------------------------------------------------
// ADMINISTRATOR OPERATIONS & RENDERING
// ----------------------------------------------------
async function loadAdminData() {
    showTableLoader();
    try {
        const collRef = collection(db, "lecturers");
        const snapshot = await getDocs(collRef);
        lecturersList = [];
        snapshot.forEach(doc => {
            lecturersList.push(doc.data());
        });
        renderAdminTable();
    } catch (e) {
        console.error("Gagal memuatkan data:", e);
        showToast('Gagal memuatkan data dari awan.', 'error');
    }
}

function showTableLoader() {
    const adminTableBody = document.getElementById('adminTableBody');
    if (!adminTableBody) return;
    adminTableBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 3rem 0;">
                <div class="spinner" style="margin: 0 auto 0.75rem auto; width: 30px; height: 30px; border-top-color: var(--danger);"></div>
                <span style="color: var(--text-muted); font-weight: 500;">Mengambil rekod terkini...</span>
            </td>
        </tr>
    `;
}

function renderAdminTable() {
    const adminTableBody = document.getElementById('adminTableBody');
    if (!adminTableBody) return;

    // Filter
    const filtered = lecturersList.filter(l => {
        const query = searchQuery.toLowerCase().trim();
        return query === '' || 
               l.name.toLowerCase().includes(query) || 
               l.role.toLowerCase().includes(query) ||
               l.ic.includes(query);
    });

    if (filtered.length === 0) {
        adminTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem 0; color: var(--text-muted);">
                    Tiada kakitangan ditemui.
                </td>
            </tr>
        `;
        return;
    }

    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    adminTableBody.innerHTML = filtered.map(l => {
        const isOut = l.status === 'Keluar';
        const statusBadgeClass = isOut ? 'status-out' : 'status-in';
        
        return `
            <tr>
                <td data-label="Nama" style="font-weight: 600; color: var(--text-color);">${l.name}</td>
                <td data-label="Jawatan/Unit">${l.role}</td>
                <td data-label="No. Telefon" style="font-family: monospace;">${l.phone || '-'}</td>
                <td data-label="No. IC" style="font-family: monospace; font-weight: 600;">${l.ic}</td>
                <td data-label="Status Semasa">
                    <span class="badge-status ${statusBadgeClass}" style="display:inline-flex; width:fit-content;">
                        <span class="pulse-dot" style="width: 5px; height: 5px; animation-duration: 2.5s;"></span>
                        <span>${l.status}</span>
                    </span>
                </td>
                <td data-label="Kemas Kini">${l.updated_at || '-'}</td>
                <td data-label="Tindakan">
                    <div class="table-actions">
                        <button class="action-btn edit-btn" onclick="editLecturer(${l.id})" title="Kemaskini Profil">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn reset-btn" onclick="resetLecturerStatus(${l.id})" title="Set Semula Status ke Dalam Kampus">
                            <span class="material-symbols-outlined">refresh</span>
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteLecturer(${l.id})" title="Padam Rekod">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// CRUD Button Callbacks
function editLecturer(id) {
    const l = lecturersList.find(item => item.id === id);
    if (!l) return;

    document.getElementById('editId').value = l.id;
    document.getElementById('editName').value = l.name;
    document.getElementById('editRole').value = l.role;
    document.getElementById('editPhone').value = l.phone || '';
    document.getElementById('editIC').value = l.ic;

    openModal('editModal');
}

async function deleteLecturer(id) {
    const l = lecturersList.find(item => item.id === id);
    if (!l) return;

    if (!confirm(`Adakah anda pasti mahu memadam rekod "${l.name}"? Pilihan ini tidak boleh diundurkan.`)) return;

    try {
        const docRef = doc(db, "lecturers", id.toString());
        await deleteDoc(docRef);
        showToast('Rekod pensyarah berjaya dipadam!', 'success');
        loadAdminData();
    } catch (err) {
        showToast('Gagal memadam rekod: ' + err.message, 'error');
    }
}

async function resetLecturerStatus(id) {
    const l = lecturersList.find(item => item.id === id);
    if (!l) return;

    try {
        const docRef = doc(db, "lecturers", id.toString());
        const dateStr = formatCurrentDateTime(new Date());

        await updateDoc(docRef, {
            status: "Dalam Kampus",
            destination: "",
            waktu_keluar: "",
            waktu_kembali: "",
            updated_at: dateStr
        });

        showToast(`Status "${l.name}" berjaya di-reset!`, 'success');
        loadAdminData();
    } catch (err) {
        showToast('Gagal set semula status: ' + err.message, 'error');
    }
}

// Modal Toggle Helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Date helper: "30-06-2026 03:40 PM"
function formatCurrentDateTime(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`;
}

// Live Time Widget
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

// Toast Notification Widget
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'check_circle';
    if (type === 'error') icon = 'cancel';
    
    toast.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
