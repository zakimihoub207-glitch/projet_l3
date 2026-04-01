// ressources.js - Educational Resources Management System with JWT Authentication

document.addEventListener('DOMContentLoaded', function() {
    // Helper to get token from both storage types
    function getAuthToken() {
        return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
    }

    // State management
    const state = {
        resources: [],
        currentFilter: 'all',
        searchQuery: '',
        isUploading: false,
        selectedFiles: [],
        apiBaseUrl: '/api',
        authToken: getAuthToken()
    };

    // DOM Elements
    const elements = {
        uploadArea: document.querySelector('.upload-area'),
        uploadBtn: document.querySelector('.upload-btn'),
        searchInput: document.querySelector('.search-box input'),
        filterTabs: document.querySelectorAll('.tab-btn'),
        resourcesGrid: document.querySelector('.resources-grid'),
        fileInput: null
    };

    // Initialize
    init();

    function init() {
        // Check if user is authenticated
        if (!state.authToken) {
            showNotification('❌ Veuillez vous connecter d\'abord', 'error');
            setTimeout(() => {
                window.location.href = '/login/';
            }, 2000);
            return;
        }

        createFileInput();
        setupEventListeners();
        setupDragAndDrop();
        loadResourcesFromDatabase();
    }

    // Create hidden file input
    function createFileInput() {
        elements.fileInput = document.createElement('input');
        elements.fileInput.type = 'file';
        elements.fileInput.multiple = true;
        elements.fileInput.accept = '.pdf,.mp4,.mp3,.doc,.docx,.ppt,.pptx';
        elements.fileInput.style.display = 'none';
        document.body.appendChild(elements.fileInput);
    }

    // Load resources from database
    async function loadResourcesFromDatabase() {
        try {
            const response = await fetch(`${state.apiBaseUrl}/ressources/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('access_token');
                    sessionStorage.removeItem('access_token');
                    window.location.href = '/login/';
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            state.resources = Array.isArray(data) ? data : (data.results || []);
            renderResources(state.resources);
            updateStatsFromData(state.resources);
        } catch (error) {
            console.error('Error loading resources:', error);
            showNotification('❌ Erreur lors du chargement des ressources', 'error');
        }
    }

    // Render resources to grid
    function renderResources(resources) {
        elements.resourcesGrid.innerHTML = '';

        if (resources.length === 0) {
            showNoResults();
            return;
        }

        resources.forEach(resource => {
            const card = createResourceCardFromDB(resource);
            elements.resourcesGrid.appendChild(card);
            setupCardActions(card, resource.id);
        });
    }

    // Create resource card from database data
    function createResourceCardFromDB(resource) {
        const card = document.createElement('div');
        card.className = 'resource-card';
        card.dataset.type = mapTypeToClass(resource.type_ressource);
        card.dataset.title = (resource.titre || '').toLowerCase();
        card.dataset.id = resource.id;

        const typeConfig = getTypeConfig(resource.type_ressource);
        const dateStr = new Date(resource.date_creation || resource.date_disponibilite || Date.now()).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        card.innerHTML = `
            <div class="resource-preview ${typeConfig.class}">
                <span class="file-icon">${typeConfig.icon}</span>
                <span class="file-type-badge">${resource.type_ressource || 'PDF'}</span>
            </div>
            <div class="resource-content">
                <div class="resource-meta">
                    <span>📅 ${dateStr}</span>
                    <span>💾 ${formatFileSize(resource.taille_fichier)}</span>
                </div>
                <h3 class="resource-title">${escapeHtml(resource.titre || 'Sans titre')}</h3>
                <p class="resource-desc">${escapeHtml(resource.description || 'Aucune description')}</p>
                <div class="resource-tags">
                    <span class="tag anglais">Anglais</span>
                    ${resource.niveau ? `<span class="tag a2">${resource.niveau}</span>` : ''}
                    <span class="tag grammaire">${resource.type_ressource || 'Document'}</span>
                </div>
                <div class="resource-footer">
                    <span class="download-count">⬇️ ${resource.nombre_telechargements || 0} téléchargements</span>
                    <div class="resource-actions">
                        <button class="btn-icon download-btn" data-id="${resource.id}" title="Télécharger">⬇️</button>
                        <button class="btn-icon edit-btn" data-id="${resource.id}" title="Modifier">✏️</button>
                        <button class="btn-icon delete-btn" data-id="${resource.id}" title="Supprimer">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    // Map database type to CSS class
    function mapTypeToClass(type) {
        const mapping = {
            'PDF': 'pdf',
            'Video': 'video',
            'Audio': 'audio',
            'PPT': 'ppt',
            'Exercice': 'doc',
            'Lien': 'doc'
        };
        return mapping[type] || 'pdf';
    }

    // Get type configuration
    function getTypeConfig(type) {
        const configs = {
            'PDF': { icon: '📄', class: 'pdf' },
            'Video': { icon: '🎥', class: 'video' },
            'Audio': { icon: '🎵', class: 'audio' },
            'PPT': { icon: '📊', class: 'ppt' },
            'Exercice': { icon: '📝', class: 'doc' },
            'Lien': { icon: '🔗', class: 'doc' }
        };
        return configs[type] || { icon: '📄', class: 'pdf' };
    }

    // Format file size
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners Setup
    function setupEventListeners() {
        elements.uploadBtn.addEventListener('click', () => {
            scrollToUpload();
            highlightUploadArea();
        });

        elements.uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.file-type')) return;
            elements.fileInput.click();
        });

        elements.fileInput.addEventListener('change', handleFileSelect);

        elements.searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.toLowerCase();
            filterResources();
        }, 300));

        elements.filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                setActiveTab(tab);
                state.currentFilter = tab.textContent.toLowerCase();
                filterResources();
            });
        });
    }

    // Drag and Drop Setup
    function setupDragAndDrop() {
        const uploadArea = elements.uploadArea;
        const events = ['dragenter', 'dragover', 'dragleave', 'drop'];

        events.forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => highlightDropZone(uploadArea), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => unhighlightDropZone(uploadArea), false);
        });

        uploadArea.addEventListener('drop', handleDrop, false);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlightDropZone(element) {
        element.classList.add('drag-active');
        element.style.borderColor = '#667eea';
        element.style.background = '#f8fafc';
        element.style.transform = 'scale(1.02)';
    }

    function unhighlightDropZone(element) {
        element.classList.remove('drag-active');
        element.style.borderColor = '#cbd5e1';
        element.style.background = 'white';
        element.style.transform = 'scale(1)';
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    // File Processing with Database Upload
    async function handleFiles(files) {
        if (files.length === 0) return;

        state.selectedFiles = Array.from(files);
        showUploadProgress();

        for (let i = 0; i < state.selectedFiles.length; i++) {
            const file = state.selectedFiles[i];
            try {
                await uploadFileToDatabase(file, i);
            } catch (error) {
                console.error('Upload error:', error);
                showNotification(`❌ ${file.name}: ${error.message}`, 'error');
            }
        }

        finishUpload();
    }

    // Upload single file to database
    async function uploadFileToDatabase(file, index) {
        const formData = new FormData();

        const extension = file.name.split('.').pop().toLowerCase();
        const typeMapping = {
            'pdf': 'PDF', 'mp4': 'Video', 'mp3': 'Audio',
            'doc': 'Exercice', 'docx': 'Exercice',
            'ppt': 'PPT', 'pptx': 'PPT'
        };

        formData.append('fichier', file);
        formData.append('titre', file.name.replace(/\.[^/.]+$/, ""));
        formData.append('description', `Fichier uploadé le ${new Date().toLocaleDateString('fr-FR')}`);
        formData.append('type_ressource', typeMapping[extension] || 'PDF');
        formData.append('visible_etudiants', 'true');

        updateFileProgress(index, 30);

        try {
            const response = await fetch(`${state.apiBaseUrl}/ressources/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`
                    // Don't set Content-Type - browser sets it with boundary for FormData
                },
                body: formData
            });

            // DEBUG: Check if response is JSON
            const contentType = response.headers.get('content-type');
            console.log('Response status:', response.status);
            console.log('Content-Type:', contentType);

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Server returned HTML:', text.substring(0, 500));

                if (response.status === 500) {
                    throw new Error('Erreur serveur (500). Vérifiez la console Django.');
                } else if (response.status === 404) {
                    throw new Error('API non trouvée (404).');
                } else if (response.status === 403) {
                    throw new Error('Accès refusé (403).');
                } else {
                    throw new Error(`Erreur ${response.status}: ${text.substring(0, 100)}`);
                }
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.error || JSON.stringify(data));
            }

            updateFileProgress(index, 100);
            addResourceCardToGrid(data);
            updateStatsFromType(data.type_ressource);
            showNotification(`✅ ${file.name} uploadé avec succès`, 'success');

            return data;

        } catch (error) {
            updateFileProgress(index, 0);
            throw error;
        }
    }

    // Show upload progress UI
    function showUploadProgress() {
        const uploadArea = elements.uploadArea;
        uploadArea.innerHTML = `
            <div class="upload-progress-container">
                <div class="upload-spinner"></div>
                <h3>Téléchargement en cours...</h3>
                <p>${state.selectedFiles.length} fichier(s) en cours d'upload</p>
                <div class="progress-list">
                    ${state.selectedFiles.map((f, i) => `
                        <div class="progress-item" data-index="${i}">
                            <span class="file-name">${f.name}</span>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: 0%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function updateFileProgress(index, percent) {
        const item = document.querySelector(`.progress-item[data-index="${index}"] .progress-bar`);
        if (item) {
            item.style.width = percent + '%';
            item.style.transition = 'width 0.3s ease';
        }
    }

    function finishUpload() {
        setTimeout(() => {
            resetUploadArea();
        }, 1500);
    }

    function resetUploadArea() {
        elements.uploadArea.innerHTML = `
            <div class="upload-icon">📤</div>
            <h3>Glissez-déposez vos fichiers ici</h3>
            <p>ou cliquez pour parcourir votre ordinateur</p>
            <div class="file-types">
                <span class="file-type">📄 PDF</span>
                <span class="file-type">🎥 MP4</span>
                <span class="file-type">🎵 MP3</span>
                <span class="file-type">📝 DOC</span>
                <span class="file-type">📊 PPT</span>
            </div>
        `;
        setupDragAndDrop();
    }

    // Add resource card to grid
    function addResourceCardToGrid(resource) {
        const card = createResourceCardFromDB(resource);
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        elements.resourcesGrid.insertBefore(card, elements.resourcesGrid.firstChild);

        requestAnimationFrame(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });

        setupCardActions(card, resource.id);
    }

    // Setup card actions
    function setupCardActions(card, resourceId) {
        const downloadBtn = card.querySelector('.download-btn');
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadResource(resourceId, downloadBtn);
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(resourceId, card);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDelete(resourceId, card);
            });
        }
    }

    // Download resource
async function downloadResource(resourceId, button) {
    try {
        // Visual feedback
        button.style.transform = 'scale(1.2)';
        setTimeout(() => button.style.transform = 'scale(1)', 200);

        // Method 1: Try fetch with JWT token (more secure)
        const response = await fetch(`${state.apiBaseUrl}/ressources/${resourceId}/download/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.authToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired
                localStorage.removeItem('access_token');
                sessionStorage.removeItem('access_token');
                window.location.href = '/login/';
                return;
            }
            throw new Error(`Download failed: ${response.status}`);
        }

        // Get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'download';
        if (disposition && disposition.includes('filename=')) {
            const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match) {
                filename = match[1].replace(/['"]/g, '');
            }
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);

        // Update counter locally
        const countSpan = button.closest('.resource-footer').querySelector('.download-count');
        const match = countSpan.textContent.match(/(\d+)/);
        if (match) {
            const newCount = parseInt(match[1]) + 1;
            countSpan.textContent = `⬇️ ${newCount} téléchargements`;
        }

        showNotification('📥 Téléchargement démarré', 'success');

    } catch (error) {
        console.error('Download error:', error);
        showNotification('❌ Erreur de téléchargement: ' + error.message, 'error');

        // Fallback: Try opening in new tab with token
        try {
            const token = encodeURIComponent(state.authToken);
            window.open(`${state.apiBaseUrl}/ressources/${resourceId}/download/?token=${token}`, '_blank');
            showNotification('📥 Tentative de téléchargement dans nouvel onglet', 'info');
        } catch (e) {
            showNotification('❌ Impossible de télécharger le fichier', 'error');
        }
    }
}

    // Delete resource
    async function confirmDelete(resourceId, card) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette ressource ?')) return;

        try {
            const response = await fetch(`${state.apiBaseUrl}/ressources/${resourceId}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login/';
                    return;
                }
                throw new Error('Delete failed');
            }

            card.style.transform = 'scale(0.9) rotate(5deg)';
            card.style.opacity = '0';

            setTimeout(() => {
                card.remove();
                state.resources = state.resources.filter(r => r.id !== resourceId);
                updateStatsFromData(state.resources);
            }, 300);

            showNotification('🗑️ Ressource supprimée', 'warning');
        } catch (error) {
            showNotification('❌ Erreur lors de la suppression', 'error');
        }
    }

    // Edit resource
    async function openEditModal(resourceId, card) {
        const resource = state.resources.find(r => r.id === resourceId);
        if (!resource) return;

        const modal = document.createElement('div');
        modal.className = 'edit-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h2>Modifier la Ressource</h2>
                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" class="edit-title" value="${escapeHtml(resource.titre || '')}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea class="edit-desc">${escapeHtml(resource.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Niveau</label>
                        <select class="edit-niveau">
                            <option value="">-- Sélectionner --</option>
                            <option value="A1" ${resource.niveau === 'A1' ? 'selected' : ''}>A1</option>
                            <option value="A2" ${resource.niveau === 'A2' ? 'selected' : ''}>A2</option>
                            <option value="B1" ${resource.niveau === 'B1' ? 'selected' : ''}>B1</option>
                            <option value="B2" ${resource.niveau === 'B2' ? 'selected' : ''}>B2</option>
                            <option value="C1" ${resource.niveau === 'C1' ? 'selected' : ''}>C1</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary cancel-btn">Annuler</button>
                        <button class="btn-primary save-btn">Sauvegarder</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

        modal.querySelector('.save-btn').addEventListener('click', async () => {
            const newTitle = modal.querySelector('.edit-title').value;
            const newDesc = modal.querySelector('.edit-desc').value;
            const newNiveau = modal.querySelector('.edit-niveau').value;

            try {
                const response = await fetch(`${state.apiBaseUrl}/ressources/${resourceId}/`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titre: newTitle,
                        description: newDesc,
                        niveau: newNiveau
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        window.location.href = '/login/';
                        return;
                    }
                    throw new Error('Update failed');
                }

                const updated = await response.json();

                const index = state.resources.findIndex(r => r.id === resourceId);
                if (index !== -1) state.resources[index] = updated;

                card.querySelector('.resource-title').textContent = newTitle;
                card.querySelector('.resource-desc').textContent = newDesc || 'Aucune description';

                modal.remove();
                showNotification('✅ Modifications sauvegardées', 'success');
            } catch (error) {
                showNotification('❌ Erreur lors de la sauvegarde', 'error');
            }
        });

        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) modal.remove();
        });
    }

    // Filtering
    function setActiveTab(activeTab) {
        elements.filterTabs.forEach(tab => {
            tab.classList.remove('active');
            tab.style.background = 'transparent';
            tab.style.color = '#64748b';
        });

        activeTab.classList.add('active');
        activeTab.style.background = '#f1f5f9';
        activeTab.style.color = '#667eea';
    }

    function filterResources() {
        const cards = document.querySelectorAll('.resource-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const type = card.dataset.type || '';
            const title = card.dataset.title || '';
            const matchesSearch = title.includes(state.searchQuery);
            const matchesFilter = state.currentFilter === 'tous' ||
                                  state.currentFilter === 'all' ||
                                  type.includes(state.currentFilter) ||
                                  (state.currentFilter === 'documents' && ['pdf', 'doc'].includes(type)) ||
                                  (state.currentFilter === 'vidéos' && type === 'video') ||
                                  (state.currentFilter === 'audio' && type === 'audio') ||
                                  (state.currentFilter === 'exercices' && type === 'doc');

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
                    <div class="no-results-content">
                        <span class="icon">🔍</span>
                        <h3>Aucune ressource trouvée</h3>
                        <p>Essayez de modifier vos critères de recherche</p>
                    </div>
                `;
                elements.resourcesGrid.appendChild(noResults);
            }
        } else if (noResults) {
            noResults.remove();
        }
    }

    function showNoResults() {
        elements.resourcesGrid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div class="no-results-content">
                    <span class="icon" style="font-size: 4rem;">📚</span>
                    <h3>Aucune ressource disponible</h3>
                    <p>Commencez par uploader votre première ressource</p>
                </div>
            </div>
        `;
    }

    // Update stats
    function updateStatsFromData(resources) {
        const stats = {
            pdf: resources.filter(r => r.type_ressource === 'PDF').length,
            video: resources.filter(r => r.type_ressource === 'Video').length,
            audio: resources.filter(r => r.type_ressource === 'Audio').length,
            downloads: resources.reduce((sum, r) => sum + (r.nombre_telechargements || 0), 0)
        };

        const statItems = document.querySelectorAll('.stat-item h4');
        if (statItems[0]) animateCounter(statItems[0], stats.pdf);
        if (statItems[1]) animateCounter(statItems[1], stats.video);
        if (statItems[2]) animateCounter(statItems[2], stats.audio);
        if (statItems[3]) animateCounter(statItems[3], stats.downloads);
    }

    function updateStatsFromType(type) {
        const mapping = { 'PDF': 0, 'Video': 1, 'Audio': 2 };
        const index = mapping[type];
        if (index !== undefined) {
            const counter = document.querySelectorAll('.stat-item h4')[index];
            if (counter) animateCounter(counter, parseInt(counter.textContent) + 1);
        }
    }

    function animateCounter(element, targetValue) {
        element.textContent = targetValue;
        element.style.transform = 'scale(1.3)';
        element.style.color = '#667eea';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            element.style.color = '#1e293b';
        }, 300);
    }

    // Utilities
    function scrollToUpload() {
        elements.uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function highlightUploadArea() {
        elements.uploadArea.style.animation = 'pulse 1s ease 2';
        setTimeout(() => {
            elements.uploadArea.style.animation = '';
        }, 2000);
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

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
            50% { transform: scale(1.02); box-shadow: 0 0 0 20px rgba(102, 126, 234, 0); }
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

        .upload-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #e2e8f0;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }

        .progress-list {
            margin-top: 1.5rem;
            text-align: left;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        }

        .progress-item {
            margin-bottom: 1rem;
        }

        .file-name {
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 0.5rem;
            display: block;
        }

        .progress-bar-container {
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .edit-modal .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        }

        .edit-modal .modal-content {
            background: white;
            padding: 2rem;
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            animation: modalPop 0.3s ease;
        }

        @keyframes modalPop {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }

        .edit-modal h2 {
            margin-bottom: 1.5rem;
            color: #1e293b;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #64748b;
            font-weight: 600;
            font-size: 0.875rem;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-family: inherit;
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .modal-actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            margin-top: 1.5rem;
        }

        .btn-secondary {
            padding: 0.75rem 1.5rem;
            border: 2px solid #e2e8f0;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: #64748b;
            transition: all 0.3s;
        }

        .btn-secondary:hover {
            border-color: #667eea;
            color: #667eea;
        }

        .btn-primary {
            padding: 0.75rem 1.5rem;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.3s;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
    `;

    document.head.appendChild(style);
});