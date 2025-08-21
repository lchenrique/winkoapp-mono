// User types
export interface User {
  id: string;
  username?: string; // Username for display purposes
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// Contact types
export interface Contact {
  id: string;
  nickname?: string;
  contact: User;
  createdAt: string;
  updatedAt: string;
}

// Message status types
export type MessageStatusType = 'sent' | 'delivered' | 'read';

export interface MessageStatus {
  id: string;
  messageId: string;
  userId: string;
  status: MessageStatusType;
  timestamp: string;
}

// Message types
export interface Message {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  conversationId: string;
  senderId: string;
  sender?: User; // Made optional to handle cases where sender data might be missing
  status?: MessageStatusType | null; // Current user's status for this message (for viewing perspective)
  statusTimestamp?: string | null; // Timestamp of when status was updated
  createdAt: string;
  updatedAt?: string;
}

// Conversation types
export interface ConversationMember {
  id: string;
  userId: string;
  conversationId: string;
  role: 'member' | 'admin';
  joinedAt: string;
  user: User;
}

export interface Conversation {
  id: string;
  name?: string;
  type: 'private' | 'group';
  description?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage?: Message;
}

// Auth types
export interface AuthResponse {
  token: string;
  user: User;
}

// Socket.IO events
export interface SocketEvents {
  // Connection events
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;

  // Conversation events
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;

  // Message events
  'message:new': (data: {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    type: string;
    createdAt: string;
  }) => void;

  'message:delivered': (data: {
    messageId: string;
    userId: string;
    timestamp: string;
  }) => void;

  'message:read': (data: {
    messageId: string;
    userId: string;
    timestamp: string;
  }) => void;

  // Typing events
  'typing:start': (data: { conversationId: string; userId: string; userName: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string; userName: string }) => void;

  // Presence events
  'presence:update': (data: { 
    userId: string; 
    isOnline: boolean; 
    lastSeen: string;
    deviceId?: string;
  }) => void;
  
  // Status events
  'status:update': (data: {
    userId: string;
    status: 'online' | 'busy' | 'away' | 'offline';
    timestamp: string;
  }) => void;
}

// Context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface ChatContextType {
  contacts: Contact[];
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  loadContacts: () => Promise<void>;
  loadConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addContact: (contactId: string, nickname?: string) => Promise<void>;
}
