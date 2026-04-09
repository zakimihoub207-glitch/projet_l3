/**
 * Dashboard Enseignant - JWT Authentication
 * File: static/js/dash_ens.js
 */

// ============================================================
// CONFIG
// ============================================================
const API_URL = '/api';

// ============================================================
// JWT HELPERS
// ============================================================
function getToken() {
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user'));
    } catch { return null; }
}

function authHeaders() {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// ============================================================
// API GÉNÉRIQUE
// ============================================================
async function apiFetch(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { headers: authHeaders() });

        if (res.status === 401) {
            console.warn('Token invalide:', endpoint);
            return { error: 'JWT_INVALID', message: 'Token invalide.' };
        }
        if (res.status === 403) {
            return { error: 'FORBIDDEN', message: 'Accès refusé.' };
        }
        if (!res.ok) {
            return { error: 'API_ERROR', message: `Erreur ${res.status}` };
        }

        return await res.json();
    } catch (e) {
        console.error('Network error:', e);
        return { error: 'NETWORK_ERROR', message: 'Serveur inaccessible.' };
    }
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast-dash')?.remove();
    const colors = { success: '#059669', error: '#dc2626', warning: '#d97706', info: '#0284c7' };
    const icons  = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = 'toast-dash';
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        padding: 14px 22px; border-radius: 12px;
        background: ${colors[type] || colors.info};
        color: white; font-weight: 500; font-size: 0.9rem;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 9999; transform: translateX(120%);
        opacity: 0; transition: all 0.3s ease;
        display: flex; align-items: center; gap: 8px;
    `;
    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// SKELETON LOADER
// ============================================================
function skeletonVal(width = '60px') {
    return `<span style="
        display: inline-block; width: ${width}; height: 1.8rem;
        background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 6px;
    ">&nbsp;</span>`;
}

// Ajouter keyframe shimmer si pas encore présent
if (!document.getElementById('shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'shimmer-style';
    style.textContent = `@keyframes shimmer { to { background-position: -200% 0; } }`;
    document.head.appendChild(style);
}

// ============================================================
// VÉRIFIER SESSION
// ============================================================
function checkSession() {
    const token = getToken();
    const user  = getUser();
    if (!token || !user) {
        window.location.href = '/login/';
        return false;
    }
    // Vérifier que c'est bien un enseignant
    if (user.role !== 'Enseignant' && user.role !== 'Dirigeant') {
        window.location.href = '/login/';
        return false;
    }
    return user;
}

// ============================================================
// REMPLIR INFOS UTILISATEUR DANS LA SIDEBAR
// ============================================================
function fillUserInfo(user) {
    const nameEl = document.getElementById('userName');
    if (nameEl) {
        nameEl.textContent = `Prof. ${user.first_name} ${user.last_name}`;
    }

    // Mettre à jour les badges notifications
    loadNotificationCount();
    loadMessageCount();
}

// ============================================================
// CHARGER STATS PRINCIPALES (4 cartes)
// ============================================================
async function loadStats() {
    // Mettre les skeletons pendant le chargement
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => { el.innerHTML = skeletonVal('50px'); });

    try {
        // Charger groupes, étudiants et notes en parallèle
        const [groupesData, etudiantsData, notesData] = await Promise.all([
            apiFetch('/groupes/?statut=Actif'),
            apiFetch('/etudiants/'),
            apiFetch('/notes/'),
        ]);

        // Nombre d'étudiants dans mes groupes
        const nbEtudiants = etudiantsData?.error ? '—' : etudiantsData.length;

        // Nombre de groupes actifs
        const nbGroupes = groupesData?.error ? '—' : groupesData.length;

        // Heures travaillées ce mois
        const enseignantData = await apiFetch('/enseignants/');
        let heures = '—';
        if (!enseignantData?.error && enseignantData.length > 0) {
            const user = getUser();
            const moi  = enseignantData.find(e => e.user?.email === user?.email);
            if (moi) heures = `${moi.heures_travaillees_mois || 0}h`;
        }

        // Moyenne générale de mes étudiants
        let moyenne = '—';
        if (!notesData?.error && notesData.length > 0) {
            const total = notesData.reduce((sum, n) => sum + parseFloat(n.note_obtenue || 0), 0);
            moyenne = (total / notesData.length).toFixed(1);
        }

        // Remplir les 4 cartes
        const values = [nbEtudiants, nbGroupes, heures, moyenne];
        statValues.forEach((el, i) => {
            el.textContent = values[i] ?? '—';
        });

    } catch (e) {
        statValues.forEach(el => { el.textContent = '—'; });
        showToast('Erreur chargement des statistiques', 'error');
    }
}

// ============================================================
// CHARGER NOMBRE DE NOTIFICATIONS NON LUES
// ============================================================
async function loadNotificationCount() {
    const badge = document.querySelector('.notification-btn .badge');
    if (!badge) return;

    const data = await apiFetch('/notifications/?statut=Non_lu');
    if (!data?.error) {
        const count = data.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

// ============================================================
// CHARGER NOMBRE DE MESSAGES NON LUS
// ============================================================
async function loadMessageCount() {
    const badges = document.querySelectorAll('.notification-btn .badge');
    const msgBadge = badges[1]; // deuxième badge = messages
    if (!msgBadge) return;

    const data = await apiFetch('/messages/');
    if (!data?.error) {
        const nonLus = data.filter(m => !m.lu).length;
        msgBadge.textContent = nonLus;
        msgBadge.style.display = nonLus > 0 ? 'inline' : 'none';
    }
}

// ============================================================
// DÉCONNEXION
// ============================================================
async function logout() {
    const refresh = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    try {
        await fetch(`${API_URL}/auth/logout/`, {
            method:  'POST',
            headers: authHeaders(),
            body:    JSON.stringify({ refresh }),
        });
    } catch(e) {}

    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login/';
}

// ============================================================
// BOUTON LOGOUT
// ============================================================
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Voulez-vous vous déconnecter ?')) logout();
});

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const user = checkSession();
    if (!user) return;

    fillUserInfo(user);
    loadStats();
});