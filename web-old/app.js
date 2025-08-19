// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Global state
let currentUser = null;
let authToken = null;
let conversations = [];
let currentConversationId = null;
let messages = [];
let socket = null;
let contactConversationCache = new Map(); // Cache de conversas por contato

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatInterface = document.getElementById('chatInterface');
const authError = document.getElementById('authError');
const conversationsList = document.getElementById('conversationsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInputContainer = document.getElementById('messageInputContainer');
const chatHeader = document.getElementById('chatHeader');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const addContactModal = document.getElementById('addContactModal');
const contactError = document.getElementById('contactError');

// Utility functions
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function hideError(element) {
    element.style.display = 'none';
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// API functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        ...options,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Auth functions
function switchTab(tab) {
    const loginTab = document.querySelector('.tab');
    const registerTab = document.querySelectorAll('.tab')[1];
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    hideError(authError);
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    
    hideError(authError);
    loginBtn.disabled = true;
    loginBtn.textContent = 'Entrando...';
    
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        authToken = response.token;
        currentUser = response.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showChatInterface();
    } catch (error) {
        showError(authError, error.message);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Entrar';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const registerBtn = document.getElementById('registerBtn');
    
    hideError(authError);
    registerBtn.disabled = true;
    registerBtn.textContent = 'Cadastrando...';
    
    try {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
        
        authToken = response.token;
        currentUser = response.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showChatInterface();
    } catch (error) {
        showError(authError, error.message);
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Cadastrar';
    }
}

function logout() {
    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    authToken = null;
    currentUser = null;
    conversations = [];
    currentConversationId = null;
    messages = [];
    
    // Limpar cache completamente
    contactConversationCache.clear();
    console.log('🦽 Cache de conversas limpo');
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    loginScreen.style.display = 'flex';
    chatInterface.style.display = 'none';
    
    // Reset forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    hideError(authError);
}

// Chat interface functions
function showChatInterface() {
    console.log('🎨 Showing chat interface for user:', currentUser);
    
    loginScreen.style.display = 'none';
    chatInterface.style.display = 'flex';
    
    // Update user info in workspace header
    userName.textContent = `${currentUser.name}'s Workspace`;
    
    // Update user status
    const userStatus = document.getElementById('userStatus');
    if (userStatus) {
        userStatus.textContent = `Logado como ${currentUser.name}`;
    }
    
    // Load contacts (which will show as conversations)
    loadContacts();
    
    // Initialize Socket.IO connection
    initializeSocket();
}

async function loadContacts() {
    console.log('🔄 Starting to load contacts...');
    console.log('📋 Current user:', currentUser);
    console.log('🔑 Auth token exists:', !!authToken);
    
    try {
        console.log('🌐 Making API request to /contacts...');
        const contacts = await apiRequest('/contacts');
        console.log('✅ Contacts loaded successfully:', contacts);
        console.log('📊 Number of contacts:', contacts.length);
        
        renderContactsAsConversations(contacts);
    } catch (error) {
        console.error('❌ Failed to load contacts:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        conversationsList.innerHTML = `
            <div class="section-header">
                Channels
                <button onclick="showAddContactModal()" style="float: right; background: none; border: none; color: #888; cursor: pointer; font-size: 16px;">+</button>
            </div>
            <div class="loading" style="color: #888; padding: 20px; text-align: center;">
                <p>Erro ao carregar contatos</p>
                <p style="font-size: 12px; color: #666;">${error.message}</p>
            </div>
        `;
    }
}

function renderContactsAsConversations(contacts) {
    if (contacts.length === 0) {
        conversationsList.innerHTML = `
            <div class="section-header">
                Channels
                <button onclick="showAddContactModal()" style="float: right; background: none; border: none; color: #888; cursor: pointer; font-size: 16px;">+</button>
            </div>
            <div class="loading" style="color: #888; padding: 20px; text-align: center;">
                <p>Nenhum contato ainda</p>
                <p style="font-size: 12px; margin-top: 10px;">Adicione um contato para começar!</p>
            </div>
        `;
        return;
    }
    
    const channelsSection = `
        <div class="section-header">
            Channels
            <button onclick="showAddContactModal()" style="float: right; background: none; border: none; color: #888; cursor: pointer; font-size: 16px;">+</button>
        </div>
    `;
    
    const contactsHTML = contacts.map(contact => {
        const contactName = contact.nickname || contact.contact.name;
        const contactId = contact.contact.id;
        // Verifica se este contato tem a conversa ativa
        const cachedConvId = contactConversationCache.get(contactId);
        const isActive = currentConversationId && (currentConversationId === cachedConvId);
        
        return `
            <div class="conversation-item ${isActive ? 'active' : ''}" 
                 onclick="selectContactConversation('${contactId}', '${contactName.replace(/'/g, '\\\'')}')">
                <span class="channel-icon">#</span>
                <div class="conversation-content">
                    <div class="conversation-name">
                        ${contactName}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    conversationsList.innerHTML = channelsSection + contactsHTML;
}

async function getOrCreateConversationWithContact(contactId) {
    // Primeiro verifica se já temos essa conversa no cache
    if (contactConversationCache.has(contactId)) {
        const cachedConvId = contactConversationCache.get(contactId);
        console.log(`Using cached conversation ${cachedConvId} for contact ${contactId}`);
        return cachedConvId;
    }
    
    try {
        // Busca todas as conversas para encontrar uma existente
        const allConversations = await apiRequest('/conversations');
        console.log('All conversations:', allConversations);
        
        if (allConversations && Array.isArray(allConversations)) {
            for (const conv of allConversations) {
                if (conv.type === 'private' && conv.members && Array.isArray(conv.members)) {
                    // Procura por membro que não seja o usuário atual
                    const otherMember = conv.members.find(member => member.userId !== currentUser.id);
                    if (otherMember && otherMember.userId === contactId) {
                        console.log(`Found existing conversation ${conv.id} for contact ${contactId}`);
                        // Salva no cache
                        contactConversationCache.set(contactId, conv.id);
                        return conv.id;
                    }
                }
            }
        }
        
        // Se chegou até aqui, não existe conversa - cria uma nova
        console.log(`Creating new conversation for contact ${contactId}`);
        const newConversation = await apiRequest('/conversations', {
            method: 'POST',
            body: JSON.stringify({
                type: 'private',
                memberIds: [contactId],
            }),
        });
        
        console.log('New conversation created:', newConversation);
        
        // Salva no cache
        contactConversationCache.set(contactId, newConversation.id);
        return newConversation.id;
        
    } catch (error) {
        console.error('Error getting/creating conversation:', error);
        throw error;
    }
}

async function selectContactConversation(contactId, contactName) {
    try {
        console.log(`Selecting conversation for contact ${contactId} (${contactName})`);
        
        // Obtém ou cria a conversa para esse contato
        const conversationId = await getOrCreateConversationWithContact(contactId);
        
        // Set current conversation
        currentConversationId = conversationId;
        console.log(`Set current conversation to: ${conversationId}`);
        
        // Re-render contacts to show active state
        await loadContacts();
        
        // Update chat header
        chatHeader.innerHTML = `
            <div class="conversation-avatar">
                ${getInitials(contactName)}
            </div>
            <div class="conversation-name">
                ${contactName}
            </div>
        `;
        
        // Show message input
        messageInputContainer.style.display = 'block';
        
        // Join conversation room via Socket.IO
        if (socket && socket.connected) {
            socket.emit('conversation:join', { conversationId });
            console.log(`🏠 Joined conversation room: ${conversationId}`);
        }
        
        // Load messages
        await loadMessages();
        
    } catch (error) {
        console.error('Failed to select conversation:', error);
        alert('Erro ao abrir conversa: ' + error.message);
    }
}

async function selectConversation(conversationId) {
    currentConversationId = conversationId;
    renderConversations(); // Re-render to show active state
    
    // Update chat header
    const conversation = conversations.find(c => c.id === conversationId);
    chatHeader.innerHTML = `
        <div class="conversation-name">
            ${conversation.type === 'private' ? 'Chat Privado' : conversation.name}
        </div>
    `;
    
    // Show message input
    messageInputContainer.style.display = 'block';
    
    // Load messages
    await loadMessages();
}

async function loadMessages() {
    if (!currentConversationId) return;
    
    try {
        messages = await apiRequest(`/conversations/${currentConversationId}/messages`);
        
        // Garantir que as mensagens estão ordenadas por data (mais antigas primeiro)
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        renderMessages();
        console.log(`📋 Loaded ${messages.length} messages for conversation ${currentConversationId}`);
    } catch (error) {
        console.error('Failed to load messages:', error);
        messagesContainer.innerHTML = '<div class="loading">Erro ao carregar mensagens</div>';
    }
}

function renderMessages() {
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <h3>Início da conversa</h3>
                <p>Envie a primeira mensagem!</p>
            </div>
        `;
        return;
    }
    
    messagesContainer.innerHTML = messages.map(message => {
        const isOwn = message.sender.id === currentUser.id;
        return `
            <div class="message ${isOwn ? 'own' : ''}">
                <div class="message-bubble">
                    ${!isOwn ? `<div class="message-sender">${message.sender.name}</div>` : ''}
                    <div class="message-content">${message.content}</div>
                    <div class="message-time">${formatTime(message.createdAt)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();
    
    if (!currentConversationId) return;
    
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content) return;
    
    try {
        const newMessage = await apiRequest(`/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                content,
                type: 'text',
            }),
        });
        
        // Add message to local array
        messages.push({
            id: newMessage.id,
            content: newMessage.content,
            type: newMessage.type,
            createdAt: newMessage.createdAt,
            sender: {
                id: currentUser.id,
                name: currentUser.name,
                avatar: currentUser.avatar,
            },
        });
        
        renderMessages();
        messageInput.value = '';
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Erro ao enviar mensagem: ' + error.message);
    }
}

// Contact management
function showAddContactModal() {
    addContactModal.style.display = 'flex';
    hideError(contactError);
    
    // Show user ID for easy copying
    document.getElementById('contactId').placeholder = `Seu ID: ${currentUser.id}`;
}

function closeAddContactModal() {
    addContactModal.style.display = 'none';
    document.getElementById('contactId').value = '';
    document.getElementById('contactNickname').value = '';
    hideError(contactError);
}

async function handleAddContact(event) {
    event.preventDefault();
    
    const contactId = document.getElementById('contactId').value.trim();
    const nickname = document.getElementById('contactNickname').value.trim();
    
    hideError(contactError);
    
    try {
        // Add contact
        await apiRequest('/contacts', {
            method: 'POST',
            body: JSON.stringify({
                contactId,
                nickname: nickname || undefined,
            }),
        });
        
        // Refresh contacts list
        await loadContacts();
        
        closeAddContactModal();
        
        // Auto-select the new contact conversation
        const contactName = nickname || 'Novo Contato';
        await selectContactConversation(contactId, contactName);
        
    } catch (error) {
        showError(contactError, error.message);
    }
}

// Socket.IO functions
function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }
    
    console.log('🔌 Connecting to Socket.IO server...');
    
    socket = io('http://localhost:3000', {
        auth: {
            token: authToken
        },
        autoConnect: true
    });
    
    // Connection events
    socket.on('connect', () => {
        console.log('✅ Connected to Socket.IO server');
        // Join conversation rooms when connected
        if (currentConversationId) {
            socket.emit('conversation:join', { conversationId: currentConversationId });
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from Socket.IO:', reason);
    });
    
    socket.on('connect_error', (error) => {
        console.error('🔥 Socket connection error:', error);
    });
    
    // Message events
    socket.on('message:new', (data) => {
        console.log('📨 New message received:', data);
        
        // Only add if it's for the current conversation and not from current user
        if (data.conversationId === currentConversationId && data.senderId !== currentUser.id) {
            // Add message to local array
            messages.push({
                id: data.messageId,
                content: data.content,
                type: data.type || 'text',
                createdAt: data.createdAt || new Date().toISOString(),
                sender: {
                    id: data.senderId,
                    name: data.senderName || 'Unknown',
                    avatar: data.senderAvatar,
                },
            });
            
            renderMessages();
        }
    });
    
    // Presence events
    socket.on('presence:update', (data) => {
        console.log('👤 Presence update:', data);
        // Update user status in UI if needed
    });
    
    // Typing events
    socket.on('typing:start', (data) => {
        if (data.conversationId === currentConversationId && data.userId !== currentUser.id) {
            console.log(`${data.userName} is typing...`);
            // Show typing indicator
        }
    });
    
    socket.on('typing:stop', (data) => {
        if (data.conversationId === currentConversationId && data.userId !== currentUser.id) {
            console.log(`${data.userName} stopped typing`);
            // Hide typing indicator
        }
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved auth
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showChatInterface();
    }
});

// Handle modal clicks
document.addEventListener('click', (event) => {
    if (event.target === addContactModal) {
        closeAddContactModal();
    }
});

// Handle Enter key in message input
document.addEventListener('keypress', (event) => {
    if (event.target.id === 'messageInput' && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.querySelector('.message-input-form').dispatchEvent(new Event('submit'));
    }
});
