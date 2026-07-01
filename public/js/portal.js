// e-Hadir KKPPS - Lecturer Portal Firebase Scripting

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, collection, getDocs, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const LECTURER_ID_KEY = 'kkpps_lecturer_id';
const LECTURER_TOKEN_KEY = 'kkpps_lecturer_token';
const LECTURER_NAME_KEY = 'kkpps_lecturer_name';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const portalSection = document.getElementById('portalSection');

    // Run live clocks
    updateLiveTime();
    setInterval(updateLiveTime, 1000);

    if (loginForm) {
        initLoginPage();
    } else if (portalSection) {
        initPortalPage();
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
// 1. LECTURER LOGIN PAGE
// ----------------------------------------------------
async function initLoginPage() {
    initTheme('loginThemeToggle', 'loginThemeIcon');
    const select = document.getElementById('lecturerSelect');
    const form = document.getElementById('loginForm');
    const btnSubmit = document.getElementById('btnLoginSubmit');
    const errorBox = document.getElementById('loginError');
    const errorText = document.getElementById('errorText');

    // Load lecturer list for selection dropdown
    try {
        const collRef = collection(db, "lecturers");
        const snapshot = await getDocs(collRef);
        const lecturers = [];
        snapshot.forEach(doc => lecturers.push(doc.data()));

        if (lecturers.length === 0) {
            select.innerHTML = '<option value="">Tiada rekod (Gagal menyemai database)</option>';
            return;
        }

        // Sort alphabetically
        lecturers.sort((a, b) => a.name.localeCompare(b.name));

        select.innerHTML = '<option value="">Pilih Nama Anda...</option>' + 
            lecturers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            
        select.disabled = false;
        btnSubmit.disabled = false;
    } catch (e) {
        console.error("Gagal menyambung ke Firestore:", e);
        showToast('Ralat sambungan pangkalan data.', 'error');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idVal = select.value;
        const icVal = document.getElementById('icInput').value.trim();

        if (!idVal || !icVal) {
            showLoginError('Sila pilih nama dan masukkan No. IC');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<div class="spinner" style="width:18px; height:18px; border-top-color:#fff;"></div>`;

        try {
            // Retrieve targeted lecturer from Firestore
            const docRef = doc(db, "lecturers", idVal);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const lecturer = docSnap.data();
                
                // Compare cleaned ICs
                const cleanDbIc = lecturer.ic.replace(/[-\s]/g, '');
                const cleanInputIc = icVal.replace(/[-\s]/g, '');

                if (cleanDbIc === cleanInputIc) {
                    // Save Session details
                    localStorage.setItem(LECTURER_ID_KEY, lecturer.id);
                    localStorage.setItem(LECTURER_TOKEN_KEY, lecturer.ic);
                    localStorage.setItem(LECTURER_NAME_KEY, lecturer.name);

                    showToast('Log masuk berjaya!', 'success');
                    setTimeout(() => {
                        window.location.href = 'portal.html';
                    }, 800);
                    return;
                }
            }
            showLoginError('No. IC tidak sepadan dengan rekod pensyarah');
        } catch (err) {
            showLoginError('Sistem tergendala: ' + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `
                <span class="material-symbols-outlined">login</span>
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
// 2. LECTURER PORTAL PAGE
// ----------------------------------------------------
async function initPortalPage() {
    initTheme('portalThemeToggle', 'portalThemeIcon');
    const lecturerId = localStorage.getItem(LECTURER_ID_KEY);
    const lecturerToken = localStorage.getItem(LECTURER_TOKEN_KEY);
    const lecturerName = localStorage.getItem(LECTURER_NAME_KEY);

    if (!lecturerId || !lecturerToken) {
        window.location.href = 'login.html';
        return;
    }

    // Display greeting
    document.getElementById('greetingName').textContent = lecturerName;

    const selectStatus = document.getElementById('statusSelect');
    const keluarFields = document.getElementById('keluarFields');
    const destInput = document.getElementById('destinationInput');
    const waktuKeluarInput = document.getElementById('waktuKeluarInput');
    const waktuKembaliInput = document.getElementById('waktuKembaliInput');
    const form = document.getElementById('statusForm');
    const btnSave = document.getElementById('btnSaveStatus');
    const logoutBtn = document.getElementById('btnLogout');

    // Retrieve current status
    try {
        const docRef = doc(db, "lecturers", lecturerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Populate form
            selectStatus.value = data.status || 'Dalam Kampus';
            toggleKeluarFields(selectStatus.value);
            
            destInput.value = data.destination || '';
            waktuKeluarInput.value = data.waktu_keluar || '';
            waktuKembaliInput.value = data.waktu_kembali || '';
        } else {
            showToast('Rekod pensyarah tidak dijumpai.', 'error');
        }
    } catch (e) {
        showToast('Gagal memuatkan status dari awan.', 'error');
    }

    selectStatus.addEventListener('change', () => {
        toggleKeluarFields(selectStatus.value);
    });

    // Save Status
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        btnSave.disabled = true;
        btnSave.innerHTML = `<div class="spinner" style="width:18px; height:18px; border-top-color:#fff;"></div>`;

        const status = selectStatus.value;
        const dest = status === 'Keluar' ? destInput.value.trim() : '';
        const wKeluar = status === 'Keluar' ? waktuKeluarInput.value.trim() : '';
        const wKembali = status === 'Keluar' ? waktuKembaliInput.value.trim() : '';

        try {
            const docRef = doc(db, "lecturers", lecturerId);
            const dateStr = formatCurrentDateTime(new Date());

            await updateDoc(docRef, {
                status: status,
                destination: dest,
                waktu_keluar: wKeluar,
                waktu_kembali: wKembali,
                updated_at: dateStr
            });

            showToast('Status kehadiran berjaya dikemas kini!', 'success');
        } catch (err) {
            showToast('Gagal menyimpan status: ' + err.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = `
                <span class="material-symbols-outlined">save</span>
                <span>Simpan Kehadiran</span>
            `;
        }
    });

    // Logout
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem(LECTURER_ID_KEY);
        localStorage.removeItem(LECTURER_TOKEN_KEY);
        localStorage.removeItem(LECTURER_NAME_KEY);
        showToast('Sesi ditutup. Sila log masuk semula.', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
    });

    function toggleKeluarFields(status) {
        if (status === 'Keluar') {
            keluarFields.style.display = 'block';
            destInput.required = true;
        } else {
            keluarFields.style.display = 'none';
            destInput.required = false;
        }
    }
}

// Format date helper: "30-06-2026 03:40 PM"
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

// Real-time Clock Widget
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

// Toast Notifications Helper
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
