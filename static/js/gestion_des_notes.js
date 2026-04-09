/**
 * Grade Management System - JWT Authentication Version
 * Compatible avec Django REST Framework + SimpleJWT
 * File: static/js/gestion_des_notes.js
 */

class GradeManager {
    constructor() {
        this.apiBaseUrl = '/api';

        // State
        this.students = [];
        this.evaluations = [];
        this.notes = [];
        this.currentGroup = null;

        // Weights from parametre_systeme table
        this.weights = {
            written:       0.30,
            oral:          0.40,
            comprehension: 0.20,
            participation: 0.10
        };

        this.elements = {};
        this.init();
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadData();
        this.loadSystemParameters();
    }

    cacheElements() {
        this.elements = {
            studentCount:     document.getElementById('studentCount'),
            currentLevel:     document.getElementById('currentLevel'),
            currentGroupName: document.getElementById('currentGroupName'),
            searchInput:      document.getElementById('searchInput'),
            filterEval:       document.getElementById('filterEval'),
            filterLevel:      document.getElementById('filterLevel'),
            btnNewEval:       document.getElementById('btnNewEval'),
            btnImport:        document.getElementById('btnImport'),
            btnExport:        document.getElementById('btnExport'),
            btnPrint:         document.getElementById('btnPrint'),
            evaluationsGrid:  document.getElementById('evaluationsGrid'),
            studentsTableBody: document.getElementById('studentsTableBody'),
        };
    }

    bindEvents() {
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.handleSearch(e.target.value), 300);
        });

        this.elements.filterEval?.addEventListener('change', () => this.applyFilters());
        this.elements.filterLevel?.addEventListener('change', () => this.applyFilters());

        this.elements.btnNewEval?.addEventListener('click', () => this.openNewEvaluationModal());
        this.elements.btnImport?.addEventListener('click',  () => this.handleImport());
        this.elements.btnExport?.addEventListener('click',  () => this.handleExport());
        this.elements.btnPrint?.addEventListener('click',   () => window.print());
    }

    // ============================================================
    // JWT HELPERS — remplace tout le système session
    // ============================================================

    getToken() {
        // Cherche dans localStorage d'abord, sinon sessionStorage
        return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
    }

    // Headers JWT pour chaque requête — PAS de CSRF, PAS de session cookies
    authHeaders() {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // ============================================================
    // API COMMUNICATION — JWT uniquement, pas de redirection auto
    // ============================================================

    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;

        const fetchOptions = {
            ...options,
            headers: {
                ...this.authHeaders(),
                ...options.headers,
            },
            // PAS de credentials: 'same-origin' — on utilise JWT pas les cookies
        };

        try {
            const response = await fetch(url, fetchOptions);

            // ✅ FIX PRINCIPAL : Plus de redirection sur 401/403
            // On retourne juste l'erreur et on affiche un message dans l'UI
            if (response.status === 401) {
                console.warn('JWT expiré ou invalide pour:', endpoint);
                return { error: 'JWT_INVALID', message: 'Token invalide. Reconnectez-vous.' };
            }

            if (response.status === 403) {
                console.warn('Permission refusée pour:', endpoint);
                return { error: 'FORBIDDEN', message: 'Accès non autorisé.' };
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                return { error: 'API_ERROR', message: `Erreur ${response.status}` };
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {
            console.error('Network Error:', error);
            return { error: 'NETWORK_ERROR', message: 'Serveur inaccessible. Vérifiez que Django est lancé.' };
        }
    }

    // ============================================================
    // DATA LOADING
    // ============================================================

    async loadData() {
        this.showLoading();

        const [evaluationsResult, studentsResult] = await Promise.all([
            this.loadEvaluations(),
            this.loadStudents()
        ]);

        // ✅ FIX : Afficher l'erreur dans l'UI sans redirection
        if (evaluationsResult?.error) {
            this.showError('evaluations', evaluationsResult.message);
        } else {
            this.evaluations = evaluationsResult;
            this.renderEvaluations();
        }

        if (studentsResult?.error) {
            this.showError('students', studentsResult.message);
        } else {
            this.students = studentsResult;
            this.renderStudents();
            await this.loadAllGrades();
        }

        this.updateHeaderInfo();
    }

    async loadEvaluations() {
        const urlParams  = new URLSearchParams(window.location.search);
        const groupeId   = urlParams.get('groupe') || window.DJANGO_CONTEXT?.groupId;

        let endpoint = '/evaluations/';
        if (groupeId) endpoint += `?groupe=${groupeId}`;

        const result = await this.apiRequest(endpoint);
        if (result?.error) return result;

        return result.map(ev => ({
            id:          ev.id,
            titre:       ev.titre,
            type:        this.mapApiTypeToFrontend(ev.type),
            typeLabel:   ev.type,
            date:        ev.date_evaluation,
            ponderation: ev.ponderation,
            noteMax:     ev.note_max,
            nombreNotes: ev.nombre_notes || 0,
            groupe:      ev.groupe,
        }));
    }

    async loadStudents() {
        const urlParams = new URLSearchParams(window.location.search);
        const groupeId  = urlParams.get('groupe') || window.DJANGO_CONTEXT?.groupId;

        let endpoint = '/etudiants/';
        if (groupeId) endpoint += `?groupe=${groupeId}`;

        const result = await this.apiRequest(endpoint);
        if (result?.error) return result;

        return result.map(s => ({
            id:            s.id,
            nom:           s.user?.nom_complet || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
            email:         s.user?.email,
            niveau:        s.niveau_actuel,
            groupe:        s.groupe_nom || s.groupe,
            groupeId:      s.groupe,
            tauxAssiduite: s.taux_assiduité,
        }));
    }

    async loadAllGrades() {
        for (const student of this.students) {
            const notes = await this.loadStudentNotes(student.id);
            this.applyNotesToRow(student.id, notes);
        }
    }

    async loadStudentNotes(studentId) {
        const result = await this.apiRequest(`/notes/?etudiant=${studentId}`);
        if (result?.error) return [];

        return result.map(n => ({
            id:             n.id,
            evaluationId:   n.evaluation,
            evaluationTitre: n.evaluation_titre,
            note:           parseFloat(n.note_obtenue),
            max:            parseFloat(n.note_max),
            pourcentage:    n.pourcentage,
            niveau:         n.niveau_attribue,
        }));
    }

    async loadSystemParameters() {
        const result = await this.apiRequest('/parametres/');
        if (result?.error) return;

        result.forEach(param => {
            const value = parseFloat(param.valeur) / 100;
            switch (param.nom_parametre) {
                case 'PONDERATION_ECRIT':          this.weights.written       = value; break;
                case 'PONDERATION_ORAL':           this.weights.oral          = value; break;
                case 'PONDERATION_COMPREHENSION':  this.weights.comprehension = value; break;
                case 'PONDERATION_PARTICIPATION':  this.weights.participation = value; break;
            }
        });

        this.updateFormulaDisplay();
    }

    // ============================================================
    // RENDERING
    // ============================================================

    showLoading() {
        if (this.elements.evaluationsGrid) {
            this.elements.evaluationsGrid.innerHTML = `
                <div class="eval-card" style="grid-column:1/-1; text-align:center; padding:40px;">
                    <div style="font-size:2rem; margin-bottom:10px;">⏳</div>
                    <p>Chargement des évaluations...</p>
                </div>`;
        }
        if (this.elements.studentsTableBody) {
            this.elements.studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:40px;">
                        <div style="font-size:2rem; margin-bottom:10px;">⏳</div>
                        <p>Chargement des étudiants...</p>
                    </td>
                </tr>`;
        }
    }

    // ✅ FIX : showError affiche le problème dans l'UI sans rediriger
    showError(section, message) {
        const isNetworkError = message?.includes('inaccessible') || message?.includes('NETWORK');
        const icon  = isNetworkError ? '🔌' : '⚠️';
        const hint  = isNetworkError
            ? 'Vérifiez que Django tourne sur le port 8000.'
            : message;

        const content = `
            <div style="text-align:center; padding:40px; color:#dc2626;">
                <div style="font-size:2.5rem; margin-bottom:12px;">${icon}</div>
                <p style="font-weight:600; margin-bottom:8px;">${hint}</p>
                <button onclick="window.location.reload()"
                    style="margin-top:16px; padding:10px 20px; background:#667eea;
                           color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600;">
                    Réessayer
                </button>
            </div>`;

        if (section === 'evaluations' && this.elements.evaluationsGrid) {
            this.elements.evaluationsGrid.innerHTML =
                `<div class="eval-card" style="grid-column:1/-1;">${content}</div>`;
        }
        if (section === 'students' && this.elements.studentsTableBody) {
            this.elements.studentsTableBody.innerHTML =
                `<tr><td colspan="8">${content}</td></tr>`;
        }
    }

    renderEvaluations() {
        if (!this.elements.evaluationsGrid) return;

        if (!this.evaluations.length) {
            this.elements.evaluationsGrid.innerHTML = `
                <div class="eval-card" style="grid-column:1/-1; text-align:center; padding:40px;">
                    <p>Aucune évaluation trouvée</p>
                    <button onclick="window.gradeManager.openNewEvaluationModal()"
                            style="margin-top:15px; padding:8px 16px; background:#667eea;
                                   color:white; border:none; border-radius:6px; cursor:pointer;">
                        + Créer une évaluation
                    </button>
                </div>`;
            return;
        }

        const typeColors = {
            written:       { bg: '#dbeafe', color: '#1e40af' },
            oral:          { bg: '#dcfce7', color: '#166534' },
            comprehension: { bg: '#f3e8ff', color: '#7c3aed' },
            participation: { bg: '#ffedd5', color: '#9a3412' },
        };

        this.elements.evaluationsGrid.innerHTML = this.evaluations.map(ev => {
            const colors = typeColors[ev.type] || typeColors.written;
            return `
                <div class="eval-card" data-type="${ev.type}" data-id="${ev.id}"
                     style="background:white; border-radius:16px; padding:24px;
                            box-shadow:0 2px 4px rgba(0,0,0,0.05); border:2px solid transparent;
                            cursor:pointer; transition:all 0.3s;"
                     onmouseover="this.style.borderColor='#667eea';this.style.transform='translateY(-4px)'"
                     onmouseout="this.style.borderColor='transparent';this.style.transform='none'">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <span style="padding:6px 12px; border-radius:50px; font-size:0.75rem;
                                     font-weight:700; text-transform:uppercase;
                                     background:${colors.bg}; color:${colors.color};">
                            ${ev.typeLabel}
                        </span>
                        <span style="color:#94a3b8; font-size:0.875rem;">${this.formatDate(ev.date)}</span>
                    </div>
                    <h4 style="font-size:1.1rem; color:#1e293b; font-weight:700; margin-bottom:8px;">${ev.titre}</h4>
                    <p style="color:#64748b; font-size:0.875rem; margin-bottom:16px;">
                        Pondération: ${ev.ponderation}% • ${ev.nombreNotes} participants
                    </p>
                    <div style="display:flex; gap:32px; padding-top:16px; border-top:1px solid #e2e8f0;">
                        <div style="text-align:center;">
                            <div style="font-size:1.5rem; font-weight:800; color:#1e293b;">${ev.noteMax}</div>
                            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Max</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:1.5rem; font-weight:800; color:#1e293b;">${ev.nombreNotes}</div>
                            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase;">Notes</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        this.elements.evaluationsGrid.querySelectorAll('.eval-card').forEach(card => {
            card.addEventListener('click', () => this.openEvaluationDetail(card.dataset.id));
        });
    }

    renderStudents() {
        if (!this.elements.studentsTableBody) return;

        if (!this.students.length) {
            this.elements.studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:40px;">
                        Aucun étudiant trouvé dans ce groupe
                    </td>
                </tr>`;
            return;
        }

        this.elements.studentsTableBody.innerHTML = this.students.map(s => {
            const initials = this.getInitials(s.nom);
            return `
                <tr data-student-id="${s.id}" data-level="${s.niveau}"
                    style="transition:background 0.2s;"
                    onmouseover="this.style.background='#f8fafc'"
                    onmouseout="this.style.background='transparent'">
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <div style="display:flex; align-items:center; gap:16px;">
                            <div style="width:45px; height:45px; border-radius:50%;
                                        background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                                        display:flex; align-items:center; justify-content:center;
                                        color:white; font-weight:700; font-size:0.875rem;">
                                ${initials}
                            </div>
                            <div>
                                <h4 style="font-size:0.95rem; font-weight:600; color:#1e293b; margin-bottom:4px;">
                                    ${s.nom}
                                </h4>
                                <span style="font-size:0.8rem; color:#64748b;">
                                    ID: ETU${String(s.id).padStart(3, '0')}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <input type="number" class="grade-input" data-student="${s.id}"
                               data-type="written" data-weight="${this.weights.written}"
                               min="0" max="20" step="0.5"
                               style="width:70px; padding:12px; border:2px solid #e2e8f0;
                                      border-radius:10px; text-align:center; font-size:1rem; font-weight:700;">
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <input type="number" class="grade-input" data-student="${s.id}"
                               data-type="oral" data-weight="${this.weights.oral}"
                               min="0" max="20" step="0.5"
                               style="width:70px; padding:12px; border:2px solid #e2e8f0;
                                      border-radius:10px; text-align:center; font-size:1rem; font-weight:700;">
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <input type="number" class="grade-input" data-student="${s.id}"
                               data-type="comprehension" data-weight="${this.weights.comprehension}"
                               min="0" max="20" step="0.5"
                               style="width:70px; padding:12px; border:2px solid #e2e8f0;
                                      border-radius:10px; text-align:center; font-size:1rem; font-weight:700;">
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <input type="number" class="grade-input" data-student="${s.id}"
                               data-type="participation" data-weight="${this.weights.participation}"
                               min="0" max="20" step="0.5"
                               style="width:70px; padding:12px; border:2px solid #e2e8f0;
                                      border-radius:10px; text-align:center; font-size:1rem; font-weight:700;">
                    </td>
                    <td class="average-cell" style="padding:20px 16px; border-bottom:1px solid #e2e8f0;
                                                    font-weight:800; font-size:1.25rem; color:#1e293b;">
                        -
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <span class="level-badge" style="padding:8px 16px; border-radius:50px;
                                                          font-size:0.875rem; font-weight:700;">
                            ${s.niveau}
                        </span>
                    </td>
                    <td style="padding:20px 16px; border-bottom:1px solid #e2e8f0;">
                        <div style="display:flex; gap:8px;">
                            <button onclick="window.gradeManager.openCommentModal(${s.id})"
                                    style="width:36px; height:36px; border:none; background:#f1f5f9;
                                           border-radius:8px; cursor:pointer;" title="Commentaire">💬</button>
                            <button onclick="window.gradeManager.viewStudentDetail(${s.id})"
                                    style="width:36px; height:36px; border:none; background:#f1f5f9;
                                           border-radius:8px; cursor:pointer;" title="Détails">👁️</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        this.bindGradeInputs();
    }

    bindGradeInputs() {
        const inputs = this.elements.studentsTableBody.querySelectorAll('.grade-input');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => this.handleGradeChange(e));
            input.addEventListener('input',  (e) => this.validateInput(e.target));
        });
    }

    applyNotesToRow(studentId, notes) {
        const row = this.elements.studentsTableBody.querySelector(`[data-student-id="${studentId}"]`);
        if (!row) return;

        notes.forEach(note => {
            const type  = this.mapEvaluationTitleToType(note.evaluationTitre);
            const input = row.querySelector(`[data-type="${type}"]`);
            if (input) {
                input.value = note.note;
                input.dataset.noteId = note.id;
            }
        });

        this.calculateRowAverage(row);
    }

    // ============================================================
    // GRADE CALCULATION & SAVING
    // ============================================================

    validateInput(input) {
        let value = parseFloat(input.value);
        if (isNaN(value)) value = 0;
        if (value < 0)  value = 0;
        if (value > 20) value = 20;
        input.value = value;
    }

    handleGradeChange(e) {
        const input = e.target;
        const row   = input.closest('tr');

        input.style.borderColor = '#f59e0b';
        input.style.background  = '#fffbeb';

        this.calculateRowAverage(row);

        clearTimeout(input.saveTimeout);
        input.saveTimeout = setTimeout(() => this.saveGrade(input, row), 1000);
    }

    calculateRowAverage(row) {
        const inputs = row.querySelectorAll('.grade-input');
        let total = 0, totalWeight = 0;

        inputs.forEach(input => {
            const value  = parseFloat(input.value) || 0;
            const weight = parseFloat(input.dataset.weight) || 0;
            total       += value * weight;
            totalWeight += weight;
        });

        const average = totalWeight > 0 ? total / totalWeight : 0;
        const rounded = Math.round(average * 10) / 10;

        const averageCell = row.querySelector('.average-cell');
        averageCell.textContent = rounded.toFixed(1);

        let color = '#dc2626';
        if (rounded >= 16) color = '#059669';
        else if (rounded >= 14) color = '#0284c7';
        else if (rounded >= 10) color = '#d97706';
        averageCell.style.color = color;

        const newLevel = this.determineLevel(rounded);
        const badge    = row.querySelector('.level-badge');
        badge.textContent = newLevel;

        const levelColors = {
            'A1': { bg: '#fee2e2', color: '#991b1b' },
            'A2': { bg: '#ffedd5', color: '#9a3412' },
            'B1': { bg: '#fef3c7', color: '#92400e' },
            'B2': { bg: '#d1fae5', color: '#166534' },
            'C1': { bg: '#dbeafe', color: '#1e40af' },
        };
        badge.style.background = levelColors[newLevel].bg;
        badge.style.color      = levelColors[newLevel].color;
        row.dataset.level      = newLevel;

        return rounded;
    }

    async saveGrade(input, row) {
        const studentId  = input.dataset.student;
        const type       = input.dataset.type;
        const value      = parseFloat(input.value);
        const noteId     = input.dataset.noteId;

        const evaluation = this.evaluations.find(e => e.type === type);
        if (!evaluation) {
            this.showToast('Aucune évaluation configurée pour ce type', 'error');
            return;
        }

        const payload = {
            etudiant:    parseInt(studentId),
            evaluation:  evaluation.id,
            note_obtenue: value,
            note_max:    20,
        };

        let result;
        if (noteId) {
            result = await this.apiRequest(`/notes/${noteId}/`, {
                method: 'PUT',
                body:   JSON.stringify(payload),
            });
        } else {
            result = await this.apiRequest('/notes/', {
                method: 'POST',
                body:   JSON.stringify(payload),
            });
            if (!result?.error) {
                input.dataset.noteId = result.id;
            }
        }

        if (result?.error) {
            this.showToast('Erreur: ' + result.message, 'error');
            input.style.borderColor = '#ef4444';
            input.style.background  = '#fef2f2';
            return;
        }

        // ✅ Feedback visuel succès
        input.style.borderColor = '#22c55e';
        input.style.background  = '#f0fdf4';
        setTimeout(() => {
            input.style.borderColor = '#e2e8f0';
            input.style.background  = 'transparent';
        }, 1000);

        this.showToast('Note sauvegardée ✓', 'success');
    }

    // ============================================================
    // FILTERS & SEARCH
    // ============================================================

    handleSearch(query) {
        const term = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        this.elements.studentsTableBody.querySelectorAll('tr').forEach(row => {
            const name = row.querySelector('h4')?.textContent.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            row.style.display = name.includes(term) ? '' : 'none';
        });
    }

    applyFilters() {
        const evalType = this.elements.filterEval?.value  || 'all';
        const level    = this.elements.filterLevel?.value || 'all';

        this.elements.evaluationsGrid?.querySelectorAll('.eval-card').forEach(card => {
            card.style.display = (evalType === 'all' || card.dataset.type === evalType) ? '' : 'none';
        });

        this.elements.studentsTableBody?.querySelectorAll('tr').forEach(row => {
            row.style.display = (level === 'all' || row.dataset.level === level) ? '' : 'none';
        });
    }

    // ============================================================
    // MODALS
    // ============================================================

    openNewEvaluationModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0;
                        background:rgba(0,0,0,0.5); display:flex; align-items:center;
                        justify-content:center; z-index:1000;"
                 onclick="if(event.target===this)this.remove()">
                <div style="background:white; border-radius:20px; padding:32px;
                            width:90%; max-width:500px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
                    <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:24px; color:#1e293b;">
                        Nouvelle Évaluation
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
                        <input type="text" id="newEvalTitle" placeholder="Titre de l'évaluation"
                               style="padding:12px 16px; border:2px solid #e2e8f0; border-radius:12px; font-size:1rem;">
                        <select id="newEvalType"
                                style="padding:12px 16px; border:2px solid #e2e8f0; border-radius:12px; font-size:1rem;">
                            <option value="">Type d'évaluation</option>
                            <option value="Ecrit">Devoir Écrit</option>
                            <option value="Oral">Expression Orale</option>
                            <option value="Comprehension">Compréhension</option>
                            <option value="Participation">Participation</option>
                        </select>
                        <input type="number" id="newEvalWeight" placeholder="Pondération (%)" min="0" max="100"
                               style="padding:12px 16px; border:2px solid #e2e8f0; border-radius:12px; font-size:1rem;">
                        <input type="date" id="newEvalDate"
                               style="padding:12px 16px; border:2px solid #e2e8f0; border-radius:12px; font-size:1rem;">
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="this.closest('[style*=fixed]').remove()"
                                style="padding:12px 24px; border-radius:10px; border:none;
                                       background:#f1f5f9; color:#64748b; font-weight:600; cursor:pointer;">
                            Annuler
                        </button>
                        <button id="btnCreateEval"
                                style="padding:12px 24px; border-radius:10px; border:none;
                                       background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                                       color:white; font-weight:600; cursor:pointer;">
                            Créer
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        modal.querySelector('#btnCreateEval').addEventListener('click', async () => {
            const data = {
                titre:           document.getElementById('newEvalTitle').value,
                type:            document.getElementById('newEvalType').value,
                ponderation:     parseFloat(document.getElementById('newEvalWeight').value),
                date_evaluation: document.getElementById('newEvalDate').value,
                groupe:          this.currentGroup || window.DJANGO_CONTEXT?.groupId || 1,
            };

            if (!data.titre || !data.type || !data.ponderation || !data.date_evaluation) {
                this.showToast('Veuillez remplir tous les champs', 'error');
                return;
            }

            const result = await this.apiRequest('/evaluations/', {
                method: 'POST',
                body:   JSON.stringify(data),
            });

            if (result?.error) {
                this.showToast('Erreur: ' + result.message, 'error');
                return;
            }

            modal.remove();
            this.showToast('Évaluation créée ✓', 'success');
            await this.loadData();
        });
    }

    openCommentModal(studentId) {
        const student = this.students.find(s => s.id == studentId);
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0;
                        background:rgba(0,0,0,0.5); display:flex; align-items:center;
                        justify-content:center; z-index:1000;"
                 onclick="if(event.target===this)this.remove()">
                <div style="background:white; border-radius:20px; padding:32px; width:90%; max-width:500px;">
                    <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:16px; color:#1e293b;">
                        Commentaire pour ${student?.nom || ''}
                    </h3>
                    <textarea id="commentText" rows="4" placeholder="Votre commentaire..."
                              style="width:100%; padding:12px; border:2px solid #e2e8f0;
                                     border-radius:12px; font-size:1rem; margin-bottom:24px; resize:vertical;">
                    </textarea>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="this.closest('[style*=fixed]').remove()"
                                style="padding:12px 24px; border-radius:10px; border:none;
                                       background:#f1f5f9; color:#64748b; font-weight:600; cursor:pointer;">
                            Annuler
                        </button>
                        <button onclick="window.gradeManager.saveComment(${studentId})"
                                style="padding:12px 24px; border-radius:10px; border:none;
                                       background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                                       color:white; font-weight:600; cursor:pointer;">
                            Enregistrer
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    saveComment(studentId) {
        const text = document.getElementById('commentText')?.value || '';
        console.log('Comment for student', studentId, ':', text);
        document.querySelector('[style*="position:fixed"]')?.remove();
        this.showToast('Commentaire enregistré ✓', 'success');
    }

    viewStudentDetail(studentId) {
        window.location.href = `/secretariat/etudiants/${studentId}/`;
    }

    openEvaluationDetail(evalId) {
        console.log('Evaluation detail:', evalId);
    }

    // ============================================================
    // IMPORT / EXPORT
    // ============================================================

    handleExport() {
        const data = {
            date_export: new Date().toISOString(),
            etudiants: this.students.map(s => {
                const row    = this.elements.studentsTableBody.querySelector(`[data-student-id="${s.id}"]`);
                const inputs = row?.querySelectorAll('.grade-input') || [];
                return {
                    id:      s.id,
                    nom:     s.nom,
                    notes:   Array.from(inputs).map(i => ({ type: i.dataset.type, note: parseFloat(i.value) || null })),
                    moyenne: row?.querySelector('.average-cell')?.textContent || '-',
                };
            }),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `notes_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Export réussi ✓', 'success');
    }

    handleImport() {
        const input   = document.createElement('input');
        input.type    = 'file';
        input.accept  = '.json,.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                this.showToast(`Import de ${data.etudiants?.length || 0} étudiants`, 'success');
            } catch (error) {
                this.showToast('Erreur d\'import: ' + error.message, 'error');
            }
        };
        input.click();
    }

    // ============================================================
    // UTILITY
    // ============================================================

    mapApiTypeToFrontend(apiType) {
        const map = {
            'Ecrit':         'written',
            'Oral':          'oral',
            'Comprehension': 'comprehension',
            'Participation': 'participation',
        };
        return map[apiType] || apiType.toLowerCase();
    }

    mapEvaluationTitleToType(title) {
        if (!title) return 'written';
        const lower = title.toLowerCase();
        if (lower.includes('ecrit') || lower.includes('grammar'))       return 'written';
        if (lower.includes('oral') || lower.includes('presentation'))   return 'oral';
        if (lower.includes('comprehension') || lower.includes('listen')) return 'comprehension';
        if (lower.includes('participation'))                             return 'participation';
        return 'written';
    }

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    determineLevel(average) {
        if (average >= 16) return 'C1';
        if (average >= 13) return 'B2';
        if (average >= 10) return 'B1';
        if (average >= 5)  return 'A2';
        return 'A1';
    }

    updateHeaderInfo() {
        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = this.students.length;
        }
        if (this.students[0] && this.elements.currentLevel) {
            this.elements.currentLevel.textContent = `Niveau ${this.students[0].niveau}`;
        }
    }

    updateFormulaDisplay() {
        const formula = document.querySelector('.formula');
        if (formula) {
            formula.textContent =
                `Moyenne = (Écrit×${Math.round(this.weights.written*100)}% + ` +
                `Oral×${Math.round(this.weights.oral*100)}% + ` +
                `Compréhension×${Math.round(this.weights.comprehension*100)}% + ` +
                `Participation×${Math.round(this.weights.participation*100)}%)`;
        }
    }

    // ============================================================
    // TOAST
    // ============================================================

    showToast(message, type = 'info', duration = 3000) {
        document.querySelector('.toast-notification')?.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        const colors = { success: '#059669', error: '#dc2626', warning: '#d97706', info: '#0284c7' };
        const icons  = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

        toast.style.cssText = `
            position:fixed; bottom:24px; right:24px;
            padding:16px 24px; border-radius:12px;
            background:${colors[type] || colors.info};
            color:white; font-weight:500;
            box-shadow:0 10px 30px rgba(0,0,0,0.3);
            z-index:10000; transform:translateX(100%);
            opacity:0; transition:all 0.3s ease;
        `;
        toast.innerHTML = `<span style="margin-right:8px;">${icons[type]}</span>${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity   = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity   = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.gradeManager = new GradeManager();
});