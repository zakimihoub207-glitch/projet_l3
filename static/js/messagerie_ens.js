// messagerie_ens.js - Messaging System for Teachers

document.addEventListener('DOMContentLoaded', function() {
    // Helper to get JWT token from storage
    function getAuthToken() {
        return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
    }

    // State management
    const state = {
        conversations: [],
        currentConversation: null,
        messages: [],
        apiBaseUrl: '/api',
        authToken: getAuthToken(),
        pollingInterval: null,
        currentUser: null
    };

    // DOM Elements
    const elements = {
        conversationItems: document.querySelectorAll('.conversation-item'),
        conversationsList: document.querySelector('.conversations-list'),
        messagesContainer: document.querySelector('.messages-container'),
        messageInput: document.querySelector('.message-input'),
        sendBtn: document.querySelector('.send-btn'),
        newMessageBtn: document.querySelector('.new-message-btn'),
        searchInput: document.querySelector('.search-messages input'),
        chatHeader: document.querySelector('.chat-header'),
        quickResponses: document.querySelectorAll('.quick-response'),
        inputBtns: document.querySelectorAll('.input-btn')
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

        // Load current user info
        loadCurrentUser();

        setupEventListeners();

        // Build conversations from existing HTML or API
        buildConversationsFromHTML();

        // Select first conversation
        const firstConversation = document.querySelector('.conversation-item');
        if (firstConversation) {
            selectConversation(firstConversation);
        }

        // Start polling for new messages
        startPolling();
    }

    // Load current user from storage
    function loadCurrentUser() {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            try {
                state.currentUser = JSON.parse(userStr);
            } catch (e) {
                console.error('Error parsing user:', e);
            }
        }
    }

    // Build conversations from existing HTML (fallback) or API
    async function buildConversationsFromHTML() {
        // First, try to extract conversations from existing HTML
        const items = document.querySelectorAll('.conversation-item');
        state.conversations = Array.from(items).map((item, index) => ({
            id: item.dataset.id || (index + 1),
            other_user: {
                id: item.dataset.userId || (index + 100),
                name: item.querySelector('.conversation-name').childNodes[0].textContent.trim(),
                initials: item.querySelector('.conversation-avatar').childNodes[0].textContent.trim()
            },
            last_message: item.querySelector('.conversation-preview')?.textContent || '',
            last_message_time: new Date().toISOString(),
            unread: item.classList.contains('unread'),
            unread_count: parseInt(item.querySelector('.unread-badge')?.textContent || '0'),
            online: item.querySelector('.online-indicator') !== null
        }));

        // Then try to load from API
        try {
            await loadConversationsFromAPI();
        } catch (error) {
            console.log('Using HTML fallback for conversations');
        }
    }

    // Load conversations from API (using messages endpoint)
    async function loadConversationsFromAPI() {
        // Get unique conversations from messages
        const response = await fetch(`${state.apiBaseUrl}/messages/`, {
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

        const messages = await response.json();

        // Group messages by conversation partner
        const conversationsMap = new Map();

        messages.forEach(msg => {
            const isSender = msg.expediteur === state.currentUser?.id;
            const otherUserId = isSender ? msg.destinataire : msg.expediteur;
            const otherUserName = isSender ? msg.destinataire_nom : msg.expediteur_nom;

            if (!conversationsMap.has(otherUserId)) {
                conversationsMap.set(otherUserId, {
                    id: `conv-${otherUserId}`,
                    other_user: {
                        id: otherUserId,
                        name: otherUserName || 'Utilisateur',
                        initials: getInitials(otherUserName || 'U')
                    },
                    last_message: msg.contenu,
                    last_message_time: msg.date_envoi,
                    unread: !msg.lu && !isSender,
                    unread_count: (!msg.lu && !isSender) ? 1 : 0,
                    online: false
                });
            } else {
                const conv = conversationsMap.get(otherUserId);
                // Update if this message is newer
                if (new Date(msg.date_envoi) > new Date(conv.last_message_time)) {
                    conv.last_message = msg.contenu;
                    conv.last_message_time = msg.date_envoi;
                }
                if (!msg.lu && !isSender) {
                    conv.unread = true;
                    conv.unread_count++;
                }
            }
        });

        state.conversations = Array.from(conversationsMap.values())
            .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

        // Update UI if we got data
        if (state.conversations.length > 0) {
            renderConversations(state.conversations);
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Conversation selection
        elements.conversationsList.addEventListener('click', (e) => {
            const item = e.target.closest('.conversation-item');
            if (item) {
                selectConversation(item);
            }
        });

        // Send message
        elements.sendBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Search conversations
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce((e) => {
                searchConversations(e.target.value);
            }, 300));
        }

        // Quick responses
        elements.quickResponses.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.messageInput.value = btn.textContent;
                elements.messageInput.focus();
            });
        });

        // New message button
        elements.newMessageBtn.addEventListener('click', showNewMessageModal);

        // Input buttons
        elements.inputBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.textContent.trim();
                if (action === '📎') {
                    showNotification('📎 Fonctionnalité pièce jointe à venir', 'info');
                } else if (action === '😊') {
                    showNotification('😊 Sélecteur d\'émojis à venir', 'info');
                }
            });
        });

        // Chat action buttons
        document.querySelectorAll('.chat-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.textContent.trim();
                showNotification(`${action} Fonctionnalité à venir`, 'info');
            });
        });
    }

    // Render conversations list
    function renderConversations(conversations) {
        if (conversations.length === 0) {
            elements.conversationsList.innerHTML = `
                <div class="no-conversations" style="padding: 2rem; text-align: center;">
                    <p style="color: #64748b;">Aucune conversation</p>
                </div>
            `;
            return;
        }

        elements.conversationsList.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${conv.unread ? 'unread' : ''}"
                 data-id="${conv.id}"
                 data-user-id="${conv.other_user.id}">
                <div class="conversation-avatar">
                    ${conv.other_user.initials}
                    ${conv.online ? '<span class="online-indicator"></span>' : ''}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${escapeHtml(conv.other_user.name)}
                        <span class="conversation-time">${formatTime(conv.last_message_time)}</span>
                    </div>
                    <div class="conversation-preview">${escapeHtml(conv.last_message)}</div>
                </div>
                ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : ''}
            </div>
        `).join('');
    }

    // Select conversation
    async function selectConversation(element) {
        // Update UI
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');

        // Remove unread badge
        const badge = element.querySelector('.unread-badge');
        if (badge) badge.remove();
        element.classList.remove('unread');

        // Get conversation data
        const conversationId = element.dataset.id;
        const userId = element.dataset.userId;
        const userName = element.querySelector('.conversation-name').childNodes[0].textContent.trim();

        state.currentConversation = {
            id: conversationId,
            userId: userId,
            userName: userName
        };

        // Update chat header
        updateChatHeader(userName, element.querySelector('.online-indicator') !== null);

        // Load messages
        await loadMessages(userId);
    }

    // Update chat header
    function updateChatHeader(name, isOnline) {
        elements.chatHeader.innerHTML = `
            <div class="chat-user">
                <div class="chat-user-avatar">${getInitials(name)}</div>
                <div class="chat-user-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p>${isOnline ? '🟢 En ligne' : '⚪ Hors ligne'}</p>
                </div>
            </div>
            <div class="chat-actions">
                <button class="chat-action-btn">📞</button>
                <button class="chat-action-btn">📹</button>
                <button class="chat-action-btn">ℹ️</button>
            </div>
        `;

        // Re-attach event listeners
        document.querySelectorAll('.chat-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showNotification(`${btn.textContent} Fonctionnalité à venir`, 'info');
            });
        });
    }

    // Load messages for conversation
    async function loadMessages(userId) {
        elements.messagesContainer.innerHTML = `
            <div class="loading-messages" style="text-align: center; padding: 3rem;">
                <div style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <p style="color: #64748b;">Chargement des messages...</p>
            </div>
        `;

        try {
            // Get all messages and filter by conversation partner
            const response = await fetch(`${state.apiBaseUrl}/messages/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const allMessages = await response.json();

            // Filter messages for this conversation
            state.messages = allMessages.filter(msg =>
                msg.expediteur == userId || msg.destinataire == userId
            ).sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi));

            renderMessages(state.messages);

            // Mark messages as read
            markMessagesAsRead(userId);

        } catch (error) {
            console.error('Error loading messages:', error);
            renderStaticMessages();
        }
    }

    // Render messages
    function renderMessages(messages) {
        if (messages.length === 0) {
            elements.messagesContainer.innerHTML = `
                <div class="no-messages" style="text-align: center; padding: 3rem; color: #64748b;">
                    <p>Aucun message. Commencez la conversation!</p>
                </div>
            `;
            return;
        }

        // Group by date
        let currentDate = null;
        let html = '';

        messages.forEach(msg => {
            const msgDate = new Date(msg.date_envoi).toDateString();
            if (msgDate !== currentDate) {
                currentDate = msgDate;
                html += `<div class="message-date"><span>${formatDate(msg.date_envoi)}</span></div>`;
            }

            const isOwn = msg.expediteur === state.currentUser?.id;
            html += createMessageBubble(msg, isOwn);
        });

        elements.messagesContainer.innerHTML = html;
        scrollToBottom();
    }

    // Create message bubble HTML
    function createMessageBubble(msg, isOwn) {
        const time = formatTime(msg.date_envoi);
        const readStatus = isOwn ? (msg.lu ? ' ✓✓' : ' ✓') : '';

        let attachmentHtml = '';
        if (msg.pieces_jointes && msg.pieces_jointes.length > 0) {
            attachmentHtml = msg.pieces_jointes.map(att => `
                <div class="message-attachment" onclick="downloadAttachment(${att.id})">
                    <div class="attachment-icon">📄</div>
                    <div class="attachment-info">
                        <div class="attachment-name">${escapeHtml(att.nom_fichier)}</div>
                        <div class="attachment-size">${formatFileSize(att.taille_fichier)}</div>
                    </div>
                </div>
            `).join('');
        }

        const senderName = isOwn ? 'Moi' : (msg.expediteur_nom || state.currentConversation?.userName || '');

        return `
            <div class="message ${isOwn ? 'own' : ''}" data-id="${msg.id}">
                <div class="message-avatar">${getInitials(senderName)}</div>
                <div class="message-content">
                    <div class="message-bubble">
                        ${escapeHtml(msg.contenu)}
                        ${attachmentHtml}
                    </div>
                    <div class="message-time">${time}${readStatus}</div>
                </div>
            </div>
        `;
    }

    // Send message
    async function sendMessage() {
        const content = elements.messageInput.value.trim();
        if (!content || !state.currentConversation) return;

        // Clear input
        elements.messageInput.value = '';

        // Create temp message
        const tempMsg = {
            id: 'temp-' + Date.now(),
            contenu: content,
            date_envoi: new Date().toISOString(),
            expediteur: state.currentUser?.id,
            expediteur_nom: 'Moi',
            destinataire: state.currentConversation.userId,
            lu: false,
            pieces_jointes: []
        };

        // Add to UI immediately
        addMessageToChat(tempMsg, true);
        scrollToBottom();

        try {
            const response = await fetch(`${state.apiBaseUrl}/messages/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    destinataire: state.currentConversation.userId,
                    contenu: content,
                    sujet: 'Message'
                })
            });

            if (!response.ok) throw new Error('Failed to send');

            const savedMsg = await response.json();

            // Replace temp message with saved one
            const tempElement = document.querySelector(`[data-id="${tempMsg.id}"]`);
            if (tempElement) {
                tempElement.outerHTML = createMessageBubble(savedMsg, true);
            }

            // Update conversation preview
            updateConversationPreview(state.currentConversation.userId, content);

        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('❌ Erreur d\'envoi', 'error');

            // Mark as failed
            const tempElement = document.querySelector(`[data-id="${tempMsg.id}"]`);
            if (tempElement) {
                tempElement.querySelector('.message-bubble').style.opacity = '0.5';
                tempElement.querySelector('.message-time').textContent += ' ⚠️';
            }
        }
    }

    // Mark messages as read
    async function markMessagesAsRead(senderId) {
        try {
            // Find unread messages from this sender
            const unreadMessages = state.messages.filter(msg =>
                msg.expediteur == senderId && !msg.lu
            );

            for (const msg of unreadMessages) {
                await fetch(`${state.apiBaseUrl}/messages/${msg.id}/`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ lu: true })
                });
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    // Add message to chat
    function addMessageToChat(msg, isOwn) {
        const existingDate = elements.messagesContainer.querySelector('.message-date:last-of-type');
        const msgDate = new Date(msg.date_envoi).toDateString();
        const today = new Date().toDateString();

        // Add date separator if needed
        if (!existingDate || msgDate !== today) {
            const dateHtml = `<div class="message-date"><span>${formatDate(msg.date_envoi)}</span></div>`;
            elements.messagesContainer.insertAdjacentHTML('beforeend', dateHtml);
        }

        elements.messagesContainer.insertAdjacentHTML('beforeend', createMessageBubble(msg, isOwn));
    }

    // Update conversation preview
    function updateConversationPreview(userId, preview) {
        const convElement = document.querySelector(`.conversation-item[data-user-id="${userId}"]`);
        if (convElement) {
            const previewEl = convElement.querySelector('.conversation-preview');
            if (previewEl) {
                previewEl.textContent = preview.substring(0, 30) + (preview.length > 30 ? '...' : '');
            }

            const timeEl = convElement.querySelector('.conversation-time');
            if (timeEl) {
                timeEl.textContent = 'Maintenant';
            }

            // Move to top
            elements.conversationsList.prepend(convElement);
        }
    }

    // Search conversations
    function searchConversations(query) {
        const items = document.querySelectorAll('.conversation-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('.conversation-name').textContent.toLowerCase();
            const preview = item.querySelector('.conversation-preview').textContent.toLowerCase();

            if (name.includes(lowerQuery) || preview.includes(lowerQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Show new message modal
    function showNewMessageModal() {
        // Create modal for selecting recipient
        const modal = document.createElement('div');
        modal.className = 'new-message-modal';
        modal.innerHTML = `
            <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div class="modal-content" style="background: white; padding: 2rem; border-radius: 20px; width: 90%; max-width: 500px;">
                    <h2>Nouveau Message</h2>
                    <div class="form-group" style="margin: 1rem 0;">
                        <label>Destinataire</label>
                        <select class="recipient-select" style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px;">
                            <option value="">-- Sélectionner un parent --</option>
                            <option value="101">Ahmed Mansouri</option>
                            <option value="102">Leila Kadiri</option>
                            <option value="103">Samir Benali</option>
                        </select>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                        <button class="btn-secondary cancel-btn" style="padding: 0.75rem 1.5rem; border: 2px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer;">Annuler</button>
                        <button class="btn-primary start-chat-btn" style="padding: 0.75rem 1.5rem; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; cursor: pointer;">Commencer</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('.start-chat-btn').addEventListener('click', () => {
            const recipientId = modal.querySelector('.recipient-select').value;
            if (recipientId) {
                startNewConversation(recipientId);
                modal.remove();
            }
        });
    }

    // Start new conversation
    async function startNewConversation(userId) {
        // Check if conversation already exists
        const existing = document.querySelector(`.conversation-item[data-user-id="${userId}"]`);
        if (existing) {
            selectConversation(existing);
            return;
        }

        // Create new conversation item
        const name = document.querySelector(`.recipient-select option[value="${userId}"]`)?.textContent || 'Nouveau contact';

        const newConv = document.createElement('div');
        newConv.className = 'conversation-item active';
        newConv.dataset.id = `conv-${userId}`;
        newConv.dataset.userId = userId;
        newConv.innerHTML = `
            <div class="conversation-avatar">${getInitials(name)}</div>
            <div class="conversation-info">
                <div class="conversation-name">
                    ${escapeHtml(name)}
                    <span class="conversation-time">Maintenant</span>
                </div>
                <div class="conversation-preview">Nouvelle conversation</div>
            </div>
        `;

        elements.conversationsList.prepend(newConv);
        selectConversation(newConv);
    }

    // Start polling for new messages
    function startPolling() {
        if (state.pollingInterval) return;

        state.pollingInterval = setInterval(() => {
            if (state.currentConversation) {
                checkNewMessages();
            }
        }, 5000); // Poll every 5 seconds
    }

    // Check for new messages
    async function checkNewMessages() {
        try {
            const response = await fetch(`${state.apiBaseUrl}/messages/?destinataire=${state.currentUser?.id}&lu=false`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return;

            const newMessages = await response.json();

            if (newMessages.length > 0) {
                // Add new messages to chat
                newMessages.forEach(msg => {
                    if (!document.querySelector(`[data-id="${msg.id}"]`)) {
                        const isOwn = msg.expediteur === state.currentUser?.id;
                        addMessageToChat(msg, isOwn);

                        // Play notification sound (optional)
                        // new Audio('/static/sounds/notification.mp3').play().catch(() => {});
                    }
                });

                scrollToBottom();
                showNotification(`📩 ${newMessages.length} nouveau(x) message(s)`, 'info');
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    // Scroll to bottom
    function scrollToBottom() {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    // Render static messages (fallback)
    function renderStaticMessages() {
        console.log('Using static HTML messages');
        // Keep existing HTML
    }

    // Utility functions
    function getInitials(name) {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }

        const diff = (now - date) / (1000 * 60 * 60 * 24);
        if (diff < 7) {
            const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            return days[date.getDay()];
        }

        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return 'Aujourd\'hui';
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Hier';
        }

        return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

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

    function handleAuthError() {
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
        window.location.href = '/login/';
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

    // Global function for attachment download
    window.downloadAttachment = function(attachmentId) {
        showNotification('📥 Téléchargement...', 'info');
        // Implement actual download logic here
    };

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }

        .conversation-item {
            transition: all 0.3s;
        }

        .conversation-item:hover {
            background: #f8fafc;
            transform: translateX(5px);
        }

        .message {
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message-bubble {
            transition: all 0.3s;
        }

        .message-bubble:hover {
            transform: scale(1.02);
        }

        .send-btn {
            transition: all 0.3s;
        }

        .send-btn:hover {
            transform: scale(1.1);
        }

        .send-btn:active {
            transform: scale(0.95);
        }

        .message-attachment {
            cursor: pointer;
            transition: all 0.3s;
        }

        .message-attachment:hover {
            background: rgba(0,0,0,0.05);
        }
    `;

    document.head.appendChild(style);
});