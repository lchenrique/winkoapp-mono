// API Configuration
export const API_BASE_URL = 'http://localhost:3000/api';

// API utility function
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get token from localStorage
  const token = localStorage.getItem('authToken');
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
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

// Auth API
export const authAPI = {
  async login(email: string, password: string) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(name: string, email: string, password: string) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },
};

// Contacts API
export const contactsAPI = {
  async getContacts() {
    return apiRequest('/contacts');
  },

  async addContact(contactId: string, nickname?: string) {
    return apiRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify({ contactId, nickname }),
    });
  },
};

// Conversations API
export const conversationsAPI = {
  async getConversations() {
    return apiRequest('/conversations');
  },

  async createConversation(type: 'private' | 'group', memberIds: string[], name?: string) {
    return apiRequest('/conversations', {
      method: 'POST',
      body: JSON.stringify({ type, memberIds, name }),
    });
  },

  async getMessages(conversationId: string) {
    return apiRequest(`/conversations/${conversationId}/messages`);
  },

  async sendMessage(conversationId: string, content: string, type: 'text' = 'text') {
    return apiRequest(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
  },
};
