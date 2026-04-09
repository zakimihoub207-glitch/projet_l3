/**
 * Dashboard Étudiant - JWT Authentication
 * File: static/js/dash_etu.js
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
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

// ============================================================
// API GÉNÉRIQUE
// ============================================================
async function apiFetch(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { headers: authHeaders() });
        if (res.status === 401) return { error: 'JWT_INVALID',  message: 'Token invalide.' };
        if (res.status === 403) return { error: 'FORBIDDEN',    message: 'Accès refusé.' };
        if (!res.ok)            return { error: 'API_ERROR',    message: `Erreur ${res.status}` };
        return await res.json();
    } catch (e) {
        return { error: 'NETWORK_ERROR', message: 'Serveur inaccessible.' };
    }
}

// ============================================================
// VÉRIFIER SESSION
// ============================================================
function checkSession() {
    const token = getToken();
    const user  = getUser();
    if (!token || !user) { window.location.href = '/login/'; return null; }
    if (!['Etudiant', 'Dirigeant'].includes(user.role)) { window.location.href = '/login/'; return null; }
    return user;
}

// ============================================================
// SKELETON LOADER
// ============================================================
function skeleton(w = '80px', h = '1.2rem') {
    return `<span style="
        display:inline-block; width:${w}; height:${h};
        background:linear-gradient(90deg,#e2e8f0 25%,#cbd5e1 50%,#e2e8f0 75%);
        background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px;
    ">&nbsp;</span>`;
}

// inject shimmer keyframe once
if (!document.getElementById('etu-shimmer')) {
    const s = document.createElement('style');
    s.id = 'etu-shimmer';
    s.textContent = `
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
    `;
    document.head.appendChild(s);
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast-etu')?.remove();
    const colors = { success:'#059669', error:'#dc2626', warning:'#d97706', info:'#0284c7' };
    const icons  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    const t = document.createElement('div');
    t.className = 'toast-etu';
    t.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        padding:14px 22px; border-radius:12px;
        background:${colors[type]}; color:white;
        font-weight:500; font-size:0.9rem;
        box-shadow:0 8px 24px rgba(0,0,0,0.2);
        display:flex; align-items:center; gap:8px;
        transform:translateX(120%); opacity:0; transition:all 0.3s ease;
    `;
    t.innerHTML = `<span>${icons[type]}</span>${message}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.transform = 'translateX(0)'; t.style.opacity = '1'; });
    setTimeout(() => {
        t.style.transform = 'translateX(120%)'; t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ============================================================
// FORMATAGE
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-DZ', { day:'numeric', month:'long', year:'numeric' });
}

function formatRelative(dateStr) {
    if (!dateStr) return '—';
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 3600)   return `Il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400)  return `Aujourd'hui`;
    if (diff < 172800) return `Hier`;
    if (diff < 604800) return `Il y a ${Math.floor(diff/86400)} jours`;
    return formatDate(dateStr);
}

function scoreClass(note, max = 20) {
    const pct = (note / max) * 100;
    if (pct >= 75) return 'score-high';
    if (pct >= 50) return 'score-medium';
    return 'score-low';
}

function levelProgress(niveau) {
    const map = { A1: { next:'A2', pct:0 }, A2: { next:'B1', pct:20 },
                  B1: { next:'B2', pct:40 }, B2: { next:'C1', pct:65 }, C1: { next:'—', pct:100 } };
    return map[niveau] || { next:'B2', pct:50 };
}

// ============================================================
// REMPLIR INFOS UTILISATEUR
// ============================================================
function fillUserInfo(user, etudiant) {
    const prenom = user.first_name || '';
    const nom    = user.last_name  || '';
    const niveau = etudiant?.niveau_actuel || 'A1';
    const initials = `${prenom[0] || ''}${nom[0] || ''}`.toUpperCase();

    // Header greeting
    const header = document.querySelector('.header h2');
    if (header) header.innerHTML = `Bonjour, ${prenom} ! 👋`;

    // Sidebar avatar + nom
    const avatar   = document.querySelector('.avatar');
    const userInfo = document.querySelector('.user-info h4');
    const userRole = document.querySelector('.user-info p');

    if (avatar)   avatar.textContent   = initials;
    if (userInfo) userInfo.textContent = `${prenom} ${nom}`;
    if (userRole) userRole.textContent = `Étudiant(e) - ${niveau}`;
}

// ============================================================
// 1. PROCHAIN COURS
// ============================================================
async function loadProchainCours(etudiant) {
    const card = document.querySelector('.next-class');
    if (!card || !etudiant?.groupe) return;

    // Mettre un skeleton
    const details = card.querySelector('.class-details');
    const infos   = card.querySelector('.class-info p');
    const countdown = card.querySelector('.countdown-number');
    if (details) details.querySelector('h3').innerHTML = skeleton('200px', '1.4rem');
    if (countdown) countdown.innerHTML = skeleton('40px');

    const data = await apiFetch(`/plannings/?groupe=${etudiant.groupe}`);
    if (data?.error || !data.length) {
        if (details) details.querySelector('h3').textContent = 'Aucun cours planifié';
        const p = card.querySelector('.class-details p');
        if (p) p.textContent = 'Planning non disponible';
        card.querySelector('.countdown-number').textContent = '—';
        return;
    }

    const now     = new Date();
    const today   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][now.getDay()];

    // Trouver le cours du jour ou le prochain
    let prochain = data.find(p => p.jour === today) || data[0];

    // Infos groupe
    const groupeData = await apiFetch(`/groupes/${etudiant.groupe}/`);
    const langue     = groupeData?.langue || '';
    const niveau     = groupeData?.niveau || etudiant.niveau_actuel;
    const enseignant = prochain.enseignant_nom || 'Professeur';
    const salle      = prochain.salle || '—';
    const hDebut     = prochain.heure_debut?.slice(0, 5) || '—';
    const hFin       = prochain.heure_fin?.slice(0, 5)   || '—';

    // Calculer minutes restantes
    let minutesRestantes = '—';
    if (hDebut !== '—') {
        const [h, m]   = hDebut.split(':').map(Number);
        const coursDate = new Date();
        coursDate.setHours(h, m, 0, 0);
        const diff = Math.floor((coursDate - now) / 60000);
        minutesRestantes = diff > 0 ? diff : 0;
    }

    // Remplir
    const h3 = card.querySelector('.class-details h3');
    const p  = card.querySelector('.class-details p');
    const dayEl   = card.querySelector('.day');
    const timeEl  = card.querySelector('.time');
    const cntNum  = card.querySelector('.countdown-number');
    const cntLbl  = card.querySelector('.countdown-label');

    if (h3)   h3.textContent  = `${langue} - ${niveau}`;
    if (p)    p.textContent   = `👨‍🏫 ${enseignant} | 📍 Salle ${salle} | ${hDebut} → ${hFin}`;
    if (dayEl)  dayEl.textContent  = prochain.jour === today ? "Aujourd'hui" : prochain.jour;
    if (timeEl) timeEl.textContent = hDebut;
    if (cntNum) cntNum.textContent = minutesRestantes;
    if (cntLbl) cntLbl.textContent = typeof minutesRestantes === 'number' && minutesRestantes === 0
        ? 'En cours !'
        : 'min restantes';

    card.classList.add('fade-in');
}

// ============================================================
// 2. NIVEAU ACTUEL + PROGRESSION
// ============================================================
async function loadNiveau(etudiant) {
    // Chercher la carte niveau
    const cards = document.querySelectorAll('.card');
    let niveauCard = null;
    cards.forEach(c => {
        if (c.querySelector('.card-title')?.textContent?.includes('Niveau')) niveauCard = c;
    });
    if (!niveauCard || !etudiant) return;

    const niveau  = etudiant.niveau_actuel || 'A1';
    const moyenne = parseFloat(etudiant.moyenne_generale) || 0;
    const prog    = levelProgress(niveau);

    // Calculer progression réelle basée sur la moyenne
    // seuils: A1→A2: 5, A2→B1: 10, B1→B2: 13, B2→C1: 16
    const seuils = { A1: { min:0, max:5 }, A2: { min:5, max:10 },
                     B1: { min:10, max:13 }, B2: { min:13, max:16 }, C1: { min:16, max:20 } };
    const s   = seuils[niveau] || seuils.B1;
    const pct = Math.min(100, Math.round(((moyenne - s.min) / (s.max - s.min)) * 100));

    const niveauLabels = {
        A1: 'Débutant', A2: 'Élémentaire',
        B1: 'Intermédiaire', B2: 'Intermédiaire avancé', C1: 'Avancé'
    };

    const badge = niveauCard.querySelector('.level-badge');
    const fill  = niveauCard.querySelector('.progress-fill');
    const pctEl = niveauCard.querySelector('.progress-header span:last-child');
    const progText = niveauCard.querySelector('.progress-header span:first-child');
    const moyEl = niveauCard.querySelector('p strong');

    if (badge)   badge.textContent  = `${niveau} - ${niveauLabels[niveau] || ''}`;
    if (fill)    fill.style.width   = `${pct}%`;
    if (pctEl)   pctEl.textContent  = `${pct}%`;
    if (progText && prog.next !== '—') progText.textContent = `Progression vers ${prog.next}`;
    if (moyEl)   moyEl.textContent  = `${moyenne.toFixed(1)}/20`;

    niveauCard.classList.add('fade-in');
}

// ============================================================
// 3. MOYENNE GÉNÉRALE
// ============================================================
async function loadMoyenne(etudiant) {
    // Trouver carte Moyenne Générale
    const cards = document.querySelectorAll('.card');
    let moyCard = null;
    cards.forEach(c => {
        if (c.querySelector('.card-title')?.textContent?.includes('Moyenne')) moyCard = c;
    });
    if (!moyCard) return;

    const statVal = moyCard.querySelector('.stat-value');
    const statChg = moyCard.querySelector('.stat-change');
    if (statVal) statVal.innerHTML = skeleton('60px', '2.5rem');

    // Charger notes récentes pour calculer évolution
    const notes = await apiFetch('/notes/');
    if (notes?.error) {
        if (statVal) statVal.textContent = '—';
        return;
    }

    const moyenne = parseFloat(etudiant?.moyenne_generale) || 0;
    if (statVal) statVal.textContent = moyenne.toFixed(1);

    // Calculer évolution vs le mois dernier (si assez de notes)
    if (statChg && notes.length >= 2) {
        const now      = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const notesRecent = notes.filter(n => new Date(n.date_saisie) >= lastMonth);
        const notesOld    = notes.filter(n => new Date(n.date_saisie) < lastMonth);

        if (notesRecent.length && notesOld.length) {
            const avgRecent = notesRecent.reduce((s, n) => s + parseFloat(n.note_obtenue), 0) / notesRecent.length;
            const avgOld    = notesOld.reduce((s, n) => s + parseFloat(n.note_obtenue), 0) / notesOld.length;
            const diff = (avgRecent - avgOld).toFixed(1);
            const positive = diff >= 0;
            statChg.className = `stat-change ${positive ? 'positive' : 'negative'}`;
            statChg.innerHTML = `<span>${positive ? '↑' : '↓'}</span><span>${positive ? '+' : ''}${diff} vs mois dernier</span>`;
        }
    }

    moyCard.classList.add('fade-in');
}

// ============================================================
// 4. TAUX D'ASSIDUITÉ + GRILLE SEMAINE
// ============================================================
async function loadAssiduite(etudiant) {
    const cards = document.querySelectorAll('.card');
    let attCard = null;
    cards.forEach(c => {
        if (c.querySelector('.card-title')?.textContent?.includes('Assiduité')) attCard = c;
    });
    if (!attCard) return;

    const statVal = attCard.querySelector('.stat-value');
    if (statVal) statVal.innerHTML = skeleton('70px', '2.5rem');

    const taux = parseFloat(etudiant?.taux_assiduité ?? etudiant?.taux_assiduite ?? 100);
    if (statVal) statVal.textContent = `${taux.toFixed(0)}%`;

    // Charger absences de la semaine courante
    const absences = await apiFetch('/absences/');
    if (!absences?.error) {
        const now   = new Date();
        const lundi = new Date(now);
        lundi.setDate(now.getDate() - now.getDay() + 1);

        const joursMap = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
        const semaine  = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(lundi);
            d.setDate(lundi.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        const grid = attCard.querySelector('.attendance-grid');
        if (grid) {
            grid.innerHTML = semaine.map((date, i) => {
                const isToday   = date === now.toISOString().split('T')[0];
                const isFuture  = new Date(date) > now;
                const abs       = absences.find(a => a.date_absence === date);

                let cls = 'att-future';
                if (!isFuture) {
                    if (!abs || abs.statut_absence === 'Present') cls = 'att-present';
                    else if (abs.statut_absence === 'Absent')     cls = 'att-absent';
                    else cls = 'att-present';
                }

                return `<div class="att-day ${cls}" title="${date}"
                              style="${isToday ? 'outline:2px solid #667eea; border-radius:50%;' : ''}">
                            ${joursMap[i]}
                        </div>`;
            }).join('');
        }
    }

    attCard.classList.add('fade-in');
}

// ============================================================
// 5. NOTES RÉCENTES
// ============================================================
async function loadNotesRecentes() {
    const cards = document.querySelectorAll('.card');
    let notesCard = null;
    cards.forEach(c => {
        if (c.querySelector('.card-title')?.textContent?.includes('Notes')) notesCard = c;
    });
    if (!notesCard) return;

    const list = notesCard.querySelector('.grades-list');
    if (!list) return;

    list.innerHTML = `
        <div style="padding:1rem; text-align:center; color:#94a3b8;">
            ${skeleton('100%')} <br><br> ${skeleton('100%')} <br><br> ${skeleton('100%')}
        </div>`;

    const notes = await apiFetch('/notes/');
    if (notes?.error || !notes.length) {
        list.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#94a3b8;">
            <p>Aucune note disponible</p></div>`;
        return;
    }

    // Trier par date décroissante, prendre les 3 dernières
    const sorted = [...notes].sort((a, b) =>
        new Date(b.date_saisie) - new Date(a.date_saisie)
    ).slice(0, 3);

    list.innerHTML = sorted.map(n => `
        <div class="grade-item fade-in">
            <div class="grade-info">
                <h4>${n.evaluation_titre || 'Évaluation'}</h4>
                <p>${formatRelative(n.date_saisie)}</p>
            </div>
            <div class="grade-score ${scoreClass(n.note_obtenue, n.note_max)}">
                ${parseFloat(n.note_obtenue).toFixed(1)}/${n.note_max}
            </div>
        </div>
    `).join('');

    // Bouton "Voir tout" → mes notes
    const btn = notesCard.querySelector('.btn-primary');
    if (btn) btn.onclick = () => window.location.href = '/etudiant/notes/';

    notesCard.classList.add('fade-in');
}

// ============================================================
// 6. RESSOURCES RÉCENTES
// ============================================================
async function loadRessources() {
    const cards = document.querySelectorAll('.card');
    let resCard = null;
    cards.forEach(c => {
        if (c.querySelector('.card-title')?.textContent?.includes('Ressources')) resCard = c;
    });
    if (!resCard) return;

    const list = resCard.querySelector('.resource-list');
    if (!list) return;

    list.innerHTML = `
        <div style="padding:1rem; text-align:center; color:#94a3b8;">
            ${skeleton('100%')} <br><br> ${skeleton('100%')} <br><br> ${skeleton('100%')}
        </div>`;

    const data = await apiFetch('/ressources/');
    if (data?.error || !data.length) {
        list.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#94a3b8;">
            <p>Aucune ressource disponible</p></div>`;
        return;
    }

    const typeIcons = {
        'PDF':      '📄',
        'PPT':      '📊',
        'Video':    '🎥',
        'Audio':    '🎵',
        'Exercice': '✏️',
        'Lien':     '🔗',
    };

    const sorted = [...data].sort((a, b) =>
        new Date(b.date_creation) - new Date(a.date_creation)
    ).slice(0, 3);

    list.innerHTML = sorted.map(r => `
        <div class="resource-item fade-in" style="cursor:pointer;"
             onclick="downloadRessource(${r.id}, '${r.url_lien || ''}')">
            <div class="resource-icon">${typeIcons[r.type_ressource] || '📁'}</div>
            <div class="resource-info">
                <h4>${r.titre}</h4>
                <p>${r.type_ressource} • ${formatRelative(r.date_creation)}</p>
            </div>
        </div>
    `).join('');

    resCard.classList.add('fade-in');
}

// ============================================================
// TÉLÉCHARGER / OUVRIR RESSOURCE
// ============================================================
async function downloadRessource(id, url) {
    if (url) {
        window.open(url, '_blank');
        return;
    }
    // Incrémenter le compteur de téléchargements
    await fetch(`${API_URL}/ressources/${id}/`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({ nombre_telechargements: 1 }),
    });
    showToast('Téléchargement en cours...', 'info');
}

// ============================================================
// 7. NOTIFICATIONS
// ============================================================
async function loadNotifications() {
    const badge = document.querySelector('.notification-btn .badge');
    if (!badge) return;

    const data = await apiFetch('/notifications/?statut=Non_lu');
    if (!data?.error) {
        badge.textContent   = data.length;
        badge.style.display = data.length > 0 ? 'inline' : 'none';
    }
}

// ============================================================
// 8. SYNCHRONISER CALENDRIER (bouton)
// ============================================================
function syncCalendar() {
    showToast('Fonctionnalité de synchronisation en développement.', 'warning');
}

// ============================================================
// DÉCONNEXION / LOGOUT
// ============================================================
function logout() {
    // Optional: Call backend logout endpoint to blacklist token
    // fetch(`${API_URL}/logout/`, { method: 'POST', headers: authHeaders() });

    // Clear all stored authentication data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');

    showToast('Déconnexion réussie', 'success');

    // Redirect to login page after a brief delay
    setTimeout(() => {
        window.location.href = '/login/';
    }, 800);
}

// Initialize disconnect button
function initDisconnectButton() {
    const btn = document.getElementById('btn-disconnect');
    if (btn) {
        btn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                logout();
            }
        });
    }
}

// Initialize calendar sync button
function initCalendarButton() {
    const btn = document.getElementById('btn-sync-calendar');
    if (btn) {
        btn.addEventListener('click', syncCalendar);
    }
}

// ============================================================
// INIT PRINCIPAL
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const user = checkSession();
    if (!user) return;

    // Initialize UI buttons
    initDisconnectButton();
    initCalendarButton();

    // Charger le profil étudiant
    const etudiantData = await apiFetch('/etudiants/');
    let etudiant = null;

    if (!etudiantData?.error && etudiantData.length) {
        // Trouver l'étudiant correspondant à l'utilisateur connecté
        etudiant = etudiantData.find(e => e.user?.email === user.email) || etudiantData[0];
    }

    // Remplir les infos utilisateur
    fillUserInfo(user, etudiant);

    // Charger toutes les sections en parallèle
    await Promise.all([
        loadProchainCours(etudiant),
        loadNiveau(etudiant),
        loadMoyenne(etudiant),
        loadAssiduite(etudiant),
        loadNotesRecentes(),
        loadRessources(),
        loadNotifications(),
    ]);

    showToast(`Bienvenue ${user.first_name} !`, 'success');
});