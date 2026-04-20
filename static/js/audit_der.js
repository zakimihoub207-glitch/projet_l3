// audit_der.js - JavaScript pour la page d'audit du dirigeant

document.addEventListener('DOMContentLoaded', function() {
    // Initialisation
    initializeAuditPage();

    // Charger les données d'audit au démarrage
    loadAuditLogs();
});

// =====================================================
// INITIALISATION
// =====================================================

function initializeAuditPage() {
    console.log('Initialisation de la page audit...');

    // Initialiser les filtres
    initializeFilters();

    // Initialiser la recherche
    initializeSearch();

    // Initialiser l'export
    initializeExport();

    // Initialiser la pagination
    initializePagination();

    // Initialiser le logout
    if (typeof setupLogout === 'function') {
        setupLogout();
    }
}

// =====================================================
// GESTION DES FILTRES
// =====================================================

function initializeFilters() {
    // Filtre par action
    const actionFilter = document.getElementById('action-filter');
    if (actionFilter) {
        actionFilter.addEventListener('change', function() {
            loadAuditLogs();
        });
    }

    // Filtre par entité
    const entityFilter = document.getElementById('entity-filter');
    if (entityFilter) {
        entityFilter.addEventListener('change', function() {
            loadAuditLogs();
        });
    }

    // Filtre par utilisateur
    const userFilter = document.getElementById('user-filter');
    if (userFilter) {
        userFilter.addEventListener('change', function() {
            loadAuditLogs();
        });
    }

    // Boutons de filtre rapide
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filterType = this.dataset.filter;
            applyQuickFilter(filterType);
        });
    });
}

// =====================================================
// EXPORT DES LOGS D'AUDIT
// =====================================================

async function exportAuditLogs() {
    const btn = document.querySelector('button[onclick="exportAuditLogs()"]');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Export en cours...';
        btn.disabled = true;

        const response = await fetch('/api/audit/?export=csv', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Créer un log d'audit pour cette action
            await createAuditLog('EXPORT', 'Audit', null, null, null, 'Succes');

            showToast('✅ Logs d\'audit exportés avec succès', 'success');
        } else {
            throw new Error('Erreur lors de l\'export');
        }
    } catch (error) {
        console.error('Erreur export:', error);
        showToast('❌ Erreur lors de l\'export des logs', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function exportFilteredAuditLogs() {
    const btn = document.getElementById('export-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Export...';
        btn.disabled = true;

        // Récupérer les filtres actuels
        const action = document.getElementById('action-filter').value;
        const entite = document.getElementById('entity-filter').value;
        const search = document.getElementById('search-input').value;

        let url = '/api/audit/?export=csv';
        if (action) url += `&action=${action}`;
        if (entite) url += `&entite=${entite}`;
        if (search) url += `&search=${search}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_filtered_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Créer un log d'audit pour cette action
            await createAuditLog('EXPORT', 'Audit', null, null, null, 'Succes');

            showToast('✅ Logs d\'audit filtrés exportés avec succès', 'success');
        } else {
            throw new Error('Erreur lors de l\'export');
        }
    } catch (error) {
        console.error('Erreur export:', error);
        showToast('❌ Erreur lors de l\'export des logs filtrés', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// =====================================================
// GESTION DES FILTRES
// =====================================================

function applyQuickFilter(filterType) {
    // Réinitialiser tous les filtres
    document.getElementById('action-filter').value = '';
    document.getElementById('entity-filter').value = '';
    document.getElementById('search-input').value = '';

    // Réinitialiser les boutons actifs
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');

    // Appliquer le filtre rapide
    switch(filterType) { 
        case 'all':
            // Pas de filtre
            break;
        case 'login':
            document.getElementById('action-filter').value = 'LOGIN';
            break;
        case 'create':
            document.getElementById('action-filter').value = 'CREATE';
            break;
        case 'update':
            document.getElementById('action-filter').value = 'UPDATE';
            break;
        case 'delete':
            document.getElementById('action-filter').value = 'DELETE';
            break;
        case 'export':
            document.getElementById('action-filter').value = 'DOWNLOAD';
            break;
    }

    // Recharger les logs avec le nouveau filtre
    loadAuditLogs();
}
    

    // Recharger les données
    loadAuditLogs();


// =====================================================
// RECHERCHE
// =====================================================

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadAuditLogs();
            }, 500); // Debounce 500ms
        });
    }
}

// =====================================================
// EXPORT
// =====================================================

function initializeExport() {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportAuditLogs();
        });
    }
}

function exportAuditLogs() {
    // Récupérer les paramètres de filtrage actuels
    const action = document.getElementById('action-filter')?.value || '';
    const entity = document.getElementById('entity-filter')?.value || '';
    const user = document.getElementById('user-filter')?.value || '';
    const search = document.getElementById('search-input')?.value || '';

    // Construire l'URL avec les paramètres
    let url = '/api/audit/?export=csv';
    if (action) url += `&action=${action}`;
    if (entity) url += `&entite=${entity}`;
    if (user) url += `&utilisateur=${user}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    // Ouvrir dans un nouvel onglet pour le téléchargement
    window.open(url, '_blank');
}

// =====================================================
// PAGINATION
// =====================================================

let currentPage = 1;
const itemsPerPage = 20;

function initializePagination() {
    // Les contrôles de pagination seront créés dynamiquement
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById('pagination-container');

    if (!paginationContainer) return;

    let paginationHtml = '';

    if (totalPages > 1) {
        // Bouton précédent
        paginationHtml += `<button class="px-3 py-1 mx-1 bg-gray-600 text-white rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-500'}" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Précédent</button>`;

        // Pages
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                paginationHtml += `<button class="px-3 py-1 mx-1 bg-indigo-600 text-white rounded">${i}</button>`;
            } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                paginationHtml += `<button class="px-3 py-1 mx-1 bg-gray-600 text-white rounded hover:bg-gray-500" onclick="changePage(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                paginationHtml += `<span class="px-2 py-1 mx-1 text-gray-400">...</span>`;
            }
        }

        // Bouton suivant
        paginationHtml += `<button class="px-3 py-1 mx-1 bg-gray-600 text-white rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-500'}" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Suivant</button>`;
    }

    paginationContainer.innerHTML = paginationHtml;
}

function changePage(page) {
    currentPage = page;
    loadAuditLogs();
}

// =====================================================
// CHARGEMENT DES DONNÉES D'AUDIT
// =====================================================

async function loadAuditLogs() {
    try {
        showLoading();

        // Récupérer les paramètres de filtrage
        const action = document.getElementById('action-filter')?.value || '';
        const entity = document.getElementById('entity-filter')?.value || '';
        const user = document.getElementById('user-filter')?.value || '';
        const search = document.getElementById('search-input')?.value || '';

        // Construire l'URL avec les paramètres
        let url = `/api/audit/?page=${currentPage}&limit=${itemsPerPage}`;
        if (action) url += `&action=${action}`;
        if (entity) url += `&entite=${entity}`;
        if (user) url += `&utilisateur=${user}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        // Récupérer le token JWT
        const token = getAuthToken();
        if (!token) {
            showError('Session expirée. Veuillez vous reconnecter.');
            return;
        }

        // Faire la requête API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                showError('Session expirée. Veuillez vous reconnecter.');
                return;
            }
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Afficher les données
        displayAuditLogs(data.results || data);

        // Mettre à jour la pagination
        updatePagination(data.count || (data.results ? data.results.length : 0));

        hideLoading();

    } catch (error) {
        console.error('Erreur lors du chargement des logs d\'audit:', error);
        showError('Erreur lors du chargement des données d\'audit');
        hideLoading();
    }
}

function displayAuditLogs(auditLogs) {
    const container = document.getElementById('audit-list');
    if (!container) return;

    if (!auditLogs || auditLogs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-history text-4xl mb-4"></i>
                <p>Aucun log d'audit trouvé</p>
            </div>
        `;
        return;
    }

    let html = '';
    auditLogs.forEach(log => {
        const actionClass = getActionClass(log.action);
        const actionIcon = getActionIcon(log.action);
        const formattedDate = formatDate(log.date_action);

        html += `
            <div class="audit-item ${actionClass} flex items-start gap-4 p-4 bg-gray-800 rounded-lg mb-3">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 ${actionClass.replace('audit-', 'bg-')} rounded-full flex items-center justify-center">
                        <i class="${actionIcon} text-white"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="font-medium text-white">${log.utilisateur_nom || 'Système'}</span>
                            <span class="text-sm text-gray-400">•</span>
                            <span class="text-sm text-gray-400">${log.entite}</span>
                            ${log.id_entite ? `<span class="text-sm text-gray-400">•</span><span class="text-sm text-gray-400">ID: ${log.id_entite}</span>` : ''}
                        </div>
                        <span class="text-sm text-gray-400">${formattedDate}</span>
                    </div>
                    <div class="text-sm text-gray-300 mb-2">
                        <span class="font-medium ${actionClass.replace('audit-', 'text-')}">${getActionLabel(log.action)}</span>
                        ${log.entite ? ` sur ${log.entite}` : ''}
                        ${log.id_entite ? ` (ID: ${log.id_entite})` : ''}
                    </div>
                    ${log.ancienne_valeur || log.nouvelle_valeur ? `
                        <div class="text-xs text-gray-400 bg-gray-700 p-2 rounded mt-2">
                            ${log.ancienne_valeur ? `<div><strong>Ancien:</strong> ${log.ancienne_valeur}</div>` : ''}
                            ${log.nouvelle_valeur ? `<div><strong>Nouveau:</strong> ${log.nouvelle_valeur}</div>` : ''}
                        </div>
                    ` : ''}
                    ${log.message_erreur ? `
                        <div class="text-xs text-red-400 bg-red-900 p-2 rounded mt-2">
                            <strong>Erreur:</strong> ${log.message_erreur}
                        </div>
                    ` : ''}
                    ${log.adresse_ip ? `
                        <div class="text-xs text-gray-500 mt-1">
                            IP: ${log.adresse_ip}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// =====================================================
// UTILITAIRES
// =====================================================

function getActionClass(action) {
    switch(action) {
        case 'CREATE': return 'audit-create';
        case 'UPDATE': return 'audit-update';
        case 'DELETE': return 'audit-delete';
        case 'LOGIN': return 'audit-login';
        case 'LOGOUT': return 'audit-logout';
        case 'DOWNLOAD': return 'audit-export';
        default: return 'audit-default';
    }
}

function getActionIcon(action) {
    switch(action) {
        case 'CREATE': return 'fas fa-plus';
        case 'UPDATE': return 'fas fa-edit';
        case 'DELETE': return 'fas fa-trash';
        case 'LOGIN': return 'fas fa-sign-in-alt';
        case 'LOGOUT': return 'fas fa-sign-out-alt';
        case 'DOWNLOAD': return 'fas fa-download';
        default: return 'fas fa-cog';
    }
}

function getActionLabel(action) {
    switch(action) {
        case 'CREATE': return 'Création';
        case 'UPDATE': return 'Modification';
        case 'DELETE': return 'Suppression';
        case 'LOGIN': return 'Connexion';
        case 'LOGOUT': return 'Déconnexion';
        case 'DOWNLOAD': return 'Téléchargement';
        default: return action;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    if (days < 7) return `Il y a ${days} j`;

    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getAuthToken() {
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

function setupLogout() {
    const logoutLink = document.querySelector('.logout-link');
    if (!logoutLink) return;

    logoutLink.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Voulez-vous vous déconnecter ?')) {
            logout();
        }
    });
}

// =====================================================
// CRÉATION DE LOGS D'AUDIT
// =====================================================

async function createAuditLog(action, entite, id_entite, ancienne_valeur, nouvelle_valeur, resultat = 'Succes') {
    try {
        const auditData = {
            action: action,
            entite: entite,
            id_entite: id_entite,
            ancienne_valeur: ancienne_valeur,
            nouvelle_valeur: nouvelle_valeur,
            resultat: resultat,
            adresse_ip: await getClientIP(),
            navigateur: navigator.userAgent
        };

        const response = await fetch('/api/audit/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(auditData)
        });

        if (!response.ok) {
            console.warn('Erreur lors de la création du log d\'audit:', response.status);
        }
    } catch (error) {
        console.warn('Erreur lors de la création du log d\'audit:', error);
    }
}

async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '127.0.0.1'; // Fallback
    }
}

// =====================================================
// UTILITAIRES
// =====================================================

function showToast(message, type = 'info') {
    // Créer un toast simple
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}

function showError(message) {
    showToast(message, 'error');
}

function showLoading() {
    const container = document.getElementById('audit-list');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-spinner fa-spin text-2xl text-indigo-400 mb-4"></i>
                <p class="text-gray-400">Chargement des logs...</p>
            </div>
        `;
    }
}

function hideLoading() {
    // Le contenu sera remplacé par displayAuditLogs
}

async function logout() {
    const token = getAuthToken();
    const refresh = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');

    try {
        await fetch('/api/auth/logout/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ refresh })
        });
    } catch (error) {
        console.warn('Échec de la déconnexion, suppression locale de la session.', error);
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
    window.location.href = '/login/';
}

function showLoading() {
    const container = document.getElementById('audit-list');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                <p class="text-gray-400 mt-2">Chargement des logs d'audit...</p>
            </div>
        `;
    }
}

function hideLoading() {
    // Le contenu sera remplacé par displayAuditLogs
}

function showError(message) {
    const container = document.getElementById('audit-list');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// =====================================================
// FONCTIONS GLOBALES (accessibles depuis HTML)
// =====================================================

window.applyQuickFilter = applyQuickFilter;
window.changePage = changePage;
window.exportAuditLogs = exportAuditLogs;