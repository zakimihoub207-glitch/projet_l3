/**
 * Mes Notes - Espace Étudiant
 * JWT Authentication + Django REST API
 * File: static/js/etudiant_notes.js
 */

// ============================================================
// CONFIG
// ============================================================
const API_URL = '/api';

// État global
const state = {
    notes:       [],    // toutes les notes de l'étudiant
    etudiant:    null,  // profil étudiant
    filterMois:  6,     // filtre graphique : 6 | 12 | 'all'
    searchTerm:  '',    // terme de recherche
};

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
        if (res.status === 401) return { error: 'JWT_INVALID', message: 'Token invalide.' };
        if (res.status === 403) return { error: 'FORBIDDEN',   message: 'Accès refusé.' };
        if (!res.ok)            return { error: 'API_ERROR',   message: `Erreur ${res.status}` };
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
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast-notes')?.remove();
    const colors = { success:'#059669', error:'#dc2626', warning:'#d97706', info:'#0284c7' };
    const icons  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    const t = document.createElement('div');
    t.className = 'toast-notes';
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
    return new Date(dateStr).toLocaleDateString('fr-DZ', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function gradeBadgeClass(note, max = 20) {
    const pct = (parseFloat(note) / parseFloat(max)) * 100;
    if (pct >= 80) return 'grade-excellent';
    if (pct >= 65) return 'grade-good';
    if (pct >= 50) return 'grade-average';
    return 'grade-poor';
}

function typeInfo(type) {
    const map = {
        'Ecrit':         { icon:'📝', cls:'type-written',       label:'Expression Écrite' },
        'Oral':          { icon:'🎤', cls:'type-oral',           label:'Expression Orale' },
        'Comprehension': { icon:'🎧', cls:'type-listening',      label:'Compréhension Orale' },
        'Participation': { icon:'💬', cls:'type-participation',  label:'Participation' },
        'Projet':        { icon:'📁', cls:'type-written',        label:'Projet' },
        'Examen':        { icon:'📋', cls:'type-oral',           label:'Examen' },
    };
    return map[type] || { icon:'📌', cls:'type-written', label: type };
}

// ============================================================
// SKELETON POUR LES STATS
// ============================================================
function setSkeleton(id, w = '60px', h = '2rem') {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<span class="skeleton" style="width:${w};height:${h};">&nbsp;</span>`;
}

// ============================================================
// CHARGER PROFIL ÉTUDIANT
// ============================================================
async function loadEtudiant(user) {
    const data = await apiFetch('/etudiants/');
    if (data?.error || !data.length) return null;
    return data.find(e => e.user?.email === user.email) || data[0];
}

// ============================================================
// CHARGER TOUTES LES NOTES
// ============================================================
async function loadNotes() {
    const data = await apiFetch('/notes/');
    if (data?.error) {
        showToast('Erreur chargement notes: ' + data.message, 'error');
        return [];
    }
    return data;
}

// ============================================================
// REMPLIR LES 4 STATS CARDS
// ============================================================
function fillStats(notes, etudiant) {
    // Moyenne générale
    const moyenne = parseFloat(etudiant?.moyenne_generale) || 0;
    document.getElementById('statMoyenne').textContent = moyenne.toFixed(1);

    // Nombre d'évaluations cette année
    const thisYear  = new Date().getFullYear();
    const annee     = notes.filter(n => new Date(n.date_saisie).getFullYear() === thisYear);
    document.getElementById('statNbEvals').textContent = annee.length;

    // Niveau actuel
    document.getElementById('statNiveau').textContent = etudiant?.niveau_actuel || '—';

    // Progression vs semestre dernier
    const now        = new Date();
    const debutSemCourant = new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1);
    const debutSemPasse   = new Date(debutSemCourant);
    debutSemPasse.setMonth(debutSemPasse.getMonth() - 6);

    const notesCourant = notes.filter(n => new Date(n.date_saisie) >= debutSemCourant);
    const notesPasse   = notes.filter(n => {
        const d = new Date(n.date_saisie);
        return d >= debutSemPasse && d < debutSemCourant;
    });

    let progression = '—';
    if (notesCourant.length && notesPasse.length) {
        const avgC = notesCourant.reduce((s, n) => s + parseFloat(n.note_obtenue), 0) / notesCourant.length;
        const avgP = notesPasse.reduce((s, n) => s + parseFloat(n.note_obtenue), 0)   / notesPasse.length;
        const diff = ((avgC - avgP) / avgP * 100).toFixed(0);
        progression = `${diff >= 0 ? '+' : ''}${diff}%`;
    }
    const progEl = document.getElementById('statProgression');
    progEl.textContent = progression;
    if (progression !== '—') {
        progEl.style.color = progression.startsWith('+') ? '#059669' : '#dc2626';
    }
}

// ============================================================
// GRAPHIQUE EN BARRES — ÉVOLUTION MENSUELLE
// ============================================================
function buildChart(notes, moisFiltres = 6) {
    const chart = document.getElementById('chartBars');
    if (!chart) return;

    // Grouper les notes par mois
    const now    = new Date();
    const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const grouped  = {};

    const limite = moisFiltres === 'all' ? 24 : parseInt(moisFiltres);

    for (let i = limite - 1; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = moisNoms[d.getMonth()];
        grouped[key] = { label, notes: [], moy: null };
    }

    notes.forEach(n => {
        const d   = new Date(n.date_saisie);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (grouped[key]) grouped[key].notes.push(parseFloat(n.note_obtenue));
    });

    // Calculer moyennes
    Object.values(grouped).forEach(m => {
        if (m.notes.length) {
            m.moy = (m.notes.reduce((a, b) => a + b, 0) / m.notes.length).toFixed(1);
        }
    });

    const entries = Object.values(grouped);
    const maxMoy  = Math.max(...entries.map(e => parseFloat(e.moy) || 0), 20);

    if (!entries.some(e => e.moy !== null)) {
        chart.innerHTML = `
            <div class="empty-state" style="width:100%;">
                <div class="icon">📊</div>
                <p>Aucune donnée disponible pour cette période</p>
            </div>`;
        return;
    }

    chart.innerHTML = entries.map(e => {
        const hauteur = e.moy ? `${(parseFloat(e.moy) / maxMoy) * 100}%` : '0%';
        const barStyle = e.moy
            ? `height:${hauteur}; background:linear-gradient(to top, #6366f1, #ec4899);`
            : `height:4px; background:#e2e8f0;`;

        return `
            <div class="chart-bar-wrapper fade-in">
                <div class="chart-bar" style="${barStyle}">
                    ${e.moy ? `<span class="chart-bar-value">${e.moy}</span>` : ''}
                </div>
                <span class="chart-label">${e.label}</span>
            </div>`;
    }).join('');
}

// ============================================================
// RINGS SVG — RÉPARTITION PAR COMPÉTENCE
// ============================================================
function buildRings(notes) {
    const container = document.getElementById('ringContainer');
    if (!container) return;

    // Grouper par type
    const types = {
        'Ecrit':         { label:'Expression Écrite',  total:0, count:0, color:'#6366f1' },
        'Oral':          { label:'Expression Orale',   total:0, count:0, color:'#ec4899' },
        'Comprehension': { label:'Compréhension',      total:0, count:0, color:'#10b981' },
        'Participation': { label:'Participation',      total:0, count:0, color:'#f59e0b' },
    };

    notes.forEach(n => {
        const type = n.evaluation_type || guessType(n.evaluation_titre);
        if (types[type]) {
            types[type].total += parseFloat(n.note_obtenue);
            types[type].count++;
        }
    });

    const r = 52;
    const circumference = 2 * Math.PI * r;  // ≈ 327

    container.innerHTML = Object.entries(types).map(([key, t]) => {
        const avg = t.count > 0 ? t.total / t.count : 0;
        const pct = Math.round((avg / 20) * 100);
        const offset = circumference - (circumference * pct / 100);

        return `
            <div class="progress-ring-wrapper fade-in">
                <div class="progress-ring">
                    <svg width="120" height="120">
                        <circle class="progress-ring-bg"   cx="60" cy="60" r="${r}"/>
                        <circle class="progress-ring-fill" cx="60" cy="60" r="${r}"
                                stroke="${t.color}"
                                stroke-dasharray="${circumference.toFixed(0)}"
                                stroke-dashoffset="${circumference.toFixed(0)}"
                                id="ring-${key}"/>
                    </svg>
                    <div class="progress-ring-text">${t.count > 0 ? pct + '%' : '—'}</div>
                </div>
                <div class="progress-label">${t.label}</div>
            </div>`;
    }).join('');

    // Animer les rings après rendu
    requestAnimationFrame(() => {
        Object.entries(types).forEach(([key, t]) => {
            const avg    = t.count > 0 ? t.total / t.count : 0;
            const pct    = Math.round((avg / 20) * 100);
            const offset = circumference - (circumference * pct / 100);
            const el     = document.getElementById(`ring-${key}`);
            if (el) {
                setTimeout(() => {
                    el.style.transition = 'stroke-dashoffset 1s ease';
                    el.setAttribute('stroke-dashoffset', offset.toFixed(0));
                }, 100);
            }
        });
    });
}

// Deviner le type depuis le titre (fallback)
function guessType(titre) {
    if (!titre) return 'Ecrit';
    const l = titre.toLowerCase();
    if (l.includes('oral') || l.includes('présentation')) return 'Oral';
    if (l.includes('compréhension') || l.includes('listening')) return 'Comprehension';
    if (l.includes('participation')) return 'Participation';
    return 'Ecrit';
}

// ============================================================
// TABLEAU HISTORIQUE
// ============================================================
function renderTable(notes, search = '') {
    const tbody = document.getElementById('gradesTableBody');
    if (!tbody) return;

    // Filtrer par recherche
    const filtered = search
        ? notes.filter(n =>
            (n.evaluation_titre || '').toLowerCase().includes(search.toLowerCase()) ||
            (n.evaluation_type  || '').toLowerCase().includes(search.toLowerCase())
          )
        : notes;

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="icon">📭</div>
                        <p>${search ? 'Aucun résultat pour "' + search + '"' : 'Aucune évaluation disponible'}</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    // Trier par date décroissante
    const sorted = [...filtered].sort((a, b) =>
        new Date(b.date_saisie) - new Date(a.date_saisie)
    );

    tbody.innerHTML = sorted.map(n => {
        const type     = n.evaluation_type || guessType(n.evaluation_titre);
        const info     = typeInfo(type);
        const noteVal  = parseFloat(n.note_obtenue).toFixed(1);
        const noteMax  = n.note_max || 20;
        const badgeCls = gradeBadgeClass(n.note_obtenue, noteMax);
        const comment  = n.remarque_prof || '—';
        const coeff    = n.ponderation ? `${n.ponderation}%` : '—';

        return `
            <tr class="fade-in">
                <td>
                    <span class="type-icon ${info.cls}">${info.icon}</span>
                    ${n.evaluation_titre || info.label}
                </td>
                <td>${formatDate(n.date_saisie)}</td>
                <td>
                    <span class="grade-badge ${badgeCls}">${noteVal}/${noteMax}</span>
                </td>
                <td>${coeff}</td>
                <td class="comment-cell">${comment !== '—' ? `"${comment}"` : '—'}</td>
            </tr>`;
    }).join('');
}

// ============================================================
// FILTRES GRAPHIQUE (boutons 6 mois / 1 an / Tout)
// ============================================================
function initFilterBtns() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filterMois = btn.dataset.filter === 'all' ? 'all' : parseInt(btn.dataset.filter);
            buildChart(state.notes, state.filterMois);
        });
    });
}

// ============================================================
// RECHERCHE DANS LE TABLEAU
// ============================================================
function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let timeout;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchTerm = e.target.value.trim();
            renderTable(state.notes, state.searchTerm);
        }, 300);
    });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const user = checkSession();
    if (!user) return;

    // Mettre les skeletons
    ['statMoyenne', 'statNbEvals', 'statNiveau', 'statProgression'].forEach(id =>
        setSkeleton(id, '60px', '2rem')
    );

    // Initialiser events
    initFilterBtns();
    initSearch();

    // Charger données en parallèle
    const [etudiant, notes] = await Promise.all([
        loadEtudiant(user),
        loadNotes(),
    ]);

    state.etudiant = etudiant;
    state.notes    = notes;

    if (!notes.length) {
        showToast('Aucune note disponible pour le moment.', 'warning');
    }

    // Remplir tout
    fillStats(notes, etudiant);
    buildChart(notes, state.filterMois);
    buildRings(notes);
    renderTable(notes);
});