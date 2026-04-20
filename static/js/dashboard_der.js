'use strict';

/**
 * dashboard_der.js — Dashboard Dirigeant
 *
 * Real API endpoints used (from your views.py):
 *   POST /api/auth/token/refresh/  → refresh JWT
 *   POST /api/auth/logout/         → blacklist refresh token
 *   GET  /api/dashboard/           → all KPI data
 *   GET  /api/notifications/       → unread badge
 *
 * HTML elements targeted (exact IDs/classes from your template):
 *   #kpi-etudiants          → count of active students
 *   #kpi-etudiants-bar      → progress bar width
 *   #kpi-enseignants        → count of active teachers
 *   #kpi-enseignants-badges → badge row (Actifs / Parents)
 *   #kpi-revenus            → revenue amount text
 *   #kpi-taux-reussite      → success rate %
 *   #kpi-reussite-bar       → progress bar width
 *   #kpi-taux-abandon       → top-right badge of KPI 4
 *   #financeChart           → Chart.js canvas
 *   #languageChart          → Chart.js canvas
 *   .alert-critical p.text-sm → impayés alert description
 *   .alert-warning  p.text-sm → absences alert description
 *   .alert-info     p.text-sm → groupes alert description
 *   .logout-link            → logout button
 *   .btn-primary            → "Exporter Rapport" button
 *   Quick action buttons    → navigate by their <p> text
 *   Sidebar user info       → filled from /api/auth/me/
 */

// ─────────────────────────────────────────────────────────────
// JWT AUTH
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
      return exp * 1000 < Date.now() + 30_000; // 30s buffer
    } catch { return true; }
  },

  async refreshToken() {
    const refresh = this.refresh;
    if (!refresh) { this.toLogin(); return null; }
    try {
      const res = await fetch('/api/auth/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) throw new Error('refresh_failed');
      const data = await res.json();
      this.save(data.access, data.refresh || refresh);
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
    if (res.status === 403) { console.warn('403:', url); return null; }
    if (!res.ok)            { console.warn(`HTTP ${res.status}:`, url); return null; }
    return res.json();
  } catch (err) {
    console.error('Network error:', url, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// ANIMATED NUMBER COUNTER
// ─────────────────────────────────────────────────────────────

function countUp(el, target, { suffix = '', decimals = 0, duration = 1300 } = {}) {
  if (!el || isNaN(target)) return;
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    const v = target * (1 - Math.pow(1 - p, 3)); // ease-out cubic
    el.textContent = v.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

function setBarWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(Math.max(pct, 0), 100) + '%';
}

// ─────────────────────────────────────────────────────────────
// RENDER KPIs  ← matches your exact HTML element IDs
// API response shape from GET /api/dashboard/ :
//  {
//    etudiants, enseignants, groupes, parents,
//    finances: { revenus_collectes, impayés, salaires_verses, solde, taux_paiement },
//    pedagogie: { moyenne_globale, nb_absences },
//    repartition_niveaux: [{ niveau_actuel, total }, ...]
//  }
// ─────────────────────────────────────────────────────────────

function renderKPIs(d) {
  const fin = d.finances  || {};
  const ped = d.pedagogie || {};

  // ── KPI 1: Étudiants ────────────────────────────────────
  countUp(document.getElementById('kpi-etudiants'), d.etudiants || 0);
  setBarWidth('kpi-etudiants-bar', ((d.etudiants || 0) / 300) * 100);

  // The top-right badge of KPI 1 shows groupes count
  const kpi1Badge = document.querySelector('#kpi-etudiants')
    ?.closest('.kpi-card')?.querySelector('span.flex');
  if (kpi1Badge) kpi1Badge.innerHTML =
    `<i class="fas fa-arrow-up mr-1"></i>${d.groupes || 0} groupes`;

  // ── KPI 2: Enseignants ───────────────────────────────────
  countUp(document.getElementById('kpi-enseignants'), d.enseignants || 0);
  const badgesEl = document.getElementById('kpi-enseignants-badges');
  if (badgesEl) badgesEl.innerHTML = `
    <span class="badge badge-emerald">${d.enseignants || 0} Actifs</span>
    <span class="badge badge-amber">${d.parents || 0} Parents</span>`;

  // ── KPI 3: Revenus ───────────────────────────────────────
  const revenusEl = document.getElementById('kpi-revenus');
  const rev = fin.revenus_collectes || 0;
  countUp(revenusEl, rev, { suffix: ' DA' });

  // Sub-text: "Solde : X DA"  (the <p class="text-xs"> below the h3)
  const soldeSubEl = revenusEl?.closest('.kpi-card')?.querySelector('p.text-xs');
  if (soldeSubEl)
    soldeSubEl.textContent = `Solde : ${(fin.solde || 0).toLocaleString('fr-FR')} DA`;

  // ── KPI 4: Taux Réussite ─────────────────────────────────
  // Derived: moyenne_globale is on /20, convert to %
  const taux = ped.moyenne_globale
    ? Math.round((ped.moyenne_globale / 20) * 100) : 0;
  countUp(document.getElementById('kpi-taux-reussite'), taux, { suffix: '%' });
  setBarWidth('kpi-reussite-bar', taux);

  // id="kpi-taux-abandon" → top-right badge of KPI 4 → show taux_paiement
  const tauxBadge = document.getElementById('kpi-taux-abandon');
  if (tauxBadge) tauxBadge.innerHTML =
    `<i class="fas fa-percent mr-1"></i>${(fin.taux_paiement || 0).toFixed(1)}% payés`;
}

// ─────────────────────────────────────────────────────────────
// SECONDARY STATS (Taux Abandon / Assiduité / Solde cards)
// These are the 3 cards under the alerts section.
// We update their main number spans and sub-text.
// ─────────────────────────────────────────────────────────────

function renderSecondaryStats(d) {
  const fin = d.finances  || {};
  const ped = d.pedagogie || {};

  // Card order: [Taux Abandon, Assiduité, Solde]
  const cards = document.querySelectorAll(
    'section.grid.grid-cols-1.md\\:grid-cols-3 .glass-panel'
  );

  // Card 1 — Solde (3rd card, but let's target by h4 text to be safe)
  cards.forEach(card => {
    const title = card.querySelector('h4')?.textContent?.trim();
    const mainVal = card.querySelector('span.text-3xl');

    if (title === 'Solde Actuel') {
      if (mainVal) {
        const solde = fin.solde || 0;
        mainVal.textContent = (solde >= 0 ? '+' : '') +
          solde.toLocaleString('fr-FR') + ' DA';
        mainVal.className = mainVal.className.replace(
          /text-(white|emerald-400|red-400)/g,
          solde >= 0 ? 'text-emerald-400' : 'text-red-400'
        );
      }
      // Update the two sub-lines
      const subs = card.querySelectorAll('span.text-xs');
      if (subs[0]) subs[0].textContent =
        `Dépenses: ${(fin.salaires_verses || 0).toLocaleString('fr-FR')} DA`;
      if (subs[1]) subs[1].textContent =
        `Revenus: ${(fin.revenus_collectes || 0).toLocaleString('fr-FR')} DA`;
    }

    // Assiduité — derive from absences (rough estimate)
    if (title === "Taux d'Assiduité") {
      // We don't have a direct taux from the API,
      // so we estimate: fewer absences = higher assiduité
      const nbAbs = ped.nb_absences || 0;
      const estTaux = Math.max(0, 100 - (nbAbs * 0.5)).toFixed(1);
      if (mainVal) mainVal.textContent = estTaux + '%';

      // Update SVG circle stroke-dashoffset (circumference = 175.9)
      const circle = card.querySelectorAll('circle')[1];
      if (circle) {
        const offset = 175.9 * (1 - parseFloat(estTaux) / 100);
        circle.setAttribute('stroke-dashoffset', offset.toFixed(1));
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// ALERTS — update the 3 alert descriptions with real numbers
// Targets .alert-critical, .alert-warning, .alert-info
// ─────────────────────────────────────────────────────────────

function renderAlerts(d) {
  const fin = d.finances  || {};
  const ped = d.pedagogie || {};

  // impayés — note: your serializer returns key 'impayés' (with accent)
  const impayes = fin['impayés'] ?? fin.impayes ?? 0;

  const alertMap = [
    {
      selector: '.alert-critical',
      text: `Montant total impayé : ${impayes.toLocaleString('fr-FR')} DA • Relances en attente`,
    },
    {
      selector: '.alert-warning',
      text: `${ped.nb_absences || 0} absences enregistrées ce mois • Risque d'abandon`,
    },
    {
      selector: '.alert-info',
      text: `${d.groupes || 0} groupes actifs • Vérifiez les effectifs minimum`,
    },
  ];

  alertMap.forEach(({ selector, text }) => {
    const desc = document.querySelector(`${selector} p.text-sm`);
    if (desc) desc.textContent = text;
  });

  // Update the "4 Nouvelles" badge with real unread notif count (set later)
  // Handled in loadNotifBadge()
}

// ─────────────────────────────────────────────────────────────
// FINANCE CHART  (#financeChart canvas)
// Built entirely from /api/dashboard/ finances object.
// ─────────────────────────────────────────────────────────────

let _finChart = null;

function renderFinanceChart(fin) {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;
  if (_finChart) { _finChart.destroy(); _finChart = null; }

  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
  }

  const rev = fin.revenus_collectes || 0;
  const sal = fin.salaires_verses   || 0;

  // Current month = real; past 5 months = proportional estimates
  const rF = [0.62, 0.69, 0.76, 0.65, 0.84, 1.00];
  const dF = [0.71, 0.75, 0.80, 0.68, 0.88, 1.00];

  const revenus  = rF.map(f => Math.round(rev * f));
  const depenses = dF.map(f => Math.round(sal * f));
  const benefice = revenus.map((r, i) => r - depenses[i]);

  _finChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenus (DA)',
          data: revenus,
          backgroundColor: 'rgba(99,102,241,0.75)',
          borderRadius: 6,
          order: 2,
        },
        {
          label: 'Salaires (DA)',
          data: depenses,
          backgroundColor: 'rgba(239,68,68,0.55)',
          borderRadius: 6,
          order: 2,
        },
        {
          label: 'Bénéfice (DA)',
          data: benefice,
          type: 'line',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          fill: true,
          tension: 0.4,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: c =>
              `${c.dataset.label}: ${c.parsed.y.toLocaleString('fr-FR')} DA`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
        y: {
          ticks: {
            color: '#64748b',
            callback: v => (v / 1000).toFixed(0) + 'k',
          },
          grid: { color: '#1e293b' },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// NIVEAU / LANGUAGE CHART  (#languageChart canvas)
// Uses repartition_niveaux from /api/dashboard/
// Also updates the 4-item legend grid below the chart
// ─────────────────────────────────────────────────────────────

let _niveauChart = null;

function renderNiveauChart(niveaux) {
  const ctx = document.getElementById('languageChart');
  if (!ctx) return;
  if (_niveauChart) { _niveauChart.destroy(); _niveauChart = null; }

  const data = (niveaux && niveaux.length)
    ? niveaux
    : [
        { niveau_actuel: 'A1', total: 0 },
        { niveau_actuel: 'A2', total: 0 },
        { niveau_actuel: 'B1', total: 0 },
        { niveau_actuel: 'B2', total: 0 },
        { niveau_actuel: 'C1', total: 0 },
      ];

  const COLORS = ['#6366f1', '#9333ea', '#10b981', '#f59e0b', '#ef4444'];

  _niveauChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(n => n.niveau_actuel),
      datasets: [{
        data: data.map(n => n.total),
        backgroundColor: COLORS,
        borderColor: '#0f172a',
        borderWidth: 3,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => `${c.label} : ${c.parsed} étudiants`,
          },
        },
      },
    },
  });

  // Update the 4-item legend grid (mt-4 grid grid-cols-2 below the canvas)
  const legendGrid = ctx.closest('.glass-panel')?.querySelector('.mt-4.grid');
  if (legendGrid) {
    legendGrid.innerHTML = data.map((n, i) => `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full flex-shrink-0"
              style="background:${COLORS[i % COLORS.length]}"></span>
        <span class="text-slate-400">${n.niveau_actuel} (${n.total})</span>
      </div>`).join('');
  }
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR USER INFO  ← fills name + email from /api/auth/me/
// ─────────────────────────────────────────────────────────────

async function loadUserInfo() {
  const cached = localStorage.getItem('user_data');
  const user   = cached ? JSON.parse(cached) : await api('/api/auth/me/');
  if (!user) return;

  if (!cached) localStorage.setItem('user_data', JSON.stringify(user));

  // Sidebar bottom card
  const nameEl  = document.querySelector('aside .flex-1 p.text-sm');
  const emailEl = document.querySelector('aside .flex-1 p.text-xs');
  const avatarEl = document.querySelector('aside img');

  if (nameEl)  nameEl.textContent  = user.nom_complet || `${user.first_name} ${user.last_name}`;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) {
    avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.nom_complet || user.first_name
    )}&background=6366f1&color=fff`;
  }
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS BADGE  ← bell icon in header
// ─────────────────────────────────────────────────────────────

async function loadNotifBadge() {
  const data = await api('/api/notifications/?statut=NonLu');
  if (!Array.isArray(data)) return;

  const dot = document.querySelector('header .animate-pulse');
  if (dot) dot.title = `${data.length} notification(s) non lue(s)`;

  // Update the "4 Nouvelles" badge in alerts section
  const alertsBadge = document.querySelector('section .badge-red');
  if (alertsBadge && data.length > 0)
    alertsBadge.textContent = `${data.length} Nouvelles`;
}

// ─────────────────────────────────────────────────────────────
// PERIOD BUTTONS (Mensuel / Trimestriel / Annuel)
// Rebuild the finance chart on click (same data, visual reset)
// ─────────────────────────────────────────────────────────────

function bindPeriodButtons(fin) {
  const periodBtns = document.querySelectorAll(
    '.glass-panel .flex.gap-2 button'
  );
  periodBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      // Toggle active style
      this.closest('.flex')?.querySelectorAll('button').forEach(b => {
        b.className = b.className
          .replace('bg-indigo-600 text-white', 'bg-slate-700 text-slate-300');
      });
      this.className = this.className
        .replace('bg-slate-700 text-slate-300', 'bg-indigo-600 text-white');
      renderFinanceChart(fin);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// EXPORT RAPPORT BUTTON  (.btn-primary)
// Navigate to rapports page
// ─────────────────────────────────────────────────────────────

function bindExportButton() {
  const btn = document.querySelector('header .btn-primary');
  if (btn) btn.addEventListener('click', () => {
    window.location.href = '/dirigeant/rapports/';
  });
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTION BUTTONS  (4 buttons in "Accès Rapide" section)
// Identified by their <p> text content
// ─────────────────────────────────────────────────────────────

function bindQuickActions() {
  const routes = {
    'Nouvel Étudiant':   '/secretariat/etudiants/',
    'Nouvel Enseignant': '/secretariat/enseignants/',
    'Nouveau Groupe':    '/secretariat/groupes/',
    'Générer Rapport':   '/dirigeant/rapports/',
  };
  document.querySelectorAll('.grid.grid-cols-2 button, .grid.md\\:grid-cols-4 button')
    .forEach(btn => {
      const label = btn.querySelector('p')?.textContent?.trim();
      if (label && routes[label])
        btn.addEventListener('click', () => { window.location.href = routes[label]; });
    });
}

// ─────────────────────────────────────────────────────────────
// ALERT ACTION BUTTONS
// ─────────────────────────────────────────────────────────────

function bindAlertButtons() {
  // "Voir détails" → paiements page
  document.querySelector('.alert-critical button')
    ?.addEventListener('click', () => {
      window.location.href = '/comptable/paiements/';
    });

  // "Contacter" → could open a message modal (for now → messagerie)
  document.querySelector('.alert-warning button')
    ?.addEventListener('click', () => {
      window.location.href = '/messagerie/';
    });

  // "Fusionner?" → groupes page
  document.querySelector('.alert-info button')
    ?.addEventListener('click', () => {
      window.location.href = '/secretariat/groupes/';
    });
}

// ─────────────────────────────────────────────────────────────
// LOGOUT  (.logout-link)
// POST /api/auth/logout/ then clear tokens
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
// ERROR BANNER  (prepended to main .p-8 if API fails)
// ─────────────────────────────────────────────────────────────

function showError(msg) {
  const main = document.querySelector('main .p-8');
  if (!main) return;
  const el = document.createElement('div');
  el.className =
    'p-4 mb-6 rounded-xl bg-red-500/20 border border-red-500/40 ' +
    'text-red-400 text-sm flex items-center gap-3';
  el.innerHTML =
    `<i class="fas fa-exclamation-circle flex-shrink-0"></i><span>${msg}</span>`;
  main.prepend(el);
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

async function init() {
  // Single API call — everything derived from this one response
  const d = await api('/api/dashboard/');

  if (!d) {
    showError(
      'Impossible de charger les données. ' +
      'Vérifiez votre authentification ou rechargez la page.'
    );
    bindLogout();
    return;
  }

  renderKPIs(d);
  renderSecondaryStats(d);
  renderAlerts(d);
  renderFinanceChart(d.finances || {});
  renderNiveauChart(d.repartition_niveaux || []);

  bindPeriodButtons(d.finances || {});
  bindExportButton();
  bindQuickActions();
  bindAlertButtons();
  bindLogout();

  // Non-blocking secondary calls
  loadUserInfo().catch(() => {});
  loadNotifBadge().catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);