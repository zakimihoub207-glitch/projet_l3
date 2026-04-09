/**
 * Mes Ressources - Espace Étudiant
 * JWT Authentication + Django REST API
 * File: static/js/mes_ressources.js
 */

// ============================================================
// CONFIG
// ============================================================
const API_URL = '/api';

// État global
const state = {
    ressources:     [],       // toutes les ressources de l'API
    filtered:       [],       // ressources après filtres
    viewMode:       'grid',   // 'grid' | 'list'
    searchTerm:     '',
    filterType:     'all',    // 'all' | 'PDF' | 'Video' | 'Audio' | 'PPT' | 'Exercice' | 'Lien'
    filterNiveau:   'all',    // 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
    downloads:      [],       // historique téléchargements (localStorage)
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
async function apiFetch(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...authHeaders(), ...options.headers },
        });
        if (res.status === 401) return { error: 'JWT_INVALID', message: 'Token invalide.' };
        if (res.status === 403) return { error: 'FORBIDDEN',   message: 'Accès refusé.' };
        if (!res.ok)            return { error: 'API_ERROR',   message: `Erreur ${res.status}` };
        if (res.status === 204) return { success: true };
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
    document.querySelector('.toast-res')?.remove();
    const colors = { success:'#059669', error:'#dc2626', warning:'#d97706', info:'#0284c7' };
    const icons  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    const t = document.createElement('div');
    t.className = 'toast-res';
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
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 86400)  return `Aujourd'hui`;
    if (diff < 172800) return `Hier`;
    if (diff < 604800) return `Il y a ${Math.floor(diff/86400)} jours`;
    return d.toLocaleDateString('fr-DZ', { day:'numeric', month:'short', year:'numeric' });
}

function formatSize(mb) {
    if (!mb) return '—';
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
}

// ============================================================
// TYPE CONFIG — icônes, couleurs, labels
// ============================================================
const TYPE_CONFIG = {
    'PDF':      { icon:'📄', badge:'PDF',   previewClass:'preview-pdf',   actionLabel:'📥 Télécharger', color:'#ef4444' },
    'PPT':      { icon:'📊', badge:'PPT',   previewClass:'preview-ppt',   actionLabel:'📥 Télécharger', color:'#f97316' },
    'Video':    { icon:'🎥', badge:'MP4',   previewClass:'preview-video',  actionLabel:'▶️ Regarder',    color:'#8b5cf6' },
    'Audio':    { icon:'🎵', badge:'MP3',   previewClass:'preview-audio',  actionLabel:'▶️ Écouter',     color:'#10b981' },
    'Exercice': { icon:'📝', badge:'EXO',   previewClass:'preview-excel',  actionLabel:'📥 Télécharger', color:'#3b82f6' },
    'Lien':     { icon:'🔗', badge:'LIEN',  previewClass:'preview-image',  actionLabel:'🔗 Ouvrir',      color:'#6366f1' },
};

function getTypeConfig(type) {
    return TYPE_CONFIG[type] || { icon:'📁', badge:'FILE', previewClass:'preview-pdf', actionLabel:'📥 Télécharger', color:'#64748b' };
}

// ============================================================
// CHARGER RESSOURCES DEPUIS L'API
// ============================================================
async function loadRessources() {
    const grid = document.querySelector('.resources-grid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem; color:#94a3b8;">
                <div style="font-size:2rem; margin-bottom:0.5rem;">⏳</div>
                <p>Chargement des ressources...</p>
            </div>`;
    }

    const data = await apiFetch('/ressources/');

    if (data?.error) {
        showToast('Erreur: ' + data.message, 'error');
        if (grid) grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem; color:#dc2626;">
                <div style="font-size:2rem;">⚠️</div>
                <p>${data.message}</p>
                <button onclick="loadRessources()" style="
                    margin-top:1rem; padding:8px 16px; background:#6366f1;
                    color:white; border:none; border-radius:8px; cursor:pointer;">
                    Réessayer
                </button>
            </div>`;
        return;
    }

    state.ressources = data;
    state.filtered   = data;

    // Remplir le dropdown des niveaux dynamiquement
    fillNiveauDropdown(data);

    renderGrid();
    renderDownloadHistory();
    updateStorageBar(data);
}

// ============================================================
// REMPLIR DROPDOWN NIVEAUX DYNAMIQUEMENT
// ============================================================
function fillNiveauDropdown(ressources) {
    const select = document.querySelectorAll('.filter-dropdown')[0];
    if (!select) return;

    const niveaux = [...new Set(ressources.map(r => r.niveau).filter(Boolean))].sort();
    select.innerHTML = `<option value="all">Toutes les matières</option>` +
        niveaux.map(n => `<option value="${n}">Niveau ${n}</option>`).join('');

    select.addEventListener('change', () => {
        state.filterNiveau = select.value;
        applyFilters();
    });
}

// ============================================================
// APPLIQUER FILTRES
// ============================================================
function applyFilters() {
    let result = [...state.ressources];

    // Filtre type
    if (state.filterType !== 'all') {
        result = result.filter(r => r.type_ressource === state.filterType);
    }

    // Filtre niveau
    if (state.filterNiveau !== 'all') {
        result = result.filter(r => r.niveau === state.filterNiveau);
    }

    // Filtre recherche
    if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        result = result.filter(r =>
            (r.titre       || '').toLowerCase().includes(term) ||
            (r.description || '').toLowerCase().includes(term)
        );
    }

    state.filtered = result;
    renderGrid();
}

// ============================================================
// RENDU GRILLE / LISTE
// ============================================================
function renderGrid() {
    const grid = document.querySelector('.resources-grid');
    if (!grid) return;

    // Mettre à jour titre section
    const sectionTitle = document.querySelector('.section-title');
    if (sectionTitle) {
        sectionTitle.textContent = state.searchTerm || state.filterType !== 'all'
            ? `🔍 ${state.filtered.length} résultat(s)`
            : '📌 Ressources Récentes';
    }

    if (!state.filtered.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:1rem;">📭</div>
                <p style="font-size:1.1rem; font-weight:600;">Aucune ressource trouvée</p>
                <p style="font-size:0.875rem; margin-top:0.5rem;">
                    ${state.searchTerm ? `Aucun résultat pour "${state.searchTerm}"` : 'Aucune ressource disponible pour ce filtre'}
                </p>
            </div>`;
        return;
    }

    // Trier par date décroissante
    const sorted = [...state.filtered].sort((a, b) =>
        new Date(b.date_creation) - new Date(a.date_creation)
    );

    if (state.viewMode === 'grid') {
        grid.style.display = 'grid';
        grid.innerHTML = sorted.map(r => renderCardGrid(r)).join('');
    } else {
        grid.style.display = 'block';
        grid.innerHTML = sorted.map(r => renderCardList(r)).join('');
    }
}

// ============================================================
// CARTE MODE GRILLE
// ============================================================
function renderCardGrid(r) {
    const cfg   = getTypeConfig(r.type_ressource);
    const tags  = [];
    if (r.niveau) tags.push(`<span class="tag">${r.niveau}</span>`);
    if (r.groupe_nom) tags.push(`<span class="tag">${r.groupe_nom}</span>`);

    return `
        <div class="resource-card" data-id="${r.id}" style="animation:fadeIn 0.4s ease;">
            <div class="resource-preview ${cfg.previewClass}">
                ${cfg.icon}
                <span class="resource-type-badge">${cfg.badge}</span>
            </div>
            <div class="resource-info">
                <h3 class="resource-title">${r.titre}</h3>
                <div class="resource-meta">
                    <span class="meta-item">📅 ${formatDate(r.date_creation)}</span>
                    ${r.taille_fichier ? `<span class="meta-item">💾 ${formatSize(r.taille_fichier)}</span>` : ''}
                    <span class="meta-item">👁️ ${r.nombre_telechargements || 0} vues</span>
                </div>
                ${tags.length ? `<div class="resource-tags">${tags.join('')}</div>` : ''}
                <div class="resource-actions">
                    <button class="action-btn primary"
                            onclick="handleAction(${r.id}, '${r.type_ressource}', '${r.url_lien || ''}', '${r.chemin_fichier || ''}', '${r.titre}')">
                        ${cfg.actionLabel}
                    </button>
                    <button class="action-btn"
                            onclick="showDetails(${r.id})">
                        👁️ Détails
                    </button>
                </div>
            </div>
        </div>`;
}

// ============================================================
// CARTE MODE LISTE
// ============================================================
function renderCardList(r) {
    const cfg = getTypeConfig(r.type_ressource);
    return `
        <div style="
            display:flex; align-items:center; gap:1rem;
            background:white; border-radius:12px; padding:1rem 1.25rem;
            margin-bottom:0.75rem; box-shadow:0 2px 4px rgba(0,0,0,0.06);
            border:1px solid transparent; transition:all 0.2s;
            animation:fadeIn 0.3s ease;"
            onmouseover="this.style.borderColor='#6366f1'"
            onmouseout="this.style.borderColor='transparent'">
            <div style="
                width:50px; height:50px; border-radius:10px;
                background:${cfg.color}20; display:flex;
                align-items:center; justify-content:center;
                font-size:1.5rem; flex-shrink:0;">
                ${cfg.icon}
            </div>
            <div style="flex:1; min-width:0;">
                <h4 style="font-size:0.95rem; font-weight:600; color:#1e293b; margin-bottom:4px;
                           white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${r.titre}
                </h4>
                <div style="display:flex; gap:1rem; font-size:0.8rem; color:#64748b;">
                    <span>📅 ${formatDate(r.date_creation)}</span>
                    ${r.taille_fichier ? `<span>💾 ${formatSize(r.taille_fichier)}</span>` : ''}
                    <span>👁️ ${r.nombre_telechargements || 0} vues</span>
                    ${r.niveau ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;">${r.niveau}</span>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
                <button class="action-btn primary"
                        onclick="handleAction(${r.id}, '${r.type_ressource}', '${r.url_lien || ''}', '${r.chemin_fichier || ''}', '${r.titre}')"
                        style="white-space:nowrap;">
                    ${cfg.actionLabel}
                </button>
            </div>
        </div>`;
}

// ============================================================
// ACTIONS — TÉLÉCHARGER / OUVRIR / ÉCOUTER
// ============================================================
async function handleAction(id, type, urlLien, cheminFichier, titre) {
    // Incrémenter le compteur
    await apiFetch(`/ressources/${id}/`, {
        method:  'PATCH',
        body:    JSON.stringify({ nombre_telechargements: (state.ressources.find(r => r.id === id)?.nombre_telechargements || 0) + 1 }),
    });

    // Mettre à jour localement
    const r = state.ressources.find(r => r.id === id);
    if (r) r.nombre_telechargements = (r.nombre_telechargements || 0) + 1;

    // Ajouter à l'historique local
    addToDownloadHistory({ titre, type, date: new Date().toISOString(), taille: r?.taille_fichier });

    if (urlLien) {
        window.open(urlLien, '_blank');
        showToast(`Ouverture de "${titre}"`, 'success');
        return;
    }

    if (cheminFichier) {
        const a = document.createElement('a');
        a.href     = cheminFichier;
        a.download = titre;
        a.click();
        showToast(`Téléchargement de "${titre}" démarré`, 'success');
        return;
    }

    showToast('Fichier non disponible pour le moment.', 'warning');
    renderGrid(); // refresh les compteurs
}

// ============================================================
// MODAL DÉTAILS
// ============================================================
function showDetails(id) {
    const r   = state.ressources.find(r => r.id === id);
    if (!r) return;
    const cfg = getTypeConfig(r.type_ressource);

    const modal = document.createElement('div');
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center; z-index:2000;`;
    modal.innerHTML = `
        <div style="background:white; border-radius:20px; padding:2rem;
                    width:90%; max-width:480px; animation:fadeIn 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="font-size:1.2rem; font-weight:700; color:#1e293b;">Détails de la ressource</h3>
                <button onclick="this.closest('[style*=fixed]').remove()"
                        style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#94a3b8;">×</button>
            </div>
            <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem;
                        padding:1rem; background:#f8fafc; border-radius:12px;">
                <div style="font-size:2.5rem;">${cfg.icon}</div>
                <div>
                    <h4 style="font-weight:600; color:#1e293b;">${r.titre}</h4>
                    <span style="font-size:0.8rem; color:#64748b;">${cfg.badge}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.9rem; color:#475569;">
                ${r.description ? `
                    <div style="padding:0.75rem; background:#f8fafc; border-radius:8px; font-style:italic;">
                        "${r.description}"
                    </div>` : ''}
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Type</span>
                    <strong>${r.type_ressource}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Niveau</span>
                    <strong>${r.niveau || '—'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Taille</span>
                    <strong>${formatSize(r.taille_fichier)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Ajouté le</span>
                    <strong>${formatDate(r.date_creation)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Enseignant</span>
                    <strong>${r.enseignant_nom || '—'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Téléchargements</span>
                    <strong>${r.nombre_telechargements || 0}</strong>
                </div>
            </div>
            <button onclick="handleAction(${r.id}, '${r.type_ressource}', '${r.url_lien || ''}', '${r.chemin_fichier || ''}', '${r.titre}'); this.closest('[style*=fixed]').remove();"
                    style="width:100%; margin-top:1.5rem; padding:0.875rem;
                           background:linear-gradient(135deg,#6366f1,#8b5cf6);
                           color:white; border:none; border-radius:10px;
                           font-weight:700; font-size:1rem; cursor:pointer;">
                ${cfg.actionLabel}
            </button>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ============================================================
// HISTORIQUE TÉLÉCHARGEMENTS (localStorage)
// ============================================================
function addToDownloadHistory(item) {
    const history = JSON.parse(localStorage.getItem('dl_history') || '[]');
    history.unshift(item);
    localStorage.setItem('dl_history', JSON.stringify(history.slice(0, 10)));
    renderDownloadHistory();
}

function renderDownloadHistory() {
    const list = document.querySelector('.download-list');
    if (!list) return;

    // Priorité : vrais téléchargements locaux, sinon les 3 premières ressources
    const history = JSON.parse(localStorage.getItem('dl_history') || '[]');

    const items = history.length
        ? history.slice(0, 3)
        : state.ressources.slice(0, 3).map(r => ({
            titre: r.titre,
            type:  r.type_ressource,
            date:  r.date_modification || r.date_creation,
            taille: r.taille_fichier,
        }));

    if (!items.length) {
        list.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#94a3b8;">Aucun téléchargement récent</div>`;
        return;
    }

    const cfg = (type) => getTypeConfig(type);

    list.innerHTML = items.map(item => `
        <div class="download-item" style="animation:fadeIn 0.3s ease;">
            <div class="download-icon">${cfg(item.type).icon}</div>
            <div class="download-info">
                <div class="download-title">${item.titre}</div>
                <div class="download-meta">
                    ${formatDate(item.date)}
                    ${item.taille ? ` • ${formatSize(item.taille)}` : ''}
                </div>
            </div>
            <div class="download-status">
                <span style="color:#059669;">✓</span>
                <span>Terminé</span>
            </div>
        </div>
    `).join('');
}

// ============================================================
// BARRE DE STOCKAGE
// ============================================================
function updateStorageBar(ressources) {
    const totalMB  = ressources.reduce((sum, r) => sum + (r.taille_fichier || 0), 0);
    const limitMB  = 1024; // 1 GB
    const pct      = Math.min(100, Math.round((totalMB / limitMB) * 100));

    const valEl  = document.querySelector('.storage-value');
    const fillEl = document.querySelector('.storage-fill');
    const legEl  = document.querySelector('.storage-legend');

    if (valEl)  valEl.textContent = `${formatSize(totalMB)} / 1 GB`;
    if (fillEl) {
        fillEl.style.width = `${pct}%`;
        fillEl.style.background = pct > 80
            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : 'linear-gradient(90deg, #6366f1, #8b5cf6)';
    }
    if (legEl) legEl.innerHTML = `
        <div class="legend-item">
            <div class="legend-dot"></div>
            <span>Documents (${pct}%)</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot gray"></div>
            <span>Disponible (${100 - pct}%)</span>
        </div>`;
}

// ============================================================
// BOUTONS CATÉGORIE (filtres type)
// ============================================================
function initCategoryBtns() {
    const typeMap = {
        'Toutes':         'all',
        'Cours PDF':      'PDF',
        'Vidéos':         'Video',
        'Audio':          'Audio',
        'Présentations':  'PPT',
        'Exercices':      'Exercice',
        'Examens blancs': 'Exercice',
    };

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const label = btn.textContent.trim().replace(/^[^\w]+/, '');
            state.filterType = typeMap[label] || 'all';
            applyFilters();
        });
    });
}

// ============================================================
// DROPDOWN TYPE (2ème select)
// ============================================================
function initTypeDropdown() {
    const selects = document.querySelectorAll('.filter-dropdown');
    if (selects.length < 2) return;
    const typeSelect = selects[1];

    typeSelect.innerHTML = `
        <option value="all">Tous les types</option>
        <option value="PDF">PDF</option>
        <option value="Video">Vidéo</option>
        <option value="Audio">Audio</option>
        <option value="PPT">Présentation</option>
        <option value="Exercice">Exercice</option>
        <option value="Lien">Lien</option>
    `;

    typeSelect.addEventListener('change', () => {
        state.filterType = typeSelect.value;
        // Sync boutons catégorie
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.category-btn')?.classList.add('active');
        applyFilters();
    });
}

// ============================================================
// RECHERCHE
// ============================================================
function initSearch() {
    const input = document.querySelector('.search-input input');
    if (!input) return;
    let timeout;
    input.addEventListener('input', e => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchTerm = e.target.value.trim();
            applyFilters();
        }, 300);
    });
}

// ============================================================
// TOGGLE GRILLE / LISTE
// ============================================================
function initViewToggle() {
    const btns = document.querySelectorAll('.view-btn');
    btns.forEach((btn, i) => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.viewMode = i === 0 ? 'grid' : 'list';
            renderGrid();
        });
    });
}

// ============================================================
// INJECT STYLES MANQUANTS
// ============================================================
function injectStyles() {
    if (document.getElementById('res-extra-styles')) return;
    const s = document.createElement('style');
    s.id = 'res-extra-styles';
    s.textContent = `
        @keyframes fadeIn {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .resource-card { transition: transform 0.2s, box-shadow 0.2s; }
        .resource-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .action-btn { transition: all 0.2s; }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    `;
    document.head.appendChild(s);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const user = checkSession();
    if (!user) return;

    injectStyles();
    initCategoryBtns();
    initTypeDropdown();
    initSearch();
    initViewToggle();

    await loadRessources();
});