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
  async login(identifier: string, password: string) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  async register(name: string, username: string, email: string, password: string) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password }),
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

  async getMessages(conversationId: string, options?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (options?.limit) searchParams.set('limit', options.limit.toString());
    if (options?.offset) searchParams.set('offset', options.offset.toString());
    
    const query = searchParams.toString();
    const endpoint = query ? `/conversations/${conversationId}/messages?${query}` : `/conversations/${conversationId}/messages`;
    
    return apiRequest(endpoint);
  },

  async sendMessage(conversationId: string, content: string, type: 'text' = 'text') {
    return apiRequest(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
  },

  async markMessageAsRead(conversationId: string, messageId: string) {
    return apiRequest(`/conversations/${conversationId}/messages/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  },

  async markMessageAsDelivered(conversationId: string, messageId: string) {
    return apiRequest(`/conversations/${conversationId}/messages/mark-delivered`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  },

  async getMessageStatus(conversationId: string, messageIds?: string[]) {
    const query = messageIds?.length ? `?messageIds=${messageIds.join(',')}` : '';
    return apiRequest(`/conversations/${conversationId}/messages/status${query}`);
  },
};

// Users API
export const usersAPI = {
  async updateStatus(userStatus: 'online' | 'busy' | 'away' | 'offline') {
    return apiRequest('/users/me/status', {
      method: 'PATCH',
      body: JSON.stringify({ userStatus }),
    });
  },

  async getProfile() {
    return apiRequest('/users/me');
  },
};
