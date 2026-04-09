/**
 * Gestion des Absences - Enseignant
 * JWT Authentication + Django REST API
 * File: static/js/absences.js
 */

// ============================================================
// CONFIG
// ============================================================
const API_URL = '/api';

// État global de la page
const state = {
    etudiants:    [],      // liste des étudiants du groupe
    seance:       null,    // séance du jour
    groupe:       null,    // groupe actuel
    absences:     {},      // { etudiantId: 'Present' | 'Absent' | 'Retard' | 'Justifie' }
    savedIds:     {},      // { etudiantId: absenceId } — IDs déjà sauvegardés en DB
    saving:       false,
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

        if (res.status === 401) return { error: 'JWT_INVALID',    message: 'Token invalide.' };
        if (res.status === 403) return { error: 'FORBIDDEN',      message: 'Accès refusé.' };
        if (!res.ok)            return { error: 'API_ERROR',       message: `Erreur ${res.status}` };

        // 204 No Content
        if (res.status === 204) return { success: true };

        const ct = res.headers.get('content-type');
        return ct?.includes('application/json') ? await res.json() : await res.text();

    } catch (e) {
        console.error('Network error:', e);
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
    if (!['Enseignant', 'Dirigeant'].includes(user.role)) { window.location.href = '/login/'; return null; }
    return user;
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    document.querySelector('.toast-abs')?.remove();
    const colors = { success: '#059669', error: '#dc2626', warning: '#d97706', info: '#0284c7' };
    const icons  = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const t = document.createElement('div');
    t.className = 'toast-abs';
    t.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        padding:14px 22px; border-radius:12px;
        background:${colors[type] || colors.info}; color:white;
        font-weight:500; font-size:0.9rem;
        box-shadow:0 8px 24px rgba(0,0,0,0.2);
        display:flex; align-items:center; gap:8px;
        transform:translateX(120%); opacity:0;
        transition:all 0.3s ease;
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
// ALERT CONTAINER (alertes importantes sur la page)
// ============================================================
function showAlert(message, type = 'warning') {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    const colors = { warning: '#fef3c7', error: '#fee2e2', success: '#d1fae5', info: '#dbeafe' };
    const textColors = { warning: '#92400e', error: '#991b1b', success: '#065f46', info: '#1e40af' };

    const alert = document.createElement('div');
    alert.style.cssText = `
        margin-top: 1rem; padding: 1rem 1.25rem; border-radius: 12px;
        background: ${colors[type]}; color: ${textColors[type]};
        font-weight: 500; display: flex; align-items: center; gap: 0.75rem;
        animation: fadeInDown 0.3s ease;
    `;
    alert.innerHTML = `
        <span style="font-size:1.2rem;">${type === 'warning' ? '⚠️' : type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()"
                style="margin-left:auto; background:none; border:none; cursor:pointer;
                       font-size:1.1rem; color:${textColors[type]};">×</button>
    `;
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 6000);
}

// ============================================================
// DATE — Remplir les infos date du jour
// ============================================================
function fillDateInfo() {
    const now   = new Date();
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mois  = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    const day     = document.getElementById('currentDay');
    const month   = document.getElementById('currentMonth');
    const weekday = document.getElementById('currentWeekday');
    const week    = document.getElementById('currentWeek');

    if (day)     day.textContent     = now.getDate();
    if (month)   month.textContent   = mois[now.getMonth()];
    if (weekday) weekday.textContent = jours[now.getDay()];

    // Numéro de semaine
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    if (week) week.textContent = `Semaine ${weekNum}`;
}

// ============================================================
// CHARGER GROUPE + SÉANCE DU JOUR
// ============================================================
async function loadGroupeAndSeance() {
    // Récupérer le groupe depuis l'URL ou le premier groupe de l'enseignant
    const urlParams = new URLSearchParams(window.location.search);
    const groupeId  = urlParams.get('groupe');

    // Charger les groupes de l'enseignant
    const groupes = await apiFetch('/groupes/?statut=Actif');
    if (groupes?.error || !groupes.length) {
        document.getElementById('groupName').textContent   = 'Aucun groupe actif';
        document.getElementById('sessionDetails').textContent = 'Assignez un groupe d\'abord';
        showAlert('Vous n\'avez aucun groupe actif assigné.', 'warning');
        return;
    }

    // Prendre le groupe de l'URL ou le premier
    state.groupe = groupeId
        ? groupes.find(g => g.id == groupeId) || groupes[0]
        : groupes[0];

    document.getElementById('groupName').textContent = state.groupe.nom_groupe;

    // Chercher la séance du jour
    const today   = new Date().toISOString().split('T')[0];
    const seances = await apiFetch(`/seances/?groupe=${state.groupe.id}`);

    if (!seances?.error && seances.length) {
        state.seance = seances.find(s => s.date_seance === today) || seances[0];
        document.getElementById('sessionDetails').textContent =
            `${state.seance.heure_debut?.slice(0, 5)} → ${state.seance.heure_fin?.slice(0, 5)} • Salle ${state.seance.salle}`;
    } else {
        document.getElementById('sessionDetails').textContent = 'Aucune séance trouvée pour aujourd\'hui';
        showAlert('Aucune séance enregistrée pour aujourd\'hui. Vous pouvez quand même saisir les absences.', 'info');
    }

    // Charger les étudiants du groupe
    await loadEtudiants();
}

// ============================================================
// CHARGER ÉTUDIANTS
// ============================================================
async function loadEtudiants() {
    const list = document.getElementById('studentList');
    list.innerHTML = `
        <div style="text-align:center; padding:3rem;">
            <div style="width:50px; height:50px; border:4px solid #e2e8f0;
                        border-top-color:#667eea; border-radius:50%;
                        animation:spin 1s linear infinite; margin:0 auto 1rem;"></div>
            <p style="color:#64748b;">Chargement des étudiants...</p>
        </div>`;

    const data = await apiFetch(`/etudiants/?groupe=${state.groupe.id}`);

    if (data?.error) {
        list.innerHTML = `
            <div style="text-align:center; padding:3rem; color:#dc2626;">
                <div style="font-size:2rem; margin-bottom:0.5rem;">⚠️</div>
                <p>${data.message}</p>
                <button onclick="loadEtudiants()"
                        style="margin-top:1rem; padding:8px 16px; background:#667eea;
                               color:white; border:none; border-radius:8px; cursor:pointer;">
                    Réessayer
                </button>
            </div>`;
        return;
    }

    state.etudiants = data;
    document.getElementById('totalStudents').textContent = data.length;

    // Tous présents par défaut
    data.forEach(e => { state.absences[e.id] = 'Present'; });

    // Charger les absences déjà saisies si séance existe
    if (state.seance) {
        await loadExistingAbsences();
    }

    renderStudentList();
    updateStats();
}

// ============================================================
// CHARGER ABSENCES DÉJÀ SAUVEGARDÉES EN DB
// ============================================================
async function loadExistingAbsences() {
    const data = await apiFetch(`/absences/?seance=${state.seance.id}`);
    if (data?.error || !data.length) return;

    data.forEach(abs => {
        state.absences[abs.etudiant] = abs.statut_absence;
        state.savedIds[abs.etudiant] = abs.id; // garder l'ID pour les PUT
    });
}

// ============================================================
// RENDU DE LA LISTE DES ÉTUDIANTS
// ============================================================
function renderStudentList() {
    const list = document.getElementById('studentList');

    if (!state.etudiants.length) {
        list.innerHTML = `
            <div style="text-align:center; padding:3rem; color:#64748b;">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">👥</div>
                <p>Aucun étudiant dans ce groupe.</p>
            </div>`;
        return;
    }

    list.innerHTML = state.etudiants.map((e, index) => {
        const nom      = e.user?.nom_complet || `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.trim();
        const initials = nom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const statut   = state.absences[e.id] || 'Present';

        return `
            <div class="student-item" id="student-${e.id}" data-student="${e.id}">
                <div class="student-info">
                    <div class="student-avatar" style="
                        width:50px; height:50px; border-radius:50%;
                        background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display:flex; align-items:center; justify-content:center;
                        color:white; font-weight:700; font-size:1rem; flex-shrink:0;">
                        ${initials}
                    </div>
                    <div>
                        <h4 style="font-size:0.95rem; font-weight:600; color:#1e293b; margin-bottom:4px;">
                            ${nom}
                        </h4>
                        <span style="font-size:0.8rem; color:#64748b;">
                            Niveau ${e.niveau_actuel} • ${e.taux_assiduité ?? 100}% assiduité
                        </span>
                    </div>
                </div>

                <div class="attendance-buttons" style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${renderButtons(e.id, statut)}
                </div>
            </div>`;
    }).join('');

    // Appliquer style visuel sur la ligne selon statut
    state.etudiants.forEach(e => applyRowStyle(e.id, state.absences[e.id]));
}

// ============================================================
// RENDU DES BOUTONS DE STATUT
// ============================================================
function renderButtons(etudiantId, statut) {
    const btns = [
        { val: 'Present',  label: '✅ Présent',  active: '#059669', text: 'white' },
        { val: 'Absent',   label: '❌ Absent',   active: '#dc2626', text: 'white' },
        { val: 'Retard',   label: '⏰ Retard',   active: '#d97706', text: 'white' },
        { val: 'Justifie', label: '📝 Justifié', active: '#2563eb', text: 'white' },
    ];

    return btns.map(b => {
        const isActive = statut === b.val;
        return `
            <button
                onclick="setStatut(${etudiantId}, '${b.val}')"
                style="
                    padding: 8px 14px; border-radius: 8px; border: 2px solid ${b.active};
                    background: ${isActive ? b.active : 'white'};
                    color: ${isActive ? b.text : b.active};
                    font-size: 0.8rem; font-weight: 600; cursor: pointer;
                    transition: all 0.2s ease; white-space: nowrap;
                "
                onmouseover="if('${statut}'!=='${b.val}')this.style.background='${b.active}20'"
                onmouseout="if('${statut}'!=='${b.val}')this.style.background='white'"
            >
                ${b.label}
            </button>`;
    }).join('');
}

// ============================================================
// CHANGER STATUT D'UN ÉTUDIANT
// ============================================================
function setStatut(etudiantId, statut) {
    state.absences[etudiantId] = statut;

    // Re-render les boutons de cet étudiant uniquement
    const row = document.getElementById(`student-${etudiantId}`);
    if (row) {
        row.querySelector('.attendance-buttons').innerHTML = renderButtons(etudiantId, statut);
        applyRowStyle(etudiantId, statut);
    }

    // Vérifier alerte si > seuil absences
    checkAbsenceAlert(etudiantId);

    updateStats();
}

// ============================================================
// STYLE VISUEL DE LA LIGNE SELON STATUT
// ============================================================
function applyRowStyle(etudiantId, statut) {
    const row = document.getElementById(`student-${etudiantId}`);
    if (!row) return;

    const borders = {
        'Present':  '#059669',
        'Absent':   '#dc2626',
        'Retard':   '#d97706',
        'Justifie': '#2563eb',
    };
    const bgs = {
        'Present':  '#f0fdf4',
        'Absent':   '#fef2f2',
        'Retard':   '#fffbeb',
        'Justifie': '#eff6ff',
    };

    row.style.borderLeft   = `4px solid ${borders[statut] || '#e2e8f0'}`;
    row.style.background   = bgs[statut] || 'white';
    row.style.borderRadius = '12px';
    row.style.marginBottom = '10px';
    row.style.padding      = '1rem 1.25rem';
    row.style.display      = 'flex';
    row.style.alignItems   = 'center';
    row.style.justifyContent = 'space-between';
    row.style.transition   = 'all 0.2s ease';
}

// ============================================================
// VÉRIFIER SI ÉTUDIANT A TROP D'ABSENCES
// ============================================================
async function checkAbsenceAlert(etudiantId) {
    if (state.absences[etudiantId] !== 'Absent') return;

    // Compter les absences de cet étudiant
    const data = await apiFetch(`/absences/?etudiant=${etudiantId}&statut=Absent`);
    if (data?.error) return;

    const etudiant = state.etudiants.find(e => e.id === etudiantId);
    const nom      = etudiant?.user?.nom_complet || 'Cet étudiant';

    if (data.length >= 3) {
        showAlert(
            `⚠️ <strong>${nom}</strong> a ${data.length} absences enregistrées. Une alerte a été envoyée aux parents et au dirigeant.`,
            'warning'
        );
    }
}

// ============================================================
// METTRE À JOUR LES COMPTEURS STATS
// ============================================================
function updateStats() {
    const counts = { Present: 0, Absent: 0, Retard: 0, Justifie: 0 };
    Object.values(state.absences).forEach(s => { if (counts[s] !== undefined) counts[s]++; });

    const el = (cls) => document.querySelector(`.${cls}`);
    if (el('present-count'))   el('present-count').textContent   = counts.Present;
    if (el('absent-count'))    el('absent-count').textContent    = counts.Absent;
    if (el('late-count'))      el('late-count').textContent      = counts.Retard;
    if (el('justified-count')) el('justified-count').textContent = counts.Justifie;
}

// ============================================================
// ENREGISTRER LES ABSENCES EN DB
// ============================================================
async function saveAttendance() {
    if (state.saving) return;
    if (!state.seance) {
        showToast('Aucune séance trouvée pour aujourd\'hui. Créez une séance d\'abord.', 'warning');
        return;
    }
    if (!state.etudiants.length) {
        showToast('Aucun étudiant à enregistrer.', 'warning');
        return;
    }

    state.saving = true;
    const btn = document.querySelector('.btn-save');
    if (btn) {
        btn.textContent = '⏳ Enregistrement...';
        btn.disabled    = true;
    }

    const today  = new Date().toISOString().split('T')[0];
    let success  = 0;
    let errors   = 0;

    for (const etudiant of state.etudiants) {
        const statut    = state.absences[etudiant.id] || 'Present';
        const absenceId = state.savedIds[etudiant.id];

        const payload = {
            etudiant:       etudiant.id,
            seance:         state.seance.id,
            statut_absence: statut,
            date_absence:   today,
        };

        let result;

        if (absenceId) {
            // Déjà sauvegardé → PUT pour mettre à jour
            result = await apiFetch(`/absences/${absenceId}/`, {
                method: 'PUT',
                body:   JSON.stringify(payload),
            });
        } else {
            // Nouveau → POST
            result = await apiFetch('/absences/', {
                method: 'POST',
                body:   JSON.stringify(payload),
            });
            if (!result?.error) {
                state.savedIds[etudiant.id] = result.id; // stocker l'ID pour les prochains PUT
            }
        }

        if (result?.error) {
            console.error(`Erreur pour étudiant ${etudiant.id}:`, result.message);
            errors++;
        } else {
            success++;
        }
    }

    state.saving = false;
    if (btn) {
        btn.textContent = '💾 Enregistrer';
        btn.disabled    = false;
    }

    if (errors === 0) {
        showToast(`✓ ${success} présences enregistrées avec succès !`, 'success');
    } else {
        showToast(`${success} enregistrés, ${errors} erreurs.`, 'warning');
    }
}

// ============================================================
// GÉNÉRER RAPPORT PDF
// ============================================================
function generatePDF() {
    if (!state.etudiants.length) {
        showToast('Aucune donnée à exporter.', 'warning');
        return;
    }

    const today    = new Date().toLocaleDateString('fr-DZ');
    const groupe   = state.groupe?.nom_groupe || 'Groupe';
    const seance   = state.seance
        ? `${state.seance.heure_debut?.slice(0,5)} → ${state.seance.heure_fin?.slice(0,5)}`
        : 'Séance du jour';

    const rows = state.etudiants.map(e => {
        const nom    = e.user?.nom_complet || `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.trim();
        const statut = state.absences[e.id] || 'Present';
        const icons  = { Present: '✅', Absent: '❌', Retard: '⏰', Justifie: '📝' };
        return `
            <tr>
                <td>${nom}</td>
                <td>Niveau ${e.niveau_actuel}</td>
                <td style="text-align:center;">${icons[statut] || '—'} ${statut}</td>
            </tr>`;
    }).join('');

    const counts = { Present: 0, Absent: 0, Retard: 0, Justifie: 0 };
    Object.values(state.absences).forEach(s => { if (counts[s] !== undefined) counts[s]++; });

    const html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Rapport Absences - ${groupe} - ${today}</title>
            <style>
                body    { font-family: 'Segoe UI', sans-serif; padding: 2rem; color: #1e293b; }
                h1      { font-size: 1.5rem; color: #667eea; margin-bottom: 0.25rem; }
                p       { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
                table   { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th      { background: #667eea; color: white; padding: 10px 14px; text-align: left; font-size: 0.875rem; }
                td      { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; }
                tr:nth-child(even) td { background: #f8fafc; }
                .summary { display:flex; gap:1.5rem; margin-bottom:1.5rem; }
                .sum-item { padding:10px 16px; border-radius:8px; font-weight:700; font-size:0.875rem; }
                .s-p { background:#d1fae5; color:#065f46; }
                .s-a { background:#fee2e2; color:#991b1b; }
                .s-r { background:#fef3c7; color:#92400e; }
                .s-j { background:#dbeafe; color:#1e40af; }
                @media print { button { display:none !important; } }
            </style>
        </head>
        <body>
            <h1>📅 Feuille de Présence — ${groupe}</h1>
            <p>${seance} • ${today}</p>
            <div class="summary">
                <div class="sum-item s-p">✅ Présents: ${counts.Present}</div>
                <div class="sum-item s-a">❌ Absents: ${counts.Absent}</div>
                <div class="sum-item s-r">⏰ Retards: ${counts.Retard}</div>
                <div class="sum-item s-j">📝 Justifiés: ${counts.Justifie}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Nom complet</th>
                        <th>Niveau</th>
                        <th style="text-align:center;">Statut</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:2rem; border-top:1px solid #e2e8f0; padding-top:1rem; color:#94a3b8; font-size:0.8rem;">
                Généré le ${today} • Centre de Langues
            </div>
            <script>window.onload = () => window.print();<\/script>
        </body>
        </html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        showToast('Activez les popups pour générer le PDF.', 'warning');
    }
}

// ============================================================
// MARQUER TOUS (raccourcis)
// ============================================================
function markAll(statut) {
    state.etudiants.forEach(e => setStatut(e.id, statut));
    showToast(`Tous marqués comme ${statut}`, 'info');
}

// ============================================================
// CSS ANIMATIONS MANQUANTES
// ============================================================
(function injectStyles() {
    if (document.getElementById('abs-extra-styles')) return;
    const style = document.createElement('style');
    style.id = 'abs-extra-styles';
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .student-item {
            border-left: 4px solid #e2e8f0;
            background: white;
            border-radius: 12px;
            margin-bottom: 10px;
            padding: 1rem 1.25rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s ease;
        }
        .student-item .student-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        @media (max-width: 640px) {
            .student-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.75rem;
            }
        }
    `;
    document.head.appendChild(style);
})();

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const user = checkSession();
    if (!user) return;

    fillDateInfo();
    await loadGroupeAndSeance();
});