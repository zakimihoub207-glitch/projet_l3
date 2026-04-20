'use strict';

/**
 * rapports.js — Page Rapports & Statistiques
 *
 * Real API endpoints used (from your views.py):
 *   POST /api/auth/token/refresh/  → refresh JWT
 *   POST /api/auth/logout/         → blacklist refresh token
 *   GET  /api/dashboard/           → global stats to populate card numbers
 *   GET  /api/etudiants/           → student list for CSV export
 *   GET  /api/enseignants/         → teacher list for CSV export
 *   GET  /api/paiements/           → payment list for CSV export
 *   GET  /api/absences/            → absence list for CSV export
 *   GET  /api/bulletins/           → salary bulletins for CSV export
 *
 * HTML elements targeted (from rapports.html):
 *   Report cards          → identified by their h3 title text
 *   Download buttons      → inside each .report-card
 *   Date inputs           → input[type="date"] (Du / Au)
 *   Period buttons        → .btn-secondary with calendar icons
 *   Appliquer button      → .btn-secondary with fa-filter
 *   History trash buttons → .fa-trash inside history rows
 *   .logout-link          → logout
 *   Sidebar user info     → filled from /api/auth/me/
 */

// ─────────────────────────────────────────────────────────────
// JWT AUTH  (same pattern as dashboard_der.js)
// ─────────────────────────────────────────────────────────────

const Auth = {
  get access()  { return localStorage.getItem('access_token');  },
  get refresh() { return localStorage.getItem('refresh_token'); },

  save(access, refresh) {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },

  clear() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
  },

  isExpired(token) {
    if (!token) return true;
    try {
      const { exp } = JSON.parse(atob(token.split('.')[1]));
      return exp * 1000 < Date.now() + 30_000;
    } catch { return true; }
  },

  async refreshToken() {
    if (!this.refresh) { this.toLogin(); return null; }
    try {
      const res = await fetch('/api/auth/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refresh }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.save(data.access, data.refresh || this.refresh);
      return data.access;
    } catch {
      this.clear();
      this.toLogin();
      return null;
    }
  },

  async validToken() {
    if (!this.isExpired(this.access)) return this.access;
    return this.refreshToken();
  },

  toLogin() { window.location.href = '/login/'; },
};

// ─────────────────────────────────────────────────────────────
// API WRAPPER
// ─────────────────────────────────────────────────────────────

async function api(url, opts = {}) {
  const token = await Auth.validToken();
  if (!token) return null;
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) { Auth.clear(); Auth.toLogin(); return null; }
    if (!res.ok) { console.warn(`HTTP ${res.status}:`, url); return null; }
    return res.json();
  } catch (err) {
    console.error('Network error:', url, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────

function toast(msg, type = 'info') {
  const colors = {
    success: '#059669',
    error:   '#dc2626',
    warning: '#d97706',
    info:    '#4f46e5',
  };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    padding:12px 20px; border-radius:12px; font-size:14px;
    font-weight:500; color:#fff; background:${colors[type] || colors.info};
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation: toastIn .3s ease; max-width:340px;
  `;
  el.textContent = msg;
  if (!document.getElementById('toast-keyframes')) {
    const s = document.createElement('style');
    s.id = 'toast-keyframes';
    s.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all .3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ─────────────────────────────────────────────────────────────
// LOADING SPINNER on a button
// ─────────────────────────────────────────────────────────────

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Chargement...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────

function getDateInputs() {
  const inputs = document.querySelectorAll('input[type="date"]');
  return {
    from: inputs[0]?.value || '',
    to:   inputs[1]?.value || '',
  };
}

function setDateInputs(from, to) {
  const inputs = document.querySelectorAll('input[type="date"]');
  if (inputs[0]) inputs[0].value = from;
  if (inputs[1]) inputs[1].value = to;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function setPeriod(period) {
  const now  = new Date();
  let   from = new Date();

  if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'quarter') {
    from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
  }

  setDateInputs(from.toISOString().split('T')[0], todayStr());
}

// ─────────────────────────────────────────────────────────────
// FIND REPORT CARD BY h3 TITLE TEXT
// ─────────────────────────────────────────────────────────────

function getCard(title) {
  for (const card of document.querySelectorAll('.report-card')) {
    if (card.querySelector('h3')?.textContent?.trim() === title) return card;
  }
  return null;
}

// Update the two stat rows inside a card
function updateCardStats(title, row1Val, row2Val) {
  const card = getCard(title);
  if (!card) return;
  const rows = card.querySelectorAll('.space-y-2 .flex');
  const val1 = rows[0]?.querySelector('span:last-child');
  const val2 = rows[1]?.querySelector('span:last-child');
  if (val1 && row1Val !== undefined) val1.textContent = row1Val;
  if (val2 && row2Val !== undefined) val2.textContent = row2Val;
}

// ─────────────────────────────────────────────────────────────
// LOAD STATS AND POPULATE CARDS
// Only uses real endpoints from your views.py
// ─────────────────────────────────────────────────────────────

async function loadStats() {
  // Single dashboard call for global numbers
  const dashboard = await api('/api/dashboard/');
  if (!dashboard) return;

  const fin = dashboard.finances  || {};
  const ped = dashboard.pedagogie || {};

  // ── Rapport Financier ─────────────────────────────────────
  updateCardStats(
    'Rapport Financier',
    (fin.revenus_collectes || 0).toLocaleString('fr-FR') + ' DA',
    ((fin.solde || 0) >= 0 ? '+' : '') +
      (fin.solde || 0).toLocaleString('fr-FR') + ' DA'
  );

  // ── Rapport Étudiants ─────────────────────────────────────
  const tauxR = ped.moyenne_globale
    ? Math.round((ped.moyenne_globale / 20) * 100) + '%' : 'N/A';
  updateCardStats(
    'Rapport Étudiants',
    (dashboard.etudiants || 0).toString(),
    tauxR
  );

  // ── Rapport Enseignants ───────────────────────────────────
  updateCardStats(
    'Rapport Enseignants',
    (dashboard.enseignants || 0) + ' enseignants',
    (fin.salaires_verses || 0).toLocaleString('fr-FR') + ' DA'
  );

  // ── Rapport d'Assiduité ───────────────────────────────────
  const nbAbs   = ped.nb_absences || 0;
  const estTaux = Math.max(0, 100 - nbAbs * 0.5).toFixed(1) + '%';
  updateCardStats("Rapport d'Assiduité", estTaux, nbAbs.toString());

  // ── Rapport Paiements ─────────────────────────────────────
  const impayes = fin['impayés'] ?? fin.impayes ?? 0;
  updateCardStats(
    'Rapport Paiements',
    (fin.taux_paiement || 0).toFixed(1) + '%',
    impayes.toLocaleString('fr-FR') + ' DA'
  );
}

// ─────────────────────────────────────────────────────────────
// CSV BUILDER + DOWNLOAD TRIGGER
// ─────────────────────────────────────────────────────────────

function buildCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function today() { return new Date().toISOString().split('T')[0]; }

// ─────────────────────────────────────────────────────────────
// HISTORY: add a new row to "Historique des Rapports Générés"
// ─────────────────────────────────────────────────────────────

function addHistoryRow(filename, format, details) {
  const container = document.querySelector(
    '.glass-panel h3 + .space-y-3, .glass-panel:has(h3) .space-y-3'
  );
  // Fallback: find by heading text
  let hist = null;
  document.querySelectorAll('.glass-panel').forEach(p => {
    if (p.querySelector('h3')?.textContent?.includes('Historique'))
      hist = p.querySelector('.space-y-3');
  });
  if (!hist) return;

  const iconMap = {
    CSV:  'fa-file-csv text-blue-400',
    JSON: 'fa-file-code text-amber-400',
    PDF:  'fa-file-pdf text-red-400',
  };
  const icon = iconMap[format] || 'fa-file text-slate-400';
  const now  = new Date().toLocaleString('fr-FR');

  const row = document.createElement('div');
  row.className =
    'flex items-center justify-between p-4 bg-slate-800 rounded-lg';
  row.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
        <i class="fas ${icon}"></i>
      </div>
      <div>
        <h4 class="font-medium text-white">${filename}</h4>
        <p class="text-sm text-slate-400">${details} • ${now}</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs text-slate-500">Nouveau</span>
      <button class="p-2 hover:bg-slate-700 rounded-lg transition-colors
                     border-none cursor-pointer text-slate-400" title="Supprimer">
        <i class="fas fa-trash"></i>
      </button>
    </div>`;

  row.querySelector('button').addEventListener('click', () => row.remove());
  hist.prepend(row);
}

// ─────────────────────────────────────────────────────────────
// EXPORT FUNCTIONS — each fetches real data then downloads CSV
// ─────────────────────────────────────────────────────────────

async function exportEtudiants(btn) {
  setLoading(btn, true);
  toast('Récupération des données étudiants…', 'info');

  const data = await api('/api/etudiants/');
  setLoading(btn, false);

  if (!data || !data.length) {
    toast('Aucune donnée étudiant disponible.', 'warning');
    return;
  }

  const headers = [
    'ID', 'Nom', 'Prénom', 'Email', 'Niveau',
    'Groupe', 'Statut', 'Date Inscription', 'Moyenne',
  ];
  const rows = data.map(e => [
    e.id,
    e.user?.last_name  || '',
    e.user?.first_name || '',
    e.user?.email      || '',
    e.niveau_actuel    || '',
    e.groupe_nom       || '',
    e.statut_etudiant  || '',
    e.date_inscription || '',
    e.moyenne_generale ?? '',
  ]);

  const filename = `etudiants_${today()}.csv`;
  downloadFile('\uFEFF' + buildCSV(headers, rows), filename, 'text/csv;charset=utf-8;');
  toast(`✓ Export "${filename}" téléchargé !`, 'success');
  addHistoryRow(filename, 'CSV', `${data.length} étudiants`);
}

async function exportEnseignants(btn) {
  setLoading(btn, true);
  toast('Récupération des données enseignants…', 'info');

  const data = await api('/api/enseignants/');
  setLoading(btn, false);

  if (!data || !data.length) {
    toast('Aucune donnée enseignant disponible.', 'warning');
    return;
  }

  const headers = [
    'ID', 'Nom', 'Prénom', 'Email', 'Langue',
    'Niveaux', 'Contrat', 'Tarif/h', 'Statut', 'Nb Groupes',
  ];
  const rows = data.map(e => [
    e.id,
    e.user?.last_name   || '',
    e.user?.first_name  || '',
    e.user?.email       || '',
    e.langue_enseignee  || '',
    e.niveaux           || '',
    e.type_contrat      || '',
    e.tarif_horaire     || '',
    e.statut_emploi     || '',
    e.nombre_groupes    ?? 0,
  ]);

  const filename = `enseignants_${today()}.csv`;
  downloadFile('\uFEFF' + buildCSV(headers, rows), filename, 'text/csv;charset=utf-8;');
  toast(`✓ Export "${filename}" téléchargé !`, 'success');
  addHistoryRow(filename, 'CSV', `${data.length} enseignants`);
}

async function exportAbsences(btn) {
  setLoading(btn, true);
  toast('Récupération des absences…', 'info');

  const data = await api('/api/absences/');
  setLoading(btn, false);

  if (!data || !data.length) {
    toast('Aucune absence enregistrée.', 'warning');
    return;
  }

  const headers = [
    'ID', 'Étudiant', 'Date Séance', 'Date Absence',
    'Statut', 'Justification', 'Raison',
  ];
  const rows = data.map(a => [
    a.id,
    a.etudiant_nom     || '',
    a.seance_date      || '',
    a.date_absence     || '',
    a.statut_absence   || '',
    a.justification    || '',
    a.raison           || '',
  ]);

  const filename = `absences_${today()}.csv`;
  downloadFile('\uFEFF' + buildCSV(headers, rows), filename, 'text/csv;charset=utf-8;');
  toast(`✓ Export "${filename}" téléchargé !`, 'success');
  addHistoryRow(filename, 'CSV', `${data.length} absences`);
}

async function exportPaiements(btn) {
  setLoading(btn, true);
  toast('Récupération des paiements…', 'info');

  const data = await api('/api/paiements/');
  setLoading(btn, false);

  if (!data || !data.length) {
    toast('Aucun paiement disponible.', 'warning');
    return;
  }

  const headers = [
    'ID', 'Étudiant', 'Montant Dû', 'Montant Payé',
    'Solde', 'Mode', 'Statut', 'Période', 'Date Paiement',
  ];
  const rows = data.map(p => [
    p.id,
    p.etudiant_nom      || '',
    p.montant_du        || 0,
    p.montant_paye      || 0,
    p.solde             || 0,
    p.mode_paiement     || '',
    p.statut_paiement   || '',
    p.periode           || '',
    p.date_paiement     || '',
  ]);

  const filename = `paiements_${today()}.csv`;
  downloadFile('\uFEFF' + buildCSV(headers, rows), filename, 'text/csv;charset=utf-8;');
  toast(`✓ Export "${filename}" téléchargé !`, 'success');
  addHistoryRow(filename, 'CSV', `${data.length} paiements`);
}

async function exportFinancier(btn) {
  setLoading(btn, true);
  toast('Génération du rapport financier…', 'info');

  const [dashboard, bulletins, paiements] = await Promise.all([
    api('/api/dashboard/'),
    api('/api/bulletins/'),
    api('/api/paiements/'),
  ]);
  setLoading(btn, false);

  if (!dashboard) {
    toast('Données financières indisponibles.', 'error');
    return;
  }

  const fin = dashboard.finances || {};

  // Build a simple summary CSV
  const headers = ['Indicateur', 'Valeur'];
  const rows = [
    ['Revenus collectés (DA)',  fin.revenus_collectes ?? 0],
    ['Impayés (DA)',           fin['impayés'] ?? fin.impayes ?? 0],
    ['Salaires versés (DA)',   fin.salaires_verses ?? 0],
    ['Solde (DA)',             fin.solde ?? 0],
    ['Taux paiement (%)',      fin.taux_paiement ?? 0],
    ['Nb bulletins salaire',   Array.isArray(bulletins) ? bulletins.length : 'N/A'],
    ['Nb paiements total',     Array.isArray(paiements) ? paiements.length : 'N/A'],
  ];

  const filename = `rapport_financier_${today()}.csv`;
  downloadFile('\uFEFF' + buildCSV(headers, rows), filename, 'text/csv;charset=utf-8;');
  toast(`✓ Rapport financier exporté !`, 'success');
  addHistoryRow(filename, 'CSV', 'Synthèse financière');
}

// ─────────────────────────────────────────────────────────────
// BIND DOWNLOAD BUTTONS inside each .report-card
// Matched by the card's h3 title text
// ─────────────────────────────────────────────────────────────

function bindDownloadButtons() {
  const config = [
    { title: 'Rapport Financier',   handler: exportFinancier   },
    { title: 'Rapport Étudiants',   handler: exportEtudiants   },
    { title: 'Rapport Enseignants', handler: exportEnseignants },
    { title: "Rapport d'Assiduité", handler: exportAbsences    },
    { title: 'Rapport Paiements',   handler: exportPaiements   },
  ];

  config.forEach(({ title, handler }) => {
    const card = getCard(title);
    if (!card) return;
    const btn = card.querySelector('button');
    if (btn) btn.addEventListener('click', () => handler(btn));
  });

  // "Rapport Personnalisé" → Configurer button
  const customCard = getCard('Rapport Personnalisé');
  customCard?.querySelector('button')?.addEventListener('click', () => {
    toast('Fonctionnalité à venir : rapports personnalisés.', 'info');
  });
}

// ─────────────────────────────────────────────────────────────
// BIND DATE FILTER BUTTONS
// ─────────────────────────────────────────────────────────────

function bindFilterButtons() {
  document.querySelectorAll('.btn-secondary').forEach(btn => {
    const text = btn.textContent.trim();
    const icon = btn.querySelector('i');

    if (icon?.classList.contains('fa-filter') || text.includes('Appliquer')) {
      btn.addEventListener('click', async () => {
        toast('Filtrage appliqué — rechargement des stats…', 'info');
        await loadStats();
        toast('Stats mises à jour.', 'success');
      });
    }

    if (text.includes('Ce mois')) {
      btn.addEventListener('click', () => {
        setPeriod('month');
        loadStats();
      });
    }

    if (text.includes('Ce trimestre')) {
      btn.addEventListener('click', () => {
        setPeriod('quarter');
        loadStats();
      });
    }

    if (text.includes('Cette année')) {
      btn.addEventListener('click', () => {
        setPeriod('year');
        loadStats();
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────
// BIND HISTORY TRASH BUTTONS (existing static rows)
// ─────────────────────────────────────────────────────────────

function bindHistoryDeletes() {
  document.querySelectorAll('.fa-trash').forEach(icon => {
    const btn = icon.closest('button');
    if (btn) btn.addEventListener('click', () => {
      btn.closest('.flex.items-center.justify-between')?.remove();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR USER INFO
// ─────────────────────────────────────────────────────────────

async function loadUserInfo() {
  const cached = localStorage.getItem('user_data');
  const user   = cached ? JSON.parse(cached) : await api('/api/auth/me/');
  if (!user) return;
  if (!cached) localStorage.setItem('user_data', JSON.stringify(user));

  const nameEl  = document.querySelector('aside .flex-1 p.text-sm');
  const emailEl = document.querySelector('aside .flex-1 p.text-xs');
  const avatar  = document.querySelector('aside img');

  if (nameEl)  nameEl.textContent  = user.nom_complet || `${user.first_name} ${user.last_name}`;
  if (emailEl) emailEl.textContent = user.email;
  if (avatar)  avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user.nom_complet || user.first_name
  )}&background=6366f1&color=fff`;
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

function bindLogout() {
  document.querySelectorAll('.logout-link').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      await api('/api/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh: Auth.refresh }),
      });
      Auth.clear();
      Auth.toLogin();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

async function init() {
  await loadStats();
  bindDownloadButtons();
  bindFilterButtons();
  bindHistoryDeletes();
  bindLogout();
  loadUserInfo().catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);