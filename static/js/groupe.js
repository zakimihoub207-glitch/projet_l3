// groupe.js - Group Management System with Database Integration

document.addEventListener('DOMContentLoaded', function() {
    // Helper to get JWT token from storage
    function getAuthToken() {
        return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
    }

    // State management
    const state = {
        groups: [],
        currentFilter: 'all',
        searchQuery: '',
        apiBaseUrl: '/api',
        authToken: getAuthToken()
    };

    // DOM Elements
    const elements = {
        filterBtns: document.querySelectorAll('.filter-btn'),
        groupsGrid: document.querySelector('.groups-grid'),
        searchInput: null // Will create dynamically
    };

    // Initialize
    init();

    function init() {
        // Check authentication
        if (!state.authToken) {
            showNotification('❌ Veuillez vous connecter d\'abord', 'error');
            setTimeout(() => {
                window.location.href = '/login/';
            }, 2000);
            return;
        }

        createSearchBox();
        setupEventListeners();
        loadGroupsFromDatabase();
    }

    // Create search box dynamically
    function createSearchBox() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.cssText = `
            margin-bottom: 2rem;
            position: relative;
            max-width: 400px;
        `;

        searchContainer.innerHTML = `
            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;">🔍</span>
            <input type="text" id="groupSearch" placeholder="Rechercher un groupe..."
                style="width: 100%; padding: 1rem 1rem 1rem 3rem; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; transition: all 0.3s;">
        `;

        const filters = document.querySelector('.filters');
        filters.parentNode.insertBefore(searchContainer, filters.nextSibling);

        elements.searchInput = searchContainer.querySelector('#groupSearch');
    }

    // Setup event listeners
    function setupEventListeners() {
        // Filter buttons
        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveFilter(btn);
                const filterText = btn.textContent.trim().toLowerCase();
                state.currentFilter = filterText;
                filterGroups();
            });
        });

        // Search input
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce((e) => {
                state.searchQuery = e.target.value.toLowerCase();
                filterGroups();
            }, 300));
        }

        // Card action buttons
        setupCardActions();
    }

    // Load groups from database
    async function loadGroupsFromDatabase() {
        try {
            showLoadingState();

            const response = await fetch(`${state.apiBaseUrl}/groupes/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    handleAuthError();
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            state.groups = Array.isArray(data) ? data : (data.results || []);

            renderGroups(state.groups);
            updateFilterCounts(state.groups);

        } catch (error) {
            console.error('Error loading groups:', error);
            showNotification('❌ Erreur lors du chargement des groupes', 'error');
            renderStaticGroups(); // Fallback to static data
        }
    }

    // Show loading state
    function showLoadingState() {
        elements.groupsGrid.innerHTML = `
            <div class="loading-state" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <p style="color: #64748b;">Chargement des groupes...</p>
            </div>
        `;
    }

    // Render groups to grid
    function renderGroups(groups) {
        elements.groupsGrid.innerHTML = '';

        if (groups.length === 0) {
            showNoResults();
            return;
        }

        groups.forEach(group => {
            const card = createGroupCard(group);
            elements.groupsGrid.appendChild(card);
        });

        setupCardActions();
    }

    // Create group card from data
function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.id = group.id;
    card.dataset.status = (group.statut_groupe || 'actif').toLowerCase();
    card.dataset.name = (group.nom_groupe || '').toLowerCase();
    card.dataset.langue = (group.langue || '').toLowerCase();
    card.dataset.niveau = (group.niveau || '').toLowerCase();

    // Determine colors based on level
    const levelColors = {
        'A1': 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        'A2': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'B1': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'B2': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'C1': 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)'
    };

    const headerBg = levelColors[group.niveau] || levelColors['A1'];
    const isActive = (group.statut_groupe || 'Actif') === 'Actif';
    const statusClass = isActive ? 'status-active' : 'status-completed';
    const statusText = isActive ? 'Actif' : 'Terminé';

    // Calculate stats
    const nbEtudiants = group.nombre_etudiants || 0;
    const moyenne = group.moyenne_groupe || '0.0';
    const tauxAssiduite = group.taux_assiduité || 0;

    // Get colors for schedule section
    const scheduleBg = {
        'A1': '#e0f8f7', 'A2': '#eff6ff', 'B1': '#fdf2f8',
        'B2': '#ecfeff', 'C1': '#fef2f2'
    }[group.niveau] || '#eff6ff';

    const scheduleBorder = {
        'A1': '#06b6d4', 'A2': '#667eea', 'B1': '#ec4899',
        'B2': '#06b6d4', 'C1': '#dc2626'
    }[group.niveau] || '#667eea';

    const scheduleTitleColor = {
        'A1': '#155e75', 'A2': '#1e40af', 'B1': '#9d174d',
        'B2': '#155e75', 'C1': '#7f1d1d'
    }[group.niveau] || '#1e40af';

    const scheduleTextColor = {
        'A1': '#0e7490', 'A2': '#3b82f6', 'B1': '#be185d',
        'B2': '#0e7490', 'C1': '#991b1b'
    }[group.niveau] || '#3b82f6';

    card.innerHTML = `
        <div class="group-header" style="background: ${headerBg};">
            <span class="status-badge ${statusClass}">${statusText}</span>
            <span class="group-level">${group.niveau || 'A1'}</span>
            <h3 class="group-title">${escapeHtml(group.nom_groupe || 'Groupe sans nom')}</h3>
            <span class="group-lang">🇬🇧 ${escapeHtml(group.langue || 'Anglais')} - ${getNiveauLabel(group.niveau)}</span>
        </div>
        <div class="group-body">
            <div class="stats-row">
                <div class="stat-box">
                    <span class="stat-number">${nbEtudiants}</span>
                    <span class="stat-label">Étudiants</span>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${moyenne}</span>
                    <span class="stat-label">Moyenne</span>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${tauxAssiduite}%</span>
                    <span class="stat-label">Assiduité</span>
                </div>
            </div>

            <div class="schedule-info" style="background: ${scheduleBg}; border-color: ${scheduleBorder};">
                <h4 style="color: ${scheduleTitleColor};">📅 Planning</h4>
                <p style="color: ${scheduleTextColor};">
                    ${escapeHtml(group.planning || 'Horaire non défini')}<br>
                    ${escapeHtml(group.salle || 'Salle non assignée')}
                </p>
            </div>

            <div class="progress-section">
                <div class="progress-header">
                    <span>Progression du programme</span>
                    <span>${group.progression || 0}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${group.progression || 0}%; background: ${headerBg};"></div>
                </div>
            </div>

            <div class="students-preview">
                <div class="avatar-stack">
                    ${generateAvatars(nbEtudiants, headerBg)}
                </div>
                <span class="more-students">${nbEtudiants > 3 ? (nbEtudiants - 3) + ' autres étudiants' : 'Voir détails'}</span>
            </div>

            <div class="group-actions" style="margin-top: 1.5rem;">
                <button class="btn-action btn-primary view-details-btn" data-id="${group.id}" style="background: ${headerBg};">
                    📊 Voir Détails
                </button>
                <button class="btn-action btn-secondary notes-btn" data-id="${group.id}">
                    📝 Notes
                </button>
            </div>
        </div>
    `;

    return card;
}

    // Generate avatar placeholders
    function generateAvatars(count, bg) {
        const initials = ['AB', 'SK', 'ML', 'JD', 'AL', 'MK'];
        let html = '';
        const displayCount = Math.min(count, 3);

        for (let i = 0; i < displayCount; i++) {
            html += `<div class="avatar" style="background: ${bg};">${initials[i] || 'ST'}</div>`;
        }

        if (count > 3) {
            html += `<div class="avatar" style="background: ${bg};">+${count - 3}</div>`;
        }

        return html;
    }

    // Helper functions for styling
    function getNiveauLabel(niveau) {
        const labels = {
            'A1': 'Débutant',
            'A2': 'Intermédiaire',
            'B1': 'Avancé',
            'B2': 'Confirmé',
            'C1': 'Maîtrise'
        };
        return labels[niveau] || 'Débutant';
    }

    function getScheduleBg(niveau) {
        const bgs = {
            'A1': '#e0f8f7', 'A2': '#eff6ff', 'B1': '#fdf2f8',
            'B2': '#ecfeff', 'C1': '#fef2f2'
        };
        return bgs[niveau] || '#eff6ff';
    }

    function getScheduleBorder(niveau) {
        const borders = {
            'A1': '#06b6d4', 'A2': '#667eea', 'B1': '#ec4899',
            'B2': '#06b6d4', 'C1': '#dc2626'
        };
        return borders[niveau] || '#667eea';
    }

    function getScheduleTitleColor(niveau) {
        const colors = {
            'A1': '#155e75', 'A2': '#1e40af', 'B1': '#9d174d',
            'B2': '#155e75', 'C1': '#7f1d1d'
        };
        return colors[niveau] || '#1e40af';
    }

    function getScheduleTextColor(niveau) {
        const colors = {
            'A1': '#0e7490', 'A2': '#3b82f6', 'B1': '#be185d',
            'B2': '#0e7490', 'C1': '#991b1b'
        };
        return colors[niveau] || '#3b82f6';
    }

    // Setup card action buttons
    function setupCardActions() {
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.id;
                viewGroupDetails(groupId);
            });
        });

        document.querySelectorAll('.notes-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.id;
                openGroupNotes(groupId);
            });
        });
    }

    // View group details
    async function viewGroupDetails(groupId) {
        try {
            const response = await fetch(`${state.apiBaseUrl}/groupes/${groupId}/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load group details');

            const group = await response.json();

            // Navigate to group detail page or show modal
            window.location.href = `/enseignant/groupes/${groupId}/`;

        } catch (error) {
            console.error('Error loading group details:', error);
            showNotification('❌ Erreur lors du chargement des détails', 'error');
        }
    }

    // Open group notes
    function openGroupNotes(groupId) {
        // Navigate to notes page for this group
        window.location.href = `/enseignant/notes/?groupe=${groupId}`;
    }

    // Filter groups
    function setActiveFilter(activeBtn) {
        elements.filterBtns.forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'white';
            btn.style.color = '#64748b';
            btn.style.borderColor = '#e2e8f0';
        });

        activeBtn.classList.add('active');
        activeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'transparent';
    }

    function filterGroups() {
        const cards = document.querySelectorAll('.group-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const status = card.dataset.status || '';
            const name = card.dataset.name || '';
            const langue = card.dataset.langue || '';
            const niveau = card.dataset.niveau || '';

            const matchesSearch = name.includes(state.searchQuery) ||
                                  langue.includes(state.searchQuery) ||
                                  niveau.includes(state.searchQuery);

            let matchesFilter = true;

            if (state.currentFilter.includes('tous') || state.currentFilter.includes('all')) {
                matchesFilter = true;
            } else if (state.currentFilter.includes('actif')) {
                matchesFilter = status === 'actif';
            } else if (state.currentFilter.includes('terminé') || state.currentFilter.includes('termine')) {
                matchesFilter = status === 'cloture' || status === 'terminee' || status === 'annule';
            } else if (state.currentFilter.includes('anglais')) {
                matchesFilter = langue === 'anglais';
            } else if (state.currentFilter.includes('français') || state.currentFilter.includes('francais')) {
                matchesFilter = langue === 'français' || langue === 'francais';
            }

            if (matchesSearch && matchesFilter) {
                card.style.display = 'block';
                card.style.animation = 'fadeInUp 0.4s ease';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        updateNoResultsMessage(visibleCount);
    }

    function updateNoResultsMessage(count) {
        let noResults = document.querySelector('.no-results');

        if (count === 0) {
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.innerHTML = `
                    <div class="no-results-content" style="text-align: center; padding: 4rem;">
                        <span style="font-size: 4rem;">🔍</span>
                        <h3 style="color: #1e293b; margin: 1rem 0;">Aucun groupe trouvé</h3>
                        <p style="color: #64748b;">Essayez de modifier vos critères de recherche</p>
                    </div>
                `;
                elements.groupsGrid.appendChild(noResults);
            }
        } else if (noResults) {
            noResults.remove();
        }
    }

    function showNoResults() {
        elements.groupsGrid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div class="no-results-content">
                    <span style="font-size: 4rem;">👥</span>
                    <h3 style="color: #1e293b; margin: 1rem 0;">Aucun groupe disponible</h3>
                    <p style="color: #64748b;">Contactez l'administration pour créer des groupes</p>
                </div>
            </div>
        `;
    }

    // Update filter button counts
    function updateFilterCounts(groups) {
        const total = groups.length;
        const actifs = groups.filter(g => (g.statut_groupe || 'Actif') === 'Actif').length;
        const termines = total - actifs;

        elements.filterBtns.forEach(btn => {
            const text = btn.textContent.toLowerCase();
            if (text.includes('tous')) {
                btn.textContent = `Tous (${total})`;
            } else if (text.includes('actif')) {
                btn.textContent = `Actifs (${actifs})`;
            } else if (text.includes('terminé')) {
                btn.textContent = `Terminés (${termines})`;
            }
        });
    }

    // Fallback: render static groups from HTML if API fails
    function renderStaticGroups() {
        // Groups are already in HTML, just setup interactions
        setupCardActions();
        showNotification('⚠️ Mode hors ligne - Données statiques', 'warning');
    }

    // Handle auth error
    function handleAuthError() {
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
        window.location.href = '/login/';
    }

    // Utilities
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
}
function getNiveauLabel(niveau) {
    const labels = {
        'A1': 'Débutant',
        'A2': 'Intermédiaire',
        'B1': 'Avancé',
        'B2': 'Confirmé',
        'C1': 'Maîtrise'
    };
    return labels[niveau] || 'Débutant';
}

function generateAvatars(count, bg) {
    const initials = ['AB', 'SK', 'ML', 'JD', 'AL', 'MK'];
    let html = '';
    const displayCount = Math.min(count, 3);

    for (let i = 0; i < displayCount; i++) {
        html += '<div class="avatar" style="background: ' + bg + ';">' + (initials[i] || 'ST') + '</div>';
    }

    if (count > 3) {
        html += '<div class="avatar" style="background: ' + bg + ';">+' + (count - 3) + '</div>';
    }

    return html;
}

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        const colors = {
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 600;
            animation: slideInRight 0.4s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }, 3000);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .group-card {
            transition: all 0.3s ease;
        }

        .group-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .btn-action {
            transition: all 0.3s;
        }

        .btn-action:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .avatar {
            transition: transform 0.3s;
        }

        .avatar:hover {
            transform: translateY(-3px);
            z-index: 10;
        }

        .progress-fill {
            transition: width 0.5s ease;
        }
    `;

    document.head.appendChild(style);
});