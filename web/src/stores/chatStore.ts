import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Contact, Conversation, Message, User } from '@/types/chat';
import { contactsAPI, conversationsAPI } from '@/lib/api';

interface ChatState {
  // Data state
  contacts: Contact[];
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  
  // UI state
  isLoading: boolean;
  isLoadingMessages: boolean;
  selectedChatId: string | null;
  
  // Cache for contact-conversation mapping
  contactConversationCache: Map<string, string>;
  
  // Actions
  loadContacts: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  selectContactConversation: (contactId: string, contactName: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addContact: (contactId: string, nickname?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  
  // Helpers
  getOrCreateConversationWithContact: (contactId: string) => Promise<string>;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    contacts: [],
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    isLoadingMessages: false,
    selectedChatId: null,
    contactConversationCache: new Map(),

    // Load contacts from API
    loadContacts: async () => {
      try {
        console.log('🔄 Loading contacts...');
        set({ isLoading: true });
        
        const contacts = await contactsAPI.getContacts();
        console.log('✅ Contacts loaded:', contacts);
        
        set({ contacts, isLoading: false });
      } catch (error) {
        console.error('❌ Failed to load contacts:', error);
        set({ isLoading: false });
        throw error;
      }
    },

    // Load conversations from API
    loadConversations: async () => {
      try {
        console.log('🔄 Loading conversations...');
        set({ isLoading: true });
        
        const conversations = await conversationsAPI.getConversations();
        console.log('✅ Conversations loaded:', conversations);
        
        set({ conversations, isLoading: false });
      } catch (error) {
        console.error('❌ Failed to load conversations:', error);
        set({ isLoading: false });
        throw error;
      }
    },

    // Load messages for a conversation
    loadMessages: async (conversationId: string) => {
      try {
        console.log(`🔄 Loading messages for conversation ${conversationId}...`);
        set({ isLoadingMessages: true });
        
        const messages = await conversationsAPI.getMessages(conversationId);
        
        // Sort messages by creation date
        const sortedMessages = messages.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        console.log(`✅ Loaded ${sortedMessages.length} messages`);
        set({ messages: sortedMessages, isLoadingMessages: false });
      } catch (error) {
        console.error('❌ Failed to load messages:', error);
        set({ messages: [], isLoadingMessages: false });
        throw error;
      }
    },

    // Select a conversation by ID
    selectConversation: async (conversationId: string) => {
      try {
        const { conversations } = get();
        const conversation = conversations.find(c => c.id === conversationId);
        
        if (conversation) {
          console.log(`🎯 Selected conversation: ${conversationId}`);
          set({ 
            currentConversation: conversation, 
            selectedChatId: conversationId 
          });
          
          // Load messages for this conversation
          await get().loadMessages(conversationId);
        }
      } catch (error) {
        console.error('❌ Failed to select conversation:', error);
        throw error;
      }
    },

    // Get or create conversation with a contact
    getOrCreateConversationWithContact: async (contactId: string) => {
      const { contactConversationCache, conversations } = get();
      
      // Check cache first
      if (contactConversationCache.has(contactId)) {
        const cachedConvId = contactConversationCache.get(contactId)!;
        console.log(`📦 Using cached conversation ${cachedConvId} for contact ${contactId}`);
        return cachedConvId;
      }

      try {
        // Look for existing conversation
        console.log('🔍 Looking for existing conversation...');
        const allConversations = await conversationsAPI.getConversations();
        
        for (const conv of allConversations) {
          if (conv.type === 'private' && conv.members?.length === 2) {
            const otherMember = conv.members.find(member => member.userId !== contactId);
            if (otherMember && otherMember.userId === contactId) {
              console.log(`✅ Found existing conversation ${conv.id} for contact ${contactId}`);
              contactConversationCache.set(contactId, conv.id);
              set({ contactConversationCache: new Map(contactConversationCache) });
              return conv.id;
            }
          }
        }

        // Create new conversation
        console.log(`🆕 Creating new conversation for contact ${contactId}`);
        const newConversation = await conversationsAPI.createConversation('private', [contactId]);
        
        contactConversationCache.set(contactId, newConversation.id);
        set({ 
          contactConversationCache: new Map(contactConversationCache),
          conversations: [...conversations, newConversation]
        });
        
        return newConversation.id;
      } catch (error) {
        console.error('❌ Error getting/creating conversation:', error);
        throw error;
      }
    },

    // Select conversation with a contact
    selectContactConversation: async (contactId: string, contactName: string) => {
      try {
        console.log(`🎯 Selecting conversation for contact ${contactId} (${contactName})`);
        
        const conversationId = await get().getOrCreateConversationWithContact(contactId);
        await get().selectConversation(conversationId);
        
        console.log(`✅ Successfully selected conversation ${conversationId} for contact ${contactName}`);
      } catch (error) {
        console.error('❌ Failed to select contact conversation:', error);
        throw error;
      }
    },

    // Send a message
    sendMessage: async (content: string) => {
      const { currentConversation, messages } = get();
      
      if (!currentConversation) {
        console.error('❌ No conversation selected');
        return;
      }

      try {
        console.log(`📤 Sending message: ${content.substring(0, 50)}...`);
        
        const newMessage = await conversationsAPI.sendMessage(currentConversation.id, content);
        
        // Ensure sender is properly set
        const messageToAdd = {
          ...newMessage,
          sender: newMessage.sender || {
            id: newMessage.senderId || '',
            name: 'You',
            email: '',
            avatar: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        };
        
        // Add message to local state immediately
        set({ 
          messages: [...messages, messageToAdd]
        });
        
        console.log('✅ Message sent successfully');
      } catch (error) {
        console.error('❌ Failed to send message:', error);
        throw error;
      }
    },

    // Add a new contact
    addContact: async (contactId: string, nickname?: string) => {
      try {
        console.log(`👤 Adding contact: ${contactId} (${nickname || 'no nickname'})`);
        
        await contactsAPI.addContact(contactId, nickname);
        
        // Reload contacts
        await get().loadContacts();
        
        console.log('✅ Contact added successfully');
        
        // Auto-select the new contact conversation
        const contactName = nickname || 'Novo Contato';
        await get().selectContactConversation(contactId, contactName);
      } catch (error) {
        console.error('❌ Failed to add contact:', error);
        throw error;
      }
    },

    // Add message (for real-time updates)
    addMessage: (message: Message) => {
      const { messages, currentConversation } = get();
      
      // Only add if it's for the current conversation
      if (currentConversation && message.conversationId === currentConversation.id) {
        set({ messages: [...messages, message] });
        console.log('📨 New message added via Socket.IO');
      }
    },

    // Reset store
    reset: () => {
      set({
        contacts: [],
        conversations: [],
        currentConversation: null,
        messages: [],
        isLoading: false,
        isLoadingMessages: false,
        selectedChatId: null,
        contactConversationCache: new Map(),
      });
      console.log('🧹 Chat store reset');
    },
  }))
);
