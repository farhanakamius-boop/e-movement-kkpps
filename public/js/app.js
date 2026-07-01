// e-Hadir KKPPS - Student Dashboard Logic

let lecturersList = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const lecturersGrid = document.getElementById('lecturersGrid');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const statTotal = document.getElementById('statTotal');
const statIn = document.getElementById('statIn');
const statOut = document.getElementById('statOut');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const liveText = document.getElementById('liveText');
const pulseDot = document.querySelector('.pulse-dot');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchLecturers(true); // first load with loader
    setupEventListeners();
    
    // Update live clock
    updateLiveTime();
    setInterval(updateLiveTime, 1000);
    
    // Auto-refresh every 5 seconds
    setInterval(() => {
        fetchLecturers(false); // background silent refresh
    }, 5000);
});

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
    if (theme === 'dark') {
        themeIcon.textContent = 'light_mode';
        themeToggle.setAttribute('title', 'Tukar ke tema Cerah');
    } else {
        themeIcon.textContent = 'dark_mode';
        themeToggle.setAttribute('title', 'Tukar ke tema Gelap');
    }
}

// Fetch data from API
async function fetchLecturers(showSpinner = false) {
    if (showSpinner) {
        showLoader();
    }
    
    // Animate live pulse dot briefly during update
    triggerLiveFlash();

    try {
        const response = await fetch('/api/lecturers');
        if (!response.ok) throw new Error('Ralat sambungan pelayan');
        
        lecturersList = await response.ok ? await response.json() : [];
        updateStats();
        renderDashboard();
    } catch (error) {
        console.error('Gagal mengambil data:', error);
        if (showSpinner) {
            lecturersGrid.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">
                        <span class="material-symbols-outlined" style="font-size: 4rem; color: var(--danger);">wifi_off</span>
                    </div>
                    <h3>Gagal Menyambung ke Pelayan</h3>
                    <p>${error.message || 'Sila pastikan server Python anda sedang berjalan.'}</p>
                    <button onclick="fetchLecturers(true)" class="btn-login" style="margin: 1rem auto; padding: 0.5rem 1rem;">Cuba Semula</button>
                </div>
            `;
        }
    }
}

function triggerLiveFlash() {
    pulseDot.style.transform = 'scale(1.4)';
    liveText.textContent = 'SYNCING...';
    setTimeout(() => {
        pulseDot.style.transform = 'none';
        liveText.textContent = 'LIVE';
    }, 800);
}

function showLoader() {
    lecturersGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 5rem;">
            <div class="spinner" style="margin: 0 auto 1rem auto; width: 45px; height: 45px; border-color: rgba(79,70,229,0.2); border-top-color: var(--primary);"></div>
            <p style="color: var(--text-muted); font-weight: 600; font-size: 1rem;">Mengemaskini status terkini...</p>
        </div>
    `;
}

// Update Dashboard Statistics Card
function updateStats() {
    const total = lecturersList.length;
    const inCampus = lecturersList.filter(l => l.status === 'Dalam Kampus').length;
    const outCampus = total - inCampus;
    
    statTotal.textContent = total;
    statIn.textContent = inCampus;
    statOut.textContent = outCampus;
}

// Render Lecturers List Card Grid
function renderDashboard() {
    // Filter & Search the list
    const filteredList = lecturersList.filter(lecturer => {
        // Status filter
        const matchStatus = 
            currentFilter === 'all' || 
            (currentFilter === 'in' && lecturer.status === 'Dalam Kampus') ||
            (currentFilter === 'out' && lecturer.status === 'Keluar');
            
        // Text search filter
        const query = searchQuery.toLowerCase().trim();
        const matchText = 
            query === '' || 
            lecturer.name.toLowerCase().includes(query) || 
            lecturer.role.toLowerCase().includes(query);
            
        return matchStatus && matchText;
    });

    if (filteredList.length === 0) {
        lecturersGrid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <span class="material-symbols-outlined" style="font-size: 3.5rem;">search_off</span>
                </div>
                <h3>Tiada Hasil Ditemui</h3>
                <p>Tiada rekod pensyarah sepadan dengan carian "${searchInput.value}" atau penapis yang dipilih.</p>
            </div>
        `;
        return;
    }

    lecturersGrid.innerHTML = filteredList.map(lecturer => {
        const isOut = lecturer.status === 'Keluar';
        const cardStatusClass = isOut ? 'status-out' : 'status-in';
        
        // Extract initials for profile image placeholder
        const initials = getInitials(lecturer.name);
        
        // Clean phone number for WhatsApp link
        const whatsappLink = formatWhatsappLink(lecturer.phone);
        const phoneCallLink = lecturer.phone ? `tel:${lecturer.phone}` : '#';

        // Details structure
        const dest = isOut ? lecturer.destination || 'Tidak dinyatakan' : 'Bilik Pensyarah / Pejabat';
        const wKeluar = isOut ? lecturer.waktu_keluar || '-' : '-';
        const wKembali = isOut ? lecturer.waktu_kembali || '-' : '-';
        const kemaskini = lecturer.updated_at ? `${lecturer.updated_at}` : 'Tiada rekod';

        return `
            <article class="lecturer-card ${cardStatusClass}" id="lecturer-${lecturer.id}">
                <div>
                    <!-- Card Header -->
                    <div class="card-top">
                        <div class="avatar-wrapper">
                            <div class="avatar">${initials}</div>
                            <div class="status-badge-absolute"></div>
                        </div>
                        <div class="lecturer-details">
                            <h2 class="lecturer-name" title="${lecturer.name}">${lecturer.name}</h2>
                            <p class="lecturer-role">${lecturer.role}</p>
                        </div>
                    </div>

                    <!-- Card Body Status details -->
                    <div class="status-section">
                        <div class="status-row">
                            <span class="label-text">Status Semasa</span>
                            <span class="badge-status">
                                <span class="pulse-dot" style="animation-duration: 2s; width:6px; height:6px;"></span>
                                <span>${lecturer.status}</span>
                            </span>
                        </div>
                        <div class="status-row">
                            <span class="label-text">Destinasi</span>
                            <span class="value-text" title="${dest}">${dest}</span>
                        </div>
                        <div class="status-row">
                            <span class="label-text">Masa Keluar</span>
                            <span class="value-text">${wKeluar}</span>
                        </div>
                        <div class="status-row">
                            <span class="label-text">Jangka Kembali</span>
                            <span class="value-text" style="${isOut ? 'color: var(--primary); font-weight:700;' : ''}">${wKembali}</span>
                        </div>
                    </div>
                </div>

                <!-- Card Footer Actions -->
                <div class="card-footer">
                    <span class="updated-time">Kemas kini: ${kemaskini}</span>
                    <div class="contact-buttons">
                        ${lecturer.phone ? `
                            <a href="${phoneCallLink}" class="contact-btn" title="Hubungi Telefon: ${lecturer.phone}">
                                <span class="material-symbols-outlined" style="font-size: 1.15rem;">call</span>
                            </a>
                            <a href="${whatsappLink}" target="_blank" class="contact-btn whatsapp" title="Hantar Mesej WhatsApp">
                                <span class="material-symbols-outlined" style="font-size: 1.15rem;">chat</span>
                            </a>
                        ` : `
                            <span class="label-text" style="font-style: italic;">Tiada no. telefon</span>
                        `}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// Helpers
function getInitials(name) {
    if (!name) return 'S';
    // Remove titles like DR., TS., HJ. etc for cleaner initials
    let cleaned = name.toUpperCase()
        .replace(/^(TS\.|DR\.|HJ\.|HAJI|PUAN|EN\.|ENCIK)\s+/i, '')
        .trim();
        
    const parts = cleaned.split(' ');
    if (parts.length > 1) {
        return parts[0][0] + parts[1][0];
    }
    return parts[0].substring(0, 2);
}

function formatWhatsappLink(phone) {
    if (!phone) return '#';
    // Clean all special characters, spaces, dashes
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // Standardize to country code (60 for Malaysia)
    if (cleaned.startsWith('0')) {
        cleaned = '6' + cleaned;
    } else if (!cleaned.startsWith('60') && cleaned.startsWith('1')) {
        cleaned = '60' + cleaned;
    }
    
    return `https://api.whatsapp.com/send?phone=${cleaned}&text=Salam%20sejahtera%20pensyarah...`;
}

// Setup Event Listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderDashboard();
    });

    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentFilter = e.target.getAttribute('data-filter');
            renderDashboard();
        });
    });

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
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
