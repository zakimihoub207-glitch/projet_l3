/**
 * Dashboard Secrétariat - Menu Radial + JWT
 * File: static/js/dash_secr.js
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
    if (!['Secretariat', 'Comptable', 'Dirigeant'].includes(user.role)) {
        window.location.href = '/login/';
        return null;
    }
    return user;
}

// ============================================================
// DÉCONNEXION — appelée depuis le menu radial ET la sidebar
// ============================================================
async function handleDisconnect(event) {
    if (event) event.preventDefault();

    if (!confirm('Voulez-vous vous déconnecter ?')) return;

    const refresh = localStorage.getItem('refresh_token') ||
                    sessionStorage.getItem('refresh_token');
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
// AFFICHER LE DASHBOARD — appelée depuis le menu radial
// ============================================================
function showDashboard(event) {
    if (event) event.preventDefault();

    const overlay   = document.getElementById('menu-overlay');
    const dashboard = document.getElementById('dashboard-content');

    if (overlay)   overlay.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');

    // Charger les données à la première ouverture
    loadAll();
}

// ============================================================
// CACHER LE DASHBOARD — retour au menu radial (bouton hamburger)
// ============================================================
function hideDashboard() {
    const overlay   = document.getElementById('menu-overlay');
    const dashboard = document.getElementById('dashboard-content');

    if (overlay)   overlay.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast-secr')?.remove();
    const colors = { success:'#059669', error:'#dc2626', warning:'#d97706', info:'#0284c7' };
    const icons  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
    const t = document.createElement('div');
    t.className = 'toast-secr';
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
function formatMontant(val) {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('fr-DZ').format(Math.round(val)) + ' DA';
}

function formatRelative(dateStr) {
    if (!dateStr) return '—';
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)     return 'Il y a quelques secondes';
    if (diff < 3600)   return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400)  return `Aujourd'hui, ${d.toLocaleTimeString('fr-DZ', { hour:'2-digit', minute:'2-digit' })}`;
    if (diff < 172800) return `Hier, ${d.toLocaleTimeString('fr-DZ', { hour:'2-digit', minute:'2-digit' })}`;
    return d.toLocaleDateString('fr-DZ', { day:'numeric', month:'short' });
}

function statutBadge(statut) {
    const map = {
        'Paye':               ['status-paid',    'Payé'],
        'Partiellement_paye': ['status-pending',  'Partiel'],
        'Impaye':             ['status-unpaid',   'Impayé'],
        'Actif':              ['status-active',   'Actif'],
        'Active':             ['status-active',   'Actif'],
        'Suspendu':           ['status-pending',  'Suspendu'],
        'Inactif':            ['status-unpaid',   'Inactif'],
    };
    const [cls, label] = map[statut] || ['status-pending', statut];
    return `<span class="status-badge ${cls}">${label}</span>`;
}

// ============================================================
// SKELETON LOADER
// ============================================================
function setSkeleton(el, w = '80px', h = '1.5rem') {
    if (!el) return;
    el.innerHTML = `<span style="
        display:inline-block; width:${w}; height:${h};
        background:linear-gradient(90deg,#e2e8f0 25%,#cbd5e1 50%,#e2e8f0 75%);
        background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px;
    ">&nbsp;</span>`;
}

if (!document.getElementById('secr-shimmer')) {
    const s = document.createElement('style');
    s.id = 'secr-shimmer';
    s.textContent = `
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .hidden { display: none !important; }
    `;
    document.head.appendChild(s);
}

// ============================================================
// STATS FINANCIÈRES (4 cartes gauche)
// ============================================================
async function loadFinanceStats() {
    const statVals = document.querySelectorAll('.financial-section .stat-value');
    statVals.forEach(el => setSkeleton(el, '90px', '1.5rem'));

    const data = await apiFetch('/dashboard/');
    if (data?.error) {
        showToast('Erreur stats: ' + data.message, 'error');
        statVals.forEach(el => { el.textContent = '—'; });
        return;
    }

    const fin = data.finances;
    const values = [
        formatMontant(fin.revenus_collectes),
        formatMontant(fin.salaires_verses),
        formatMontant(fin.solde),
        fin.impayés > 0 ? Math.round(fin.impayés / 8000) : '0',
    ];

    statVals.forEach((el, i) => {
        el.textContent = values[i] ?? '—';
        el.style.animation = 'fadeIn 0.4s ease';
    });

    // Trends
    const trends = document.querySelectorAll('.financial-section .stat-trend');
    if (trends[0]) {
        trends[0].textContent = `${fin.taux_paiement}%`;
        trends[0].className   = `stat-trend ${fin.taux_paiement >= 80 ? 'trend-up' : 'trend-down'}`;
    }
}

// ============================================================
// STATS PERSONNEL (4 cartes droite)
// ============================================================
async function loadPersonnelStats() {
    const statVals = document.querySelectorAll('.personnel-section .stat-value');
    statVals.forEach(el => setSkeleton(el, '60px', '1.5rem'));

    const data = await apiFetch('/dashboard/');
    if (data?.error) {
        statVals.forEach(el => { el.textContent = '—'; });
        return;
    }

    const values = [
        data.etudiants,
        data.enseignants,
        data.groupes,
        data.pedagogie.nb_absences,
    ];

    statVals.forEach((el, i) => {
        el.textContent = values[i] ?? '—';
        el.style.animation = 'fadeIn 0.4s ease';
    });

    // Badge étudiants dans le menu radial
    const badge = document.querySelector('.item-badge');
    if (badge) badge.textContent = data.etudiants;
}

// ============================================================
// DERNIERS PAIEMENTS (liste gauche)
// ============================================================
async function loadDerniersPaiements() {
    const containers = document.querySelectorAll('.financial-section .list-container');
    const container  = containers[0];
    if (!container) return;

    container.querySelectorAll('.list-item').forEach(el => el.remove());

    const loading = document.createElement('div');
    loading.style.cssText = 'text-align:center;padding:1.5rem;color:#94a3b8;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
    container.appendChild(loading);

    const data = await apiFetch('/paiements/');
    loading.remove();

    if (data?.error || !data.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:1.5rem;color:#94a3b8;font-size:0.875rem;';
        empty.textContent = 'Aucun paiement récent.';
        container.appendChild(empty);
        return;
    }

    const sorted = [...data].sort((a, b) =>
        new Date(b.date_creation || b.date_paiement) - new Date(a.date_creation || a.date_paiement)
    ).slice(0, 4);

    sorted.forEach(p => {
        const isPositif = p.statut_paiement === 'Paye';
        const montant   = isPositif
            ? `+${formatMontant(p.montant_paye)}`
            : `-${formatMontant(parseFloat(p.montant_du) - parseFloat(p.montant_paye))}`;

        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.animation = 'fadeIn 0.4s ease';
        item.innerHTML = `
            <div class="item-icon"><i class="fas fa-user-graduate"></i></div>
            <div class="item-info">
                <h4>${p.etudiant_nom || '—'}</h4>
                <p>${p.periode || 'Paiement'} — ${p.mode_paiement || ''}</p>
            </div>
            <div class="item-amount">
                <div class="amount ${isPositif ? 'positive' : 'negative'}">${montant}</div>
                <div class="date">${formatRelative(p.date_creation || p.date_paiement)}</div>
            </div>
            ${statutBadge(p.statut_paiement)}`;
        container.appendChild(item);
    });
}

// ============================================================
// ACTIVITÉS RÉCENTES (liste droite)
// ============================================================
async function loadActivitesRecentes() {
    const containers = document.querySelectorAll('.personnel-section .list-container');
    const container  = containers[0];
    if (!container) return;

    container.querySelectorAll('.list-item').forEach(el => el.remove());

    const loading = document.createElement('div');
    loading.style.cssText = 'text-align:center;padding:1.5rem;color:#94a3b8;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
    container.appendChild(loading);

    const [etudiants, absences] = await Promise.all([
        apiFetch('/etudiants/'),
        apiFetch('/absences/?statut=Absent'),
    ]);

    loading.remove();

    const activites = [];

    if (!etudiants?.error && etudiants.length) {
        [...etudiants]
            .sort((a, b) => new Date(b.date_inscription) - new Date(a.date_inscription))
            .slice(0, 2)
            .forEach(e => {
                const nom = e.user?.nom_complet ||
                            `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.trim();
                activites.push({
                    icon:   'fas fa-user-plus',
                    titre:  'Nouvel Étudiant',
                    detail: `${nom} - ${e.groupe_nom || 'Sans groupe'}`,
                    statut: 'status-active',
                    label:  'Nouveau',
                    date:   e.date_inscription,
                });
            });
    }

    if (!absences?.error && absences.length) {
        const countMap = {};
        absences.forEach(a => { countMap[a.etudiant] = (countMap[a.etudiant] || 0) + 1; });
        Object.entries(countMap)
            .filter(([, count]) => count >= 3)
            .slice(0, 2)
            .forEach(([etudiantId, count]) => {
                const etudiant = etudiants?.find?.(e => e.id == etudiantId);
                const nom = etudiant?.user?.nom_complet || `Étudiant #${etudiantId}`;
                activites.push({
                    icon:   'fas fa-exclamation-circle',
                    titre:  'Alerte Absences',
                    detail: `${nom} - ${count} absences`,
                    statut: 'status-pending',
                    label:  'À traiter',
                    date:   new Date().toISOString(),
                });
            });
    }

    if (!activites.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:1.5rem;color:#94a3b8;font-size:0.875rem;';
        empty.textContent = 'Aucune activité récente.';
        container.appendChild(empty);
        return;
    }

    activites.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(act => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.animation = 'fadeIn 0.4s ease';
        item.innerHTML = `
            <div class="item-icon"><i class="${act.icon}"></i></div>
            <div class="item-info">
                <h4>${act.titre}</h4>
                <p>${act.detail}</p>
            </div>
            <div class="item-amount">
                <span class="status-badge ${act.statut}">${act.label}</span>
                <div class="date">${formatRelative(act.date)}</div>
            </div>`;
        container.appendChild(item);
    });
}

// ============================================================
// MODAL NOUVEAU PAIEMENT
// ============================================================
async function openModalPaiement() {
    const etudiants = await apiFetch('/etudiants/?statut=Actif');

    const modal = document.createElement('div');
    modal.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center; z-index:3000;`;

    modal.innerHTML = `
        <div style="background:white; border-radius:20px; padding:2rem;
                    width:90%; max-width:500px; animation:fadeIn 0.3s ease;"
             onclick="event.stopPropagation()">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="font-size:1.2rem; font-weight:700; color:#1e293b;">
                    <i class="fas fa-money-bill-wave" style="color:#10b981; margin-right:8px;"></i>
                    Nouveau Paiement
                </h3>
                <button id="closePaiement" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">×</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label style="${lbl()}">Étudiant *</label>
                    <select id="pay_etudiant" style="${inp()}">
                        <option value="">-- Choisir un étudiant --</option>
                        ${!etudiants?.error ? etudiants.map(e =>
                            `<option value="${e.id}">${e.user?.first_name || ''} ${e.user?.last_name || ''}</option>`
                        ).join('') : ''}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="${lbl()}">Montant dû (DA) *</label>
                        <input type="number" id="pay_du" placeholder="8000" style="${inp()}">
                    </div>
                    <div>
                        <label style="${lbl()}">Montant payé (DA) *</label>
                        <input type="number" id="pay_paye" placeholder="8000" style="${inp()}">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="${lbl()}">Mode *</label>
                        <select id="pay_mode" style="${inp()}">
                            <option value="Especes">Espèces</option>
                            <option value="Cheque">Chèque</option>
                            <option value="Virement">Virement</option>
                            <option value="Carte">Carte</option>
                        </select>
                    </div>
                    <div>
                        <label style="${lbl()}">Période</label>
                        <input type="text" id="pay_periode" placeholder="Avril 2026" style="${inp()}">
                    </div>
                </div>
                <div>
                    <label style="${lbl()}">Date *</label>
                    <input type="date" id="pay_date" style="${inp()}">
                </div>
                <button id="btnSavePaiement" style="width:100%; padding:0.875rem; border:none;
                    border-radius:10px; background:linear-gradient(135deg,#10b981,#059669);
                    color:white; font-weight:700; font-size:1rem; cursor:pointer; margin-top:0.5rem;">
                    <i class="fas fa-save"></i> Enregistrer
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.getElementById('pay_date').valueAsDate = new Date();

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('closePaiement').addEventListener('click', () => modal.remove());

    document.getElementById('btnSavePaiement').addEventListener('click', async () => {
        const etudiantId  = document.getElementById('pay_etudiant').value;
        const montantDu   = parseFloat(document.getElementById('pay_du').value);
        const montantPaye = parseFloat(document.getElementById('pay_paye').value);
        const mode        = document.getElementById('pay_mode').value;
        const date        = document.getElementById('pay_date').value;
        const periode     = document.getElementById('pay_periode').value;

        if (!etudiantId || !montantDu || !montantPaye || !date) {
            showToast('Remplissez tous les champs obligatoires.', 'warning');
            return;
        }

        let statut = 'Paye';
        if (montantPaye < montantDu) statut = 'Partiellement_paye';
        if (montantPaye === 0)       statut = 'Impaye';

        const btn = document.getElementById('btnSavePaiement');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        btn.disabled  = true;

        const result = await apiFetch('/paiements/', {
            method: 'POST',
            body:   JSON.stringify({
                etudiant: parseInt(etudiantId),
                montant_du: montantDu, montant_paye: montantPaye,
                mode_paiement: mode, date_paiement: date,
                periode, statut_paiement: statut,
            }),
        });

        if (result?.error) {
            showToast('Erreur: ' + result.message, 'error');
            btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
            btn.disabled  = false;
            return;
        }

        modal.remove();
        showToast('Paiement enregistré !', 'success');
        loadAll();
    });
}

// ============================================================
// MODAL NOUVEL ÉTUDIANT
// ============================================================
async function openModalEtudiant() {
    const groupes = await apiFetch('/groupes/?statut=Actif');

    const modal = document.createElement('div');
    modal.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center; z-index:3000;`;

    modal.innerHTML = `
        <div style="background:white; border-radius:20px; padding:2rem;
                    width:90%; max-width:520px; max-height:90vh; overflow-y:auto;
                    animation:fadeIn 0.3s ease;"
             onclick="event.stopPropagation()">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="font-size:1.2rem; font-weight:700; color:#1e293b;">
                    <i class="fas fa-user-plus" style="color:#6366f1; margin-right:8px;"></i>
                    Nouvel Étudiant
                </h3>
                <button id="closeEtu" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">×</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="${lbl()}">Prénom *</label>
                        <input type="text" id="etu_prenom" placeholder="Ahmed" style="${inp()}">
                    </div>
                    <div>
                        <label style="${lbl()}">Nom *</label>
                        <input type="text" id="etu_nom" placeholder="Benali" style="${inp()}">
                    </div>
                </div>
                <div>
                    <label style="${lbl()}">Email *</label>
                    <input type="email" id="etu_email" placeholder="ahmed@email.com" style="${inp()}">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="${lbl()}">Téléphone *</label>
                        <input type="text" id="etu_tel" placeholder="0555 123 456" style="${inp()}">
                    </div>
                    <div>
                        <label style="${lbl()}">Date naissance *</label>
                        <input type="date" id="etu_naissance" style="${inp()}">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="${lbl()}">Groupe</label>
                        <select id="etu_groupe" style="${inp()}">
                            <option value="">-- Aucun --</option>
                            ${!groupes?.error ? groupes.map(g =>
                                `<option value="${g.id}">${g.nom_groupe} — ${g.niveau}</option>`
                            ).join('') : ''}
                        </select>
                    </div>
                    <div>
                        <label style="${lbl()}">Niveau</label>
                        <select id="etu_niveau" style="${inp()}">
                            <option value="A1">A1 - Débutant</option>
                            <option value="A2">A2 - Élémentaire</option>
                            <option value="B1">B1 - Intermédiaire</option>
                            <option value="B2">B2 - Confirmé</option>
                            <option value="C1">C1 - Avancé</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="${lbl()}">Mot de passe provisoire *</label>
                    <input type="password" id="etu_pwd" placeholder="Minimum 6 caractères" style="${inp()}">
                </div>
                <button id="btnSaveEtu" style="width:100%; padding:0.875rem; border:none;
                    border-radius:10px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:white; font-weight:700; font-size:1rem; cursor:pointer; margin-top:0.5rem;">
                    <i class="fas fa-user-plus"></i> Inscrire l'étudiant
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('closeEtu').addEventListener('click', () => modal.remove());

    document.getElementById('btnSaveEtu').addEventListener('click', async () => {
        const prenom    = document.getElementById('etu_prenom').value.trim();
        const nom       = document.getElementById('etu_nom').value.trim();
        const email     = document.getElementById('etu_email').value.trim();
        const tel       = document.getElementById('etu_tel').value.trim();
        const naissance = document.getElementById('etu_naissance').value;
        const groupe    = document.getElementById('etu_groupe').value;
        const niveau    = document.getElementById('etu_niveau').value;
        const pwd       = document.getElementById('etu_pwd').value;

        if (!prenom || !nom || !email || !tel || !naissance || !pwd) {
            showToast('Remplissez tous les champs obligatoires.', 'warning');
            return;
        }
        if (pwd.length < 6) {
            showToast('Le mot de passe doit faire au moins 6 caractères.', 'warning');
            return;
        }

        const btn = document.getElementById('btnSaveEtu');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
        btn.disabled  = true;

        const result = await apiFetch('/etudiants/', {
            method: 'POST',
            body:   JSON.stringify({
                email, first_name: prenom, last_name: nom,
                password: pwd, telephone: tel,
                date_naissance: naissance,
                id_groupe: groupe || null,
                niveau_initial: niveau,
            }),
        });

        if (result?.error) {
            showToast('Erreur: ' + result.message, 'error');
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Inscrire l\'étudiant';
            btn.disabled  = false;
            return;
        }

        modal.remove();
        showToast(`${prenom} ${nom} inscrit avec succès !`, 'success');
        loadAll();
    });
}

// ============================================================
// HELPERS STYLE
// ============================================================
function inp() {
    return `width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:10px;
            font-size:0.9rem; outline:none; box-sizing:border-box; font-family:inherit; background:#f9fafb;`;
}
function lbl() {
    return `font-size:0.875rem; font-weight:600; color:#374151; display:block; margin-bottom:6px;`;
}

// ============================================================
// SETUP BOUTONS DASHBOARD
// ============================================================
function setupButtons() {
    // Bouton notifications (header)
    document.querySelector('.header-actions .fa-bell')
        ?.closest('button')
        ?.addEventListener('click', async () => {
            const data = await apiFetch('/notifications/?statut=Non_lu');
            if (!data?.error) {
                showToast(data.length > 0
                    ? `${data.length} notification(s) non lue(s).`
                    : 'Aucune nouvelle notification.', 'info');
            }
        });

    // Quick actions FINANCIER
    const finBtns = document.querySelectorAll('.financial-section .quick-btn');
    if (finBtns[0]) finBtns[0].addEventListener('click', openModalPaiement);
    if (finBtns[1]) finBtns[1].addEventListener('click', () => showToast('Fonctionnalité en développement.', 'warning'));
    if (finBtns[2]) finBtns[2].addEventListener('click', () => showToast('Fonctionnalité en développement.', 'warning'));
    if (finBtns[3]) finBtns[3].addEventListener('click', async () => {
        const r = await apiFetch('/paiements/?statut=Impaye');
        if (!r?.error) showToast(`${r.length} relance(s) en attente.`, 'info');
    });

    // Quick actions PERSONNEL
    const persBtns = document.querySelectorAll('.personnel-section .quick-btn');
    if (persBtns[0]) persBtns[0].addEventListener('click', openModalEtudiant);
    if (persBtns[1]) persBtns[1].addEventListener('click', () => showToast('Fonctionnalité en développement.', 'warning'));
    if (persBtns[2]) persBtns[2].addEventListener('click', () => showToast('Fonctionnalité en développement.', 'warning'));
    if (persBtns[3]) persBtns[3].addEventListener('click', () => showToast('Fonctionnalité en développement.', 'warning'));

    // Liens "Voir tout"
    document.querySelectorAll('.btn-view-all').forEach((link, i) => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const urls = ['/comptable/paiements/', '/secretariat/etudiants/'];
            if (urls[i]) window.location.href = urls[i];
        });
    });
}

// ============================================================
// LOAD ALL
// ============================================================
let dataLoaded = false;

async function loadAll() {
    await Promise.all([
        loadFinanceStats(),
        loadPersonnelStats(),
        loadDerniersPaiements(),
        loadActivitesRecentes(),
    ]);
    dataLoaded = true;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const user = checkSession();
    if (!user) return;

    setupButtons();

    // Auto-refresh toutes les 2 minutes si le dashboard est visible
    setInterval(() => {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard && !dashboard.classList.contains('hidden')) {
            loadAll();
        }
    }, 120000);
});