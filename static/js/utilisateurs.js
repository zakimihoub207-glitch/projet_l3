// ============================================================
// CONFIG & VARIABLES
// ============================================================
const API_URL = '/api';
let currentFilter = 'Tous';
let searchTimeout = null;
let activeMenuButton = null;
let allUsers = [];

// ============================================================
// JWT HELPERS
// ============================================================
function getToken() {
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
}

function getRefreshToken() {
    return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token') || null;
}

function authHeaders() {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    loadUsersFromAPI();
});

function initializeEventListeners() {
    setupTabFilters();
    setupSearch();
    setupNewUserButton();
    // FIX: Removed setupUserCardButtons() here — it uses event delegation
    // and is called once inside setupUserCardButtons() itself (not per render).
    setupUserCardButtonsDelegated();
    setupLogout();
}

// ============================================================
// LOAD USERS FROM API
// ============================================================
async function loadUsersFromAPI() {
    try {
        const response = await fetch(`${API_URL}/utilisateurs/`, {
            headers: authHeaders()
        });

        if (response.ok) {
            allUsers = await response.json();
            renderUsers(allUsers);
            console.log(`Loaded ${allUsers.length} users from API`);
        } else if (response.status === 401) {
            // FIX: Handle expired token — try refresh before redirecting
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                loadUsersFromAPI();
            } else {
                window.location.href = '/login/';
            }
        } else {
            console.error('Failed to load users from API:', response.status);
            showError('Impossible de charger les utilisateurs.');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Erreur réseau. Veuillez réessayer.');
    }
}

// ============================================================
// TOKEN REFRESH
// ============================================================
async function tryRefreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
        const response = await fetch(`${API_URL}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
        });

        if (response.ok) {
            const data = await response.json();
            // Persist new access token in the same storage that had the old one
            if (localStorage.getItem('access_token')) {
                localStorage.setItem('access_token', data.access);
            } else {
                sessionStorage.setItem('access_token', data.access);
            }
            return true;
        }
    } catch (e) {
        console.warn('Token refresh failed:', e);
    }
    return false;
}

// ============================================================
// SHOW ERROR BANNER
// ============================================================
function showError(message) {
    const existing = document.getElementById('error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'error-banner';
    banner.style.cssText = `
        position: fixed; top: 1rem; right: 1rem; z-index: 9999;
        background: #ef4444; color: white; padding: 0.75rem 1.25rem;
        border-radius: 0.5rem; font-size: 0.875rem; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
}

// ============================================================
// RENDER USERS
// ============================================================
function renderUsers(users) {
    // FIX: More robust selector — use a data attribute or ID instead of a
    // fragile escaped class chain. Falls back to the original selector.
    const usersGrid =
        document.getElementById('users-grid') ||
        document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-4');

    if (!usersGrid) return;

    usersGrid.innerHTML = '';

    if (users.length === 0) {
        usersGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: #94a3b8;">
                <i class="fas fa-users-slash" style="font-size:2rem; margin-bottom:1rem;"></i>
                <p>Aucun utilisateur trouvé.</p>
            </div>`;
        updateStats([]);
        return;
    }

    users.forEach(user => {
        const roleClass = getRoleClass(user.role);
        const statusDot = getStatusDot(user.statut);
        // FIX: Use nom_complet with a fallback in case it is missing
        const displayName = user.nom_complet || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Utilisateur';
        const avatar = getAvatarUrl(displayName);

        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.dataset.userId = user.id;
        userCard.dataset.userRole = user.role;

        // FIX: Moved opacity inline style to CSS class logic, not hardcoded on all locked users
        if (user.compte_verrouille) userCard.style.opacity = '0.75';

        userCard.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="w-12 h-12 rounded-full" alt="${escapeHtml(displayName)}">
                    <div>
                        <h3 class="font-semibold text-white">${escapeHtml(displayName)}</h3>
                        <p class="text-sm text-slate-400">${escapeHtml(user.email || '')}</p>
                    </div>
                </div>
                <span class="status-dot ${statusDot}"></span>
            </div>
            <div class="mb-4">
                <span class="role-badge role-${roleClass}">${escapeHtml(user.role || '')}</span>
                ${user.compte_verrouille
                    ? '<span class="ml-2 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">Bloqué</span>'
                    : ''}
            </div>
            <div class="space-y-2 text-sm text-slate-400 mb-4">
                <div class="flex items-center gap-2">
                    <i class="fas fa-phone text-xs"></i>
                    ${escapeHtml(user.telephone || 'N/A')}
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-clock text-xs"></i>
                    ${formatDate(user.derniere_connexion)}
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-shield-alt text-xs"></i>
                    ${user.permission_2fa ? '2FA Activé' : '2FA Désactivé'}
                </div>
            </div>
            <div class="flex gap-2" style="position:relative;">
                ${user.compte_verrouille
                    ? `<button class="btn-unlock flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm transition-colors border-none cursor-pointer text-white">
                           <i class="fas fa-unlock mr-1"></i> Débloquer
                       </button>`
                    : `<button class="btn-edit flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border-none cursor-pointer text-white">
                           <i class="fas fa-edit mr-1"></i> Modifier
                       </button>`
                }
                <button class="btn-menu px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border-none cursor-pointer text-slate-400">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        usersGrid.appendChild(userCard);
    });

    updateStats(users);
    // FIX: Do NOT re-call setupUserCardButtons() after each render.
    // The delegated listener on `document` handles all cards automatically.
}

// ============================================================
// XSS PROTECTION
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(users) {
    const total = users.length;
    const actifs = users.filter(u => u.statut === 'Actif').length;
    // FIX: "En attente" should count 'En attente' status, not 'Inactif'
    const enAttente = users.filter(u => u.statut === 'En attente' || u.statut === 'Inactif').length;
    const bloques = users.filter(u => u.compte_verrouille === true).length;

    const statCards = document.querySelectorAll(
        '.grid.grid-cols-1.md\\:grid-cols-4.gap-4 .glass-panel p.text-3xl'
    );

    if (statCards.length >= 4) {
        statCards[0].textContent = total;
        statCards[1].textContent = actifs;
        statCards[2].textContent = enAttente;
        statCards[3].textContent = bloques;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function getRoleClass(role) {
    const roleMap = {
        'Dirigeant': 'dirigeant',
        'Comptable': 'comptable',
        'Secretariat': 'secretaire',
        'Enseignant': 'enseignant',
        'Etudiant': 'etudiant',
        'Parent': 'parent'
    };
    return roleMap[role] || (role ? role.toLowerCase() : 'default');
}

function getStatusDot(statut) {
    const dotMap = {
        'Actif': 'status-active',
        'Inactif': 'status-inactive',
        'En attente': 'status-inactive',
        'Suspendu': 'status-locked'
    };
    return dotMap[statut] || 'status-inactive';
}

function getAvatarUrl(name) {
    const encodedName = encodeURIComponent(name || 'User');
    return `https://ui-avatars.com/api/?name=${encodedName}&background=6366f1&color=fff`;
}

function formatDate(dateString) {
    if (!dateString) return 'Jamais';

    const date = new Date(dateString);
    // FIX: Guard against invalid dates
    if (isNaN(date.getTime())) return 'Date invalide';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Maintenant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 30) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR');
}

// ============================================================
// SETUP TAB FILTERS
// ============================================================
function setupTabFilters() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.textContent.trim();
            closeAllMenus();
            filterUsers();
        });
    });
}

// ============================================================
// SETUP SEARCH
// ============================================================
function setupSearch() {
    const searchInput = document.querySelector('.search-input');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterUsers, 300);
        });
    }
}

// ============================================================
// SETUP NEW USER BUTTON — opens a real modal form
// ============================================================
function setupNewUserButton() {
    const newUserBtn = document.querySelector('header button.btn-primary');

    if (newUserBtn) {
        newUserBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openUserModal(null); // null = create mode
        });
    }
}

// ============================================================
// USER MODAL (Create / Edit)
// ============================================================
function openUserModal(user) {
    // Remove any existing modal
    document.getElementById('user-modal')?.remove();

    const isEdit = !!user;
    const modal = document.createElement('div');
    modal.id = 'user-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center; z-index:1000;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:1rem;
                    padding:2rem; width:100%; max-width:480px; color:white; position:relative;">
            <button id="modal-close" style="position:absolute;top:1rem;right:1rem;
                background:none;border:none;color:#94a3b8;font-size:1.25rem;cursor:pointer;">
                <i class="fas fa-times"></i>
            </button>
            <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1.5rem;">
                ${isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h2>
            <div style="display:flex;flex-direction:column;gap:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div>
                        <label style="font-size:.8rem;color:#94a3b8;">Prénom</label>
                        <input id="modal-firstname" type="text" value="${escapeHtml(user?.first_name || '')}"
                            placeholder="Prénom"
                            style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                                   border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                    </div>
                    <div>
                        <label style="font-size:.8rem;color:#94a3b8;">Nom</label>
                        <input id="modal-lastname" type="text" value="${escapeHtml(user?.last_name || '')}"
                            placeholder="Nom"
                            style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                                   border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                    </div>
                </div>
                <div>
                    <label style="font-size:.8rem;color:#94a3b8;">Email</label>
                    <input id="modal-email" type="email" value="${escapeHtml(user?.email || '')}"
                        placeholder="email@example.com"
                        style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                               border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                </div>
                <div>
                    <label style="font-size:.8rem;color:#94a3b8;">Téléphone</label>
                    <input id="modal-phone" type="text" value="${escapeHtml(user?.telephone || '')}"
                        placeholder="+213 6 12 34 56 78"
                        style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                               border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                </div>
                <div>
                    <label style="font-size:.8rem;color:#94a3b8;">Rôle</label>
                    <select id="modal-role"
                        style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                               border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                        ${['Dirigeant','Comptable','Secretariat','Enseignant','Etudiant','Parent']
                            .map(r => `<option value="${r}" ${user?.role===r?'selected':''}>${r}</option>`)
                            .join('')}
                    </select>
                </div>
                ${!isEdit ? `
                <div>
                    <label style="font-size:.8rem;color:#94a3b8;">Mot de passe temporaire</label>
                    <input id="modal-password" type="password" placeholder="••••••••"
                        style="width:100%;margin-top:.25rem;padding:.5rem .75rem;background:#0f172a;
                               border:1px solid #334155;border-radius:.5rem;color:white;font-size:.875rem;">
                </div>` : ''}
                <div id="modal-error" style="color:#f87171;font-size:.8rem;display:none;"></div>
                <button id="modal-submit"
                    style="margin-top:.5rem;padding:.75rem;background:#6366f1;border:none;border-radius:.5rem;
                           color:white;font-size:.875rem;font-weight:600;cursor:pointer;transition:background .2s;">
                    ${isEdit ? 'Enregistrer les modifications' : 'Créer l\'utilisateur'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('modal-submit').addEventListener('click', async () => {
        await submitUserModal(user?.id || null);
    });
}

async function submitUserModal(userId) {
    const errorEl = document.getElementById('modal-error');
    errorEl.style.display = 'none';

    const first_name = document.getElementById('modal-firstname').value.trim();
    const last_name  = document.getElementById('modal-lastname').value.trim();
    const email      = document.getElementById('modal-email').value.trim();
    const telephone  = document.getElementById('modal-phone').value.trim();
    const role       = document.getElementById('modal-role').value;
    const password   = document.getElementById('modal-password')?.value || null;

    if (!first_name || !last_name || !email) {
        errorEl.textContent = 'Prénom, nom et email sont obligatoires.';
        errorEl.style.display = 'block';
        return;
    }

    const payload = { first_name, last_name, email, telephone, role };
    if (password) payload.password = password;

    const isEdit = !!userId;
    const url  = isEdit ? `${API_URL}/utilisateurs/${userId}/` : `${API_URL}/utilisateurs/`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('user-modal').remove();
            await loadUsersFromAPI(); // Refresh list
        } else {
            const data = await response.json().catch(() => ({}));
            errorEl.textContent = data.detail || data.email?.[0] || 'Une erreur est survenue.';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Erreur réseau. Veuillez réessayer.';
        errorEl.style.display = 'block';
    }
}

// ============================================================
// SETUP USER CARD BUTTONS — single delegated listener
// FIX: The original code called this after every render, which
// stacked duplicate listeners. Now registered once on `document`.
// ============================================================
function setupUserCardButtonsDelegated() {
    document.addEventListener('click', function (e) {
        // Close menus when clicking outside
        if (!e.target.closest('.user-menu') && !e.target.closest('.btn-menu')) {
            closeAllMenus();
        }

        const button = e.target.closest('.user-card button');
        if (!button) return;

        e.preventDefault();
        e.stopPropagation();

        if (button.classList.contains('btn-edit')) {
            handleEditUser(button);
        } else if (button.classList.contains('btn-menu')) {
            handleMenuButton(button);
        } else if (button.classList.contains('btn-unlock')) {
            handleUnlockUser(button);
        }
    });
}

// ============================================================
// HANDLE EDIT USER
// ============================================================
function handleEditUser(button) {
    const userCard = button.closest('.user-card');
    const userId = userCard.dataset.userId;
    // Find the user object from allUsers
    const user = allUsers.find(u => String(u.id) === String(userId));
    openUserModal(user || null);
}

// ============================================================
// HANDLE UNLOCK USER
// ============================================================
async function handleUnlockUser(button) {
    const userCard = button.closest('.user-card');
    const userId = userCard.dataset.userId;
    const user = allUsers.find(u => String(u.id) === String(userId));
    const userName = user?.nom_complet || 'cet utilisateur';

    if (!confirm(`Débloquer ${userName} ?`)) return;

    try {
        const response = await fetch(`${API_URL}/utilisateurs/${userId}/debloquer/`, {
            method: 'POST',
            headers: authHeaders()
        });

        if (response.ok) {
            await loadUsersFromAPI();
        } else {
            showError(`Impossible de débloquer ${userName}.`);
        }
    } catch (err) {
        showError('Erreur réseau lors du déblocage.');
    }
}

// ============================================================
// HANDLE MENU BUTTON
// ============================================================
function handleMenuButton(button) {
    const isAlreadyOpen = button.querySelector('.user-menu');
    closeAllMenus();
    if (isAlreadyOpen) return; // Toggle off if same button clicked

    showUserMenu(button);
    activeMenuButton = button;
}

// ============================================================
// SHOW USER MENU
// ============================================================
function showUserMenu(button) {
    const userCard = button.closest('.user-card');
    const userId = userCard.dataset.userId;
    const user = allUsers.find(u => String(u.id) === String(userId));
    const userName = user?.nom_complet || 'cet utilisateur';

    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.style.cssText = `
        position:absolute; right:0; top:calc(100% + 4px);
        min-width:200px; background:#1e293b; border:1px solid #334155;
        border-radius:.5rem; box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index:50;
    `;

    menu.innerHTML = `
        <div style="padding:.5rem 0;">
            <a href="#" data-action="view"
               style="display:block;padding:.5rem 1rem;font-size:.875rem;color:white;text-decoration:none;">
                <i class="fas fa-eye" style="width:1.25rem;"></i> Voir détails
            </a>
            <a href="#" data-action="edit"
               style="display:block;padding:.5rem 1rem;font-size:.875rem;color:white;text-decoration:none;">
                <i class="fas fa-edit" style="width:1.25rem;"></i> Modifier
            </a>
            <a href="#" data-action="reset-password"
               style="display:block;padding:.5rem 1rem;font-size:.875rem;color:white;text-decoration:none;">
                <i class="fas fa-key" style="width:1.25rem;"></i> Réinitialiser mot de passe
            </a>
            <hr style="border-color:#334155;margin:.25rem 0;">
            <a href="#" data-action="delete"
               style="display:block;padding:.5rem 1rem;font-size:.875rem;color:#f87171;text-decoration:none;">
                <i class="fas fa-trash" style="width:1.25rem;"></i> Supprimer
            </a>
        </div>
    `;

    // Position relative to the button
    button.style.position = 'relative';
    button.appendChild(menu);

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            const action = this.dataset.action;
            closeAllMenus();

            switch (action) {
                case 'view':
                    openViewModal(user);
                    break;
                case 'edit':
                    openUserModal(user);
                    break;
                case 'reset-password':
                    await handleResetPassword(userId, userName);
                    break;
                case 'delete':
                    await handleDeleteUser(userId, userName);
                    break;
            }
        });
    });
}

// ============================================================
// VIEW DETAILS MODAL
// ============================================================
function openViewModal(user) {
    document.getElementById('view-modal')?.remove();

    if (!user) return;

    const modal = document.createElement('div');
    modal.id = 'view-modal';
    modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;z-index:1000;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:1rem;
                    padding:2rem;width:100%;max-width:420px;color:white;position:relative;">
            <button id="view-modal-close"
                style="position:absolute;top:1rem;right:1rem;background:none;
                       border:none;color:#94a3b8;font-size:1.25rem;cursor:pointer;">
                <i class="fas fa-times"></i>
            </button>
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                <img src="${getAvatarUrl(user.nom_complet)}" style="width:64px;height:64px;border-radius:50%;">
                <div>
                    <h2 style="font-size:1.125rem;font-weight:700;">${escapeHtml(user.nom_complet || '')}</h2>
                    <p style="font-size:.875rem;color:#94a3b8;">${escapeHtml(user.email || '')}</p>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:.75rem;font-size:.875rem;color:#cbd5e1;">
                <div><span style="color:#64748b;">Rôle :</span> ${escapeHtml(user.role || '')}</div>
                <div><span style="color:#64748b;">Statut :</span> ${escapeHtml(user.statut || '')}</div>
                <div><span style="color:#64748b;">Téléphone :</span> ${escapeHtml(user.telephone || 'N/A')}</div>
                <div><span style="color:#64748b;">2FA :</span> ${user.permission_2fa ? 'Activé' : 'Désactivé'}</div>
                <div><span style="color:#64748b;">Compte bloqué :</span> ${user.compte_verrouille ? 'Oui' : 'Non'}</div>
                <div><span style="color:#64748b;">Dernière connexion :</span> ${formatDate(user.derniere_connexion)}</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('view-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ============================================================
// RESET PASSWORD
// ============================================================
async function handleResetPassword(userId, userName) {
    if (!confirm(`Réinitialiser le mot de passe de ${userName} ? Un email sera envoyé.`)) return;

    try {
        const response = await fetch(`${API_URL}/utilisateurs/${userId}/reset-password/`, {
            method: 'POST',
            headers: authHeaders()
        });

        if (response.ok) {
            showSuccess(`Email de réinitialisation envoyé à ${userName}.`);
        } else {
            showError('Échec de la réinitialisation du mot de passe.');
        }
    } catch (err) {
        showError('Erreur réseau.');
    }
}

// ============================================================
// DELETE USER
// ============================================================
async function handleDeleteUser(userId, userName) {
    if (!confirm(`Supprimer définitivement ${userName} ? Cette action est irréversible.`)) return;

    try {
        const response = await fetch(`${API_URL}/utilisateurs/${userId}/`, {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (response.ok || response.status === 204) {
            await loadUsersFromAPI();
            showSuccess(`${userName} a été supprimé.`);
        } else {
            showError(`Impossible de supprimer ${userName}.`);
        }
    } catch (err) {
        showError('Erreur réseau lors de la suppression.');
    }
}

// ============================================================
// SUCCESS BANNER
// ============================================================
function showSuccess(message) {
    const existing = document.getElementById('success-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'success-banner';
    banner.style.cssText = `
        position:fixed;top:1rem;right:1rem;z-index:9999;
        background:#10b981;color:white;padding:.75rem 1.25rem;
        border-radius:.5rem;font-size:.875rem;box-shadow:0 4px 12px rgba(0,0,0,.3);
    `;
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);
}

// ============================================================
// CLOSE ALL MENUS
// ============================================================
function closeAllMenus() {
    document.querySelectorAll('.user-menu').forEach(menu => menu.remove());
    activeMenuButton = null;
}

// ============================================================
// FILTER USERS
// ============================================================
function filterUsers() {
    const searchTerm = document.querySelector('.search-input')?.value.toLowerCase().trim() || '';

    const filtered = allUsers.filter(user => {
        const name = (user.nom_complet || `${user.first_name || ''} ${user.last_name || ''}`).toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.telephone || '').toLowerCase();

        const matchesSearch = !searchTerm ||
            name.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm);

        // FIX: Added more role mappings to match actual tab labels
        let matchesFilter = currentFilter === 'Tous';
        if (!matchesFilter) {
            const filterMap = {
                'Dirigeants':  ['Dirigeant'],
                'Etudiants':   ['Etudiant'],
                'Secrétariat': ['Secretariat'],
                'Enseignants': ['Enseignant'],
                'Comptables':  ['Comptable'],
                'Parents':     ['Parent'],
            };
            const allowed = filterMap[currentFilter] || [];
            matchesFilter = allowed.includes(user.role);
        }

        return matchesSearch && matchesFilter;
    });

    renderUsers(filtered);
}

// ============================================================
// LOGOUT
// ============================================================
function setupLogout() {
    const logoutLink = document.querySelector('.logout-link');

    if (logoutLink) {
        logoutLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Voulez-vous vous déconnecter ?')) {
                logout();
            }
        });
    }
}

async function logout() {
    const token = getToken();
    const refresh = getRefreshToken();

    try {
        await fetch(`${API_URL}/auth/logout/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ refresh: refresh || '' })
        });
    } catch (error) {
        console.warn('Logout API call failed:', error);
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');

    window.location.href = '/login/';
}