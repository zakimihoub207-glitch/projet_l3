// absences.js - Attendance Management System

document.addEventListener('DOMContentLoaded', function() {
    // Helper to get JWT token
    function getAuthToken() {
        return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
    }

    // State management
    const state = {
        students: [],
        attendance: {},
        sessionId: null,
        groupeId: null,
        apiBaseUrl: '/api',
        authToken: getAuthToken(),
        stats: {
            present: 0,
            absent: 0,
            late: 0,
            justified: 0
        }
    };

    // DOM Elements
    const elements = {
        studentList: document.getElementById('studentList'),
        alertContainer: document.getElementById('alertContainer'),
        totalStudents: document.getElementById('totalStudents'),
        groupName: document.getElementById('groupName'),
        sessionDetails: document.getElementById('sessionDetails'),
        currentDay: document.getElementById('currentDay'),
        currentMonth: document.getElementById('currentMonth'),
        currentWeekday: document.getElementById('currentWeekday'),
        currentWeek: document.getElementById('currentWeek'),
        statCards: document.querySelectorAll('.stat-card')
    };

    // Initialize
    init();

    function init() {
        if (!state.authToken) {
            showNotification('❌ Veuillez vous connecter', 'error');
            setTimeout(() => window.location.href = '/login/', 2000);
            return;
        }

        setCurrentDate();
        loadSessionData();
        setupEventListeners();
    }

    // Set current date
    function setCurrentDate() {
        const now = new Date();
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

        elements.currentDay.textContent = now.getDate();
        elements.currentMonth.textContent = months[now.getMonth()];
        elements.currentWeekday.textContent = days[now.getDay()];

        // Calculate week number
        const start = new Date(now.getFullYear(), 0, 1);
        const diff = now - start + ((start.getDay() + 1) * 86400000);
        const week = Math.ceil(diff / 604800000);
        elements.currentWeek.textContent = `Semaine ${week}`;
    }

    // Load session data from URL or API
    async function loadSessionData() {
        // Get groupe_id from URL params
        const urlParams = new URLSearchParams(window.location.search);
        state.groupeId = urlParams.get('groupe') || 1;

        try {
            // Load groupe details
            const groupeRes = await fetch(`${state.apiBaseUrl}/groupes/${state.groupeId}/`, {
                headers: { 'Authorization': `Bearer ${state.authToken}` }
            });

            if (!groupeRes.ok) throw new Error('Failed to load group');

            const groupe = await groupeRes.json();
            elements.groupName.textContent = `${groupe.nom_groupe} - ${groupe.niveau}`;
            elements.sessionDetails.textContent = `Salle ${groupe.salle || 'TBD'} • ${groupe.planning || 'Horaire non défini'}`;

            // Load students for this groupe
            await loadStudents(state.groupeId);

        } catch (error) {
            console.error('Error loading session:', error);
            showNotification('⚠️ Mode hors ligne', 'warning');
            loadStaticData();
        }
    }

    // Load students from API
    async function loadStudents(groupeId) {
        try {
            const response = await fetch(`${state.apiBaseUrl}/etudiants/?groupe=${groupeId}`, {
                headers: { 'Authorization': `Bearer ${state.authToken}` }
            });

            if (!response.ok) throw new Error('Failed to load students');

            const data = await response.json();
            state.students = Array.isArray(data) ? data : (data.results || []);

            // Load existing absences for today
            await loadTodayAbsences(groupeId);

            renderStudents();
            updateStats();

        } catch (error) {
            console.error('Error loading students:', error);
            loadStaticData();
        }
    }

    // Load today's absences
    async function loadTodayAbsences(groupeId) {
        const today = new Date().toISOString().split('T')[0];
        try {
            const response = await fetch(`${state.apiBaseUrl}/absences/?groupe=${groupeId}&date=${today}`, {
                headers: { 'Authorization': `Bearer ${state.authToken}` }
            });

            if (response.ok) {
                const absences = await response.json();
                // Build attendance state from existing absences
                absences.forEach(abs => {
                    state.attendance[abs.etudiant] = abs.statut_absence.toLowerCase();
                });
            }
        } catch (error) {
            console.log('No existing absences found');
        }
    }

    // Render students list
    function renderStudents() {
        elements.totalStudents.textContent = state.students.length;

        if (state.students.length === 0) {
            elements.studentList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #64748b;">Aucun étudiant trouvé</p>';
            return;
        }

        elements.studentList.innerHTML = state.students.map((student, index) => {
            const initials = getInitials(student.user?.first_name + ' ' + student.user?.last_name);
            const absenceCount = student.absences_count || 0;
            const absenceClass = absenceCount >= 3 ? 'danger' : (absenceCount >= 2 ? 'warning' : '');
            const currentStatus = state.attendance[student.id] || 'present';

            return `
                <div class="student-item ${absenceClass}" data-id="${student.id}" data-absences="${absenceCount}">
                    <div class="student-number">${String(index + 1).padStart(2, '0')}</div>
                    <div class="student-avatar">${initials}</div>
                    <div class="student-info">
                        <h4>${escapeHtml(student.user?.first_name + ' ' + student.user?.last_name)}</h4>
                        <p>ID: ${student.id} • Niveau: ${student.niveau_actuel || 'A1'}</p>
                    </div>
                    <div class="absence-count ${absenceClass}">
                        <div>
                            <span>${absenceCount}</span>
                            <label>Absence${absenceCount > 1 ? 's' : ''}</label>
                        </div>
                    </div>
                    <div class="status-selector">
                        <label class="status-option">
                            <input type="radio" name="student-${student.id}" value="present"
                                ${currentStatus === 'present' ? 'checked' : ''}
                                onchange="updateAttendance(${student.id}, 'present')">
                            <span class="status-label present">✅ Présent</span>
                        </label>
                        <label class="status-option">
                            <input type="radio" name="student-${student.id}" value="absent"
                                ${currentStatus === 'absent' ? 'checked' : ''}
                                onchange="updateAttendance(${student.id}, 'absent')">
                            <span class="status-label absent">❌ Absent</span>
                        </label>
                        <label class="status-option">
                            <input type="radio" name="student-${student.id}" value="late"
                                ${currentStatus === 'late' ? 'checked' : ''}
                                onchange="updateAttendance(${student.id}, 'late')">
                            <span class="status-label late">⏰ Retard</span>
                        </label>
                        <label class="status-option">
                            <input type="radio" name="student-${student.id}" value="justified"
                                ${currentStatus === 'justified' ? 'checked' : ''}
                                onchange="updateAttendance(${student.id}, 'justified')">
                            <span class="status-label justified">📝 Justifié</span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        checkAlerts();
    }

    // Update attendance state
    window.updateAttendance = function(studentId, status) {
        state.attendance[studentId] = status;
        updateStats();

        // Visual feedback
        const row = document.querySelector(`.student-item[data-id="${studentId}"]`);
        if (row) {
            row.style.animation = 'none';
            setTimeout(() => {
                row.style.animation = 'pulse 0.5s';
            }, 10);
        }
    };

    // Update statistics
    function updateStats() {
        const counts = { present: 0, absent: 0, late: 0, justified: 0 };

        Object.values(state.attendance).forEach(status => {
            if (counts[status] !== undefined) counts[status]++;
        });

        // Default to present for unset students
        const unsetCount = state.students.length - Object.keys(state.attendance).length;
        counts.present += unsetCount;

        state.stats = counts;

        // Update UI
        document.querySelector('.present-count').textContent = counts.present;
        document.querySelector('.absent-count').textContent = counts.absent;
        document.querySelector('.late-count').textContent = counts.late;
        document.querySelector('.justified-count').textContent = counts.justified;

        // Update stat card highlights
        elements.statCards.forEach(card => {
            card.classList.remove('active');
        });
    }

    // Check for alerts (students with 3+ absences)
    function checkAlerts() {
        const alerts = state.students.filter(s => (s.absences_count || 0) >= 3);

        if (alerts.length > 0) {
            const names = alerts.map(s => `${s.user?.first_name} ${s.user?.last_name}`).join(', ');
            elements.alertContainer.innerHTML = `
                <div class="alert-box">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <h3>Alerte de Dépassement</h3>
                        <p><strong>${names}</strong> ${alerts.length > 1 ? 'ont' : 'a'} dépassé 3 absences.
                        Une notification automatique a été envoyée aux parents et au dirigeant.</p>
                    </div>
                </div>
            `;
        } else {
            elements.alertContainer.innerHTML = '';
        }
    }

    // Save attendance to API
    window.saveAttendance = async function() {
        const btn = document.querySelector('.btn-save');
        btn.innerHTML = '💾 Enregistrement...';
        btn.disabled = true;

        try {
            const today = new Date().toISOString().split('T')[0];
            const promises = [];

            for (const [studentId, status] of Object.entries(state.attendance)) {
                const payload = {
                    etudiant: parseInt(studentId),
                    date_absence: today,
                    statut_absence: status.charAt(0).toUpperCase() + status.slice(1),
                    seance: state.sessionId
                };

                promises.push(
                    fetch(`${state.apiBaseUrl}/absences/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${state.authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                );
            }

            await Promise.all(promises);
            showNotification('✅ Présences enregistrées avec succès', 'success');

        } catch (error) {
            console.error('Error saving attendance:', error);
            showNotification('❌ Erreur lors de l\'enregistrement', 'error');
        } finally {
            btn.innerHTML = '💾 Enregistrer';
            btn.disabled = false;
        }
    };

    // Generate PDF report
    window.generatePDF = function() {
        showNotification('📄 Génération du PDF...', 'info');

        // Trigger print dialog (styled for printing)
        setTimeout(() => {
            window.print();
        }, 500);
    };

    // Setup event listeners
    function setupEventListeners() {
        // Stat card clicks for quick filtering
        elements.statCards.forEach((card, index) => {
            card.addEventListener('click', () => {
                const statuses = ['present', 'absent', 'late', 'justified'];
                filterByStatus(statuses[index]);
            });
        });
    }

    // Filter students by status
    function filterByStatus(status) {
        const rows = document.querySelectorAll('.student-item');
        rows.forEach(row => {
            const studentId = row.dataset.id;
            const currentStatus = state.attendance[studentId] || 'present';

            if (currentStatus === status) {
                row.style.display =