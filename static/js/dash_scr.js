// ============================================================
// CONFIG
// ============================================================
const API_URL = 'http://127.0.0.1:8000/api';

// ============================================================
// AUTH HELPERS
// ============================================================
function getToken() {
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user'));
    } catch { return null; }
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

// ============================================================
// VÉRIFIER SESSION
// ============================================================
function checkSession() {
    const token = getToken();
    const user  = getUser();
    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }
    // Remplir la sidebar avec les infos de l'utilisateur connecté
    document.getElementById('userName').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('userRole').textContent = user.role;
    document.getElementById('userAvatar').textContent =
        `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    return true;
}

// ============================================================
// DÉCONNEXION
// ============================================================
async function logout() {
    const refresh = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    try {
        await fetch(`${API_URL}/auth/logout/`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ refresh })
        });
    } catch(e) {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success') {
    const icons = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        warning: 'fa-triangle-exclamation'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// MODALS
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// Fermer en cliquant en dehors du modal
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('show');
    });
});

// ============================================================
// FORMATAGE
// ============================================================
function formatMontant(val) {
    return new Intl.NumberFormat('fr-DZ').format(Math.round(val)) + ' DA';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)     return 'Il y a quelques secondes';
    if (diff < 3600)   return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400)  return `Il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 172800) return 'Hier';
    return d.toLocaleDateString('fr-DZ');
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
// APPEL API GÉNÉRIQUE
// ============================================================
async function apiFetch(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.json();
}

// ============================================================
// CHARGER KPIs DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const data = await apiFetch('/dashboard/');
        if (!data) return;

        // --- Finances ---
        document.getElementById('statRevenus').textContent  = formatMontant(data.finances.revenus_collectes);
        document.getElementById('statImpayes').textContent  = formatMontant(data.finances.impayés);
        document.getElementById('statTaux').textContent     = `${data.finances.taux_paiement}%`;
        document.getElementById('statSalaires').textContent = formatMontant(data.finances.salaires_verses);

        const trendTaux = document.getElementById('trendTaux');
        trendTaux.textContent = `${data.finances.taux_paiement}%`;
        trendTaux.className   = `stat-trend ${data.finances.taux_paiement >= 80 ? 'trend-up' : 'trend-down'}`;

        document.getElementById('trendRevenus').textContent = '↑ mois';
        document.getElementById('trendImpayes').textContent = data.finances.impayés > 0 ? '⚠' : '✓';

        // --- Personnel ---
        document.getElementById('statEtudiants').textContent   = data.etudiants;
        document.getElementById('statEnseignants').textContent = data.enseignants;
        document.getElementById('statGroupes').textContent     = data.groupes;
        document.getElementById('statAbsences').textContent    = data.pedagogie.nb_absences;

        document.getElementById('trendEtudiants').textContent  = `+${data.etudiants}`;
        document.getElementById('trendEnseignants').textContent = data.enseignants;
        document.getElementById('trendGroupes').textContent    = data.groupes;

        // Badge sidebar
        document.getElementById('badgeEtudiants').textContent = data.etudiants;

    } catch(e) {
        showToast('Erreur chargement dashboard', 'error');
        console.error(e);
    }
}

// ============================================================
// CHARGER PAIEMENTS RÉCENTS
// ============================================================
async function loadPaiements() {
    const container = document.getElementById('listePaiements');
    try {
        const data = await apiFetch('/paiements/');
        if (!data || !data.length) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><br>Aucun paiement</div>`;
            return;
        }
        container.innerHTML = data.slice(0, 4).map(p => `
            <div class="list-item">
                <div class="item-icon"><i class="fas fa-user-graduate"></i></div>
                <div class="item-info">
                    <h4>${p.etudiant_nom || '—'}</h4>
                    <p>${p.periode || 'Paiement'} — ${p.mode_paiement}</p>
                </div>
                <div class="item-amount">
                    <div class="amount ${parseFloat(p.solde) > 0 ? 'negative' : 'positive'}">
                        ${formatMontant(p.montant_paye)}
                    </div>
                    <div class="date">${formatDate(p.date_creation)}</div>
                </div>
                ${statutBadge(p.statut_paiement)}
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><br>Erreur chargement</div>`;
    }
}

// ============================================================
// CHARGER DERNIERS ÉTUDIANTS
// ============================================================
async function loadEtudiants() {
    const container = document.getElementById('listeEtudiants');
    try {
        const data = await apiFetch('/etudiants/');
        if (!data || !data.length) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><br>Aucun étudiant</div>`;
            return;
        }
        container.innerHTML = data.slice(0, 4).map(e => `
            <div class="list-item">
                <div class="item-icon"><i class="fas fa-user-graduate"></i></div>
                <div class="item-info">
                    <h4>${e.user?.first_name || ''} ${e.user?.last_name || ''}</h4>
                    <p>${e.groupe_nom || 'Sans groupe'} — Niveau ${e.niveau_actuel}</p>
                </div>
                <div class="item-amount">
                    ${statutBadge(e.statut_etudiant)}
                    <div class="date">${formatDate(e.date_inscription)}</div>
                </div>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><br>Erreur chargement</div>`;
    }
}

// ============================================================
// CHARGER GROUPES (select du modal étudiant)
// ============================================================
async function loadGroupesSelect() {
    try {
        const data = await apiFetch('/groupes/?statut=Actif');
        if (!data) return;
        const select = document.getElementById('etudiant_groupe');
        data.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = `${g.nom_groupe} — ${g.langue} ${g.niveau} (${g.places_restantes} places)`;
            select.appendChild(opt);
        });
    } catch(e) { console.error('Groupes select:', e); }
}

// ============================================================
// CHARGER ÉTUDIANTS (select du modal paiement)
// ============================================================
async function loadEtudiantsSelect() {
    try {
        const data = await apiFetch('/etudiants/');
        if (!data) return;
        const select = document.getElementById('paiement_etudiant');
        data.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = `${e.user?.first_name || ''} ${e.user?.last_name || ''}`;
            select.appendChild(opt);
        });
    } catch(e) { console.error('Étudiants select:', e); }
}

// ============================================================
// CHARGER NOTIFICATIONS
// ============================================================
async function loadNotifications() {
    try {
        const data = await apiFetch('/notifications/?statut=Non_lu');
        if (!data) return;
        if (data.length > 0) {
            document.getElementById('notifDot').classList.add('show');
        }
    } catch(e) {}
}

// ============================================================
// FORMULAIRE — NOUVEAU PAIEMENT
// ============================================================
document.getElementById('formPaiement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitPaiement');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

    const montantDu   = parseFloat(document.getElementById('paiement_du').value);
    const montantPaye = parseFloat(document.getElementById('paiement_paye').value);

    let statut = 'Paye';
    if (montantPaye < montantDu) statut = 'Partiellement_paye';
    if (montantPaye === 0)       statut = 'Impaye';

    const payload = {
        etudiant:        parseInt(document.getElementById('paiement_etudiant').value),
        montant_du:      montantDu,
        montant_paye:    montantPaye,
        mode_paiement:   document.getElementById('paiement_mode').value,
        date_paiement:   document.getElementById('paiement_date').value,
        periode:         document.getElementById('paiement_periode').value,
        statut_paiement: statut,
    };

    try {
        const res = await fetch(`${API_URL}/paiements/`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Paiement enregistré avec succès !', 'success');
            closeModal('modalPaiement');
            document.getElementById('formPaiement').reset();
            document.getElementById('paiement_date').valueAsDate = new Date();
            loadAll();
        } else {
            const err = await res.json();
            showToast(JSON.stringify(err), 'error');
        }
    } catch(err) {
        showToast('Erreur réseau', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer le paiement';
    }
});

// ============================================================
// FORMULAIRE — NOUVEL ÉTUDIANT
// ============================================================
document.getElementById('formEtudiant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitEtudiant');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';

    const payload = {
        email:          document.getElementById('etudiant_email').value,
        first_name:     document.getElementById('etudiant_prenom').value,
        last_name:      document.getElementById('etudiant_nom').value,
        password:       document.getElementById('etudiant_pwd').value,
        telephone:      document.getElementById('etudiant_tel').value,
        date_naissance: document.getElementById('etudiant_naissance').value,
        id_groupe:      document.getElementById('etudiant_groupe').value || null,
        niveau_initial: document.getElementById('etudiant_niveau').value,
    };

    try {
        const res = await fetch(`${API_URL}/etudiants/`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast(`Étudiant ${payload.first_name} inscrit avec succès !`, 'success');
            closeModal('modalEtudiant');
            document.getElementById('formEtudiant').reset();
            loadAll();
        } else {
            const err = await res.json();
            const msg = Object.values(err).flat().join(' | ');
            showToast(msg, 'error');
        }
    } catch(err) {
        showToast('Erreur réseau', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Inscrire l\'étudiant';
    }
});

// ============================================================
// LOAD ALL — tout rafraîchir en une fois
// ============================================================
async function loadAll() {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('fa-spin');
    await Promise.all([
        loadDashboard(),
        loadPaiements(),
        loadEtudiants(),
        loadNotifications(),
    ]);
    icon.classList.remove('fa-spin');
}

// ============================================================
// INIT
// ============================================================
// Date par défaut dans le formulaire paiement
document.getElementById('paiement_date').valueAsDate = new Date();

if (checkSession()) {
    loadAll();
    loadGroupesSelect();
    loadEtudiantsSelect();
    // Auto-refresh toutes les 2 minutes
    setInterval(loadAll, 120000);
}
