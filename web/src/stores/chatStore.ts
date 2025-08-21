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
  // Pre-loaded messages for recent conversations (Map: conversationId -> Message[])
  preloadedMessages: Map<string, Message[]>;
  // New messages counter (Map: conversationId -> count)
  unreadCounts: Map<string, number>;
  
  // UI state
  isLoading: boolean;
  isLoadingMessages: boolean;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  selectedChatId: string | null;
  
  // Presence state
  onlineUsers: Set<string>; // Set of user IDs that are online
  userStatuses: Map<string, 'online' | 'busy' | 'away' | 'offline'>; // Map of userId -> status
  
  // Cache for contact-conversation mapping
  contactConversationCache: Map<string, string>;
  
  // Actions
  loadContacts: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  selectConversation: (conversationId: string, userId?: string) => Promise<void>;
  selectContactConversation: (contactId: string, contactName: string, userId?: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addContact: (contactId: string, nickname?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markMultipleMessagesAsRead: (messageIds: string[]) => Promise<void>;
  markAllMessagesAsReadInConversation: (conversationId: string, userId?: string) => Promise<void>;
  
  // Pre-loading actions
  preloadRecentConversations: () => Promise<void>;
  addMessageToPreloaded: (message: Message) => void;
  getPreloadedMessages: (conversationId: string) => Message[];
  
  // Unread counter actions
  incrementUnreadCount: (conversationId: string) => void;
  resetUnreadCount: (conversationId: string) => void;
  getUnreadCount: (conversationId: string) => number;
  
  // Presence actions
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  isUserOnline: (userId: string) => boolean;
  
  // Status actions
  setUserStatus: (userId: string, status: 'online' | 'busy' | 'away' | 'offline') => void;
  getUserStatus: (userId: string) => 'online' | 'busy' | 'away' | 'offline';
  
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
    preloadedMessages: new Map(),
    unreadCounts: new Map(),
    isLoading: false,
    isLoadingMessages: false,
    isLoadingOlderMessages: false,
    hasMoreMessages: true,
    selectedChatId: null,
    onlineUsers: new Set(),
    userStatuses: new Map(),
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
        
        // Update the contactConversationCache with loaded conversations
        const { contactConversationCache } = get();
        const newContactConversationCache = new Map(contactConversationCache);
        
        conversations.forEach(conversation => {
          if (conversation.type === 'private' && conversation.members) {
            // For each member, cache the conversation ID
            conversation.members.forEach(member => {
              newContactConversationCache.set(member.userId, conversation.id);
            });
          }
        });
        
        console.log('💾 Updated contact conversation cache:', Array.from(newContactConversationCache.entries()));
        
        set({ 
          conversations, 
          isLoading: false,
          contactConversationCache: newContactConversationCache 
        });
      } catch (error) {
        console.error('❌ Failed to load conversations:', error);
        set({ isLoading: false });
        throw error;
      }
    },

    // Load messages for a conversation (initial load)
    loadMessages: async (conversationId: string) => {
      try {
        console.log(`🔄 Loading messages for conversation ${conversationId}...`);
        set({ isLoadingMessages: true, hasMoreMessages: true });
        
        // Check if we have preloaded messages first
        const { preloadedMessages } = get();
        if (preloadedMessages.has(conversationId)) {
          console.log(`📦 Using preloaded messages for conversation ${conversationId}`);
          const cachedMessages = preloadedMessages.get(conversationId)!;
          set({ 
            messages: cachedMessages, 
            isLoadingMessages: false,
            hasMoreMessages: cachedMessages.length === 50 // Assume there might be more if we have 50
          });
          return;
        }
        
        // Load most recent messages first (limit 50)
        const messages = await conversationsAPI.getMessages(conversationId, { limit: 50, offset: 0 });
        
        // Backend returns messages in DESC order (newest first), we need to reverse
        // to show oldest first, newest last in UI
        const sortedMessages = messages.reverse();
        
        console.log(`✅ Loaded ${sortedMessages.length} messages`);
        
        // If we got less than 50 messages, there are no more to load
        const hasMore = messages.length === 50;
        
        set({ 
          messages: sortedMessages, 
          isLoadingMessages: false,
          hasMoreMessages: hasMore
        });
      } catch (error) {
        console.error('❌ Failed to load messages:', error);
        set({ messages: [], isLoadingMessages: false, hasMoreMessages: false });
        throw error;
      }
    },

    // Load older messages (for infinite scroll)
    loadOlderMessages: async (conversationId: string) => {
      const { messages, isLoadingOlderMessages, hasMoreMessages } = get();
      
      if (isLoadingOlderMessages || !hasMoreMessages) {
        return;
      }
      
      try {
        console.log(`🔄 Loading older messages for conversation ${conversationId}...`);
        set({ isLoadingOlderMessages: true });
        
        // Load older messages using current messages count as offset
        const olderMessages = await conversationsAPI.getMessages(conversationId, { 
          limit: 50, 
          offset: messages.length 
        });
        
        console.log(`✅ Loaded ${olderMessages.length} older messages`);
        
        if (olderMessages.length > 0) {
          // Backend returns in DESC order, reverse to get oldest first
          const sortedOlderMessages = olderMessages.reverse();
          
          // Prepend older messages to existing messages
          set({ 
            messages: [...sortedOlderMessages, ...messages],
            isLoadingOlderMessages: false,
            hasMoreMessages: olderMessages.length === 50
          });
        } else {
          // No more messages to load
          set({ 
            isLoadingOlderMessages: false,
            hasMoreMessages: false
          });
        }
      } catch (error) {
        console.error('❌ Failed to load older messages:', error);
        set({ isLoadingOlderMessages: false });
        throw error;
      }
    },

    // Select a conversation by ID
    selectConversation: async (conversationId: string, userId?: string) => {
      try {
        const { conversations } = get();
        const conversation = conversations.find(c => c.id === conversationId);
        
        if (conversation) {
          console.log(`🎯 Selected conversation: ${conversationId}`);
          set({ 
            currentConversation: conversation, 
            selectedChatId: conversationId 
          });
          
          // Reset unread count for this conversation
          get().resetUnreadCount(conversationId);
          
          // Load messages for this conversation
          await get().loadMessages(conversationId);
          
          // Mark all unread messages in this conversation as read if userId provided
          if (userId) {
            await get().markAllMessagesAsReadInConversation(conversationId, userId);
          }
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
            // Verificar se esta conversa contém o contato desejado
            const hasContact = conv.members.some(member => member.userId === contactId);
            if (hasContact) {
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
    selectContactConversation: async (contactId: string, contactName: string, userId?: string) => {
      try {
        console.log(`🎯 Selecting conversation for contact ${contactId} (${contactName})`);
        
        const conversationId = await get().getOrCreateConversationWithContact(contactId);
        await get().selectConversation(conversationId, userId);
        
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
        
        console.log('📨 New message received from API:', newMessage);
        
        // Ensure sender is properly set with all required fields
        const messageToAdd = {
          ...newMessage,
          sender: newMessage.sender || {
            id: newMessage.senderId || '',
            name: 'You',
            email: '',
            avatar: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          // Ensure status fields are present
          status: newMessage.status || 'sent',
          statusTimestamp: newMessage.statusTimestamp || new Date().toISOString(),
        };
        
        console.log('💾 Adding message to store:', messageToAdd);
        
        // Add message to local state immediately - prevent duplicates
        const existingMessageIds = messages.map(m => m.id);
        if (!existingMessageIds.includes(messageToAdd.id)) {
          set({ 
            messages: [...messages, messageToAdd]
          });
          console.log('✅ Message added to local state');
        } else {
          console.log('⚠️ Message already exists, skipping');
        }
        
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
      
      // If it's for the current conversation, add to messages
      if (currentConversation && message.conversationId === currentConversation.id) {
        set({ messages: [...messages, message] });
        console.log('📨 New message added to current conversation via Socket.IO');
      } else {
        // Add to preloaded messages for other conversations
        get().addMessageToPreloaded(message);
        console.log('📨 New message added to preloaded for conversation', message.conversationId);
      }
    },

    // Mark message as read
    markMessageAsRead: async (messageId: string) => {
      const { currentConversation, messages } = get();
      
      if (!currentConversation) {
        console.error('❌ No conversation selected');
        return;
      }

      try {
        console.log(`📖 Marking message ${messageId} as read`);
        
        await conversationsAPI.markMessageAsRead(currentConversation.id, messageId);
        
        // Update local message status
        const updatedMessages = messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'read' as const, statusTimestamp: new Date().toISOString() }
            : msg
        );
        
        set({ messages: updatedMessages });
        
        console.log('✅ Message marked as read successfully');
      } catch (error) {
        console.error('❌ Failed to mark message as read:', error);
        throw error;
      }
    },

    // Mark multiple messages as read
    markMultipleMessagesAsRead: async (messageIds: string[]) => {
      const { currentConversation, messages } = get();
      
      if (!currentConversation || messageIds.length === 0) {
        return;
      }

      try {
        console.log(`📖 Marking ${messageIds.length} messages as read`);
        
        // Mark each message as read via API
        const promises = messageIds.map(messageId => 
          conversationsAPI.markMessageAsRead(currentConversation.id, messageId)
        );
        
        await Promise.allSettled(promises);
        
        // Update local message statuses
        const messageIdsSet = new Set(messageIds);
        const updatedMessages = messages.map(msg => 
          messageIdsSet.has(msg.id)
            ? { ...msg, status: 'read' as const, statusTimestamp: new Date().toISOString() }
            : msg
        );
        
        set({ messages: updatedMessages });
        
        console.log('✅ Multiple messages marked as read successfully');
      } catch (error) {
        console.error('❌ Failed to mark multiple messages as read:', error);
        throw error;
      }
    },

    // Mark all messages in a conversation as read
    markAllMessagesAsReadInConversation: async (conversationId: string, userId?: string) => {
      const { preloadedMessages, messages, currentConversation } = get();
      
      // Skip if no userId provided (will be passed from components)
      if (!userId) {
        console.log('⚠️ No userId provided, skipping mark messages as read');
        return;
      }
      
      try {
        console.log(`🎯 markAllMessagesAsReadInConversation called for conversation ${conversationId} by user ${userId}`);
        
        // Get messages from both current conversation AND preloaded messages
        let currentMessages: Message[] = [];
        let preloadedConversationMessages: Message[] = [];
        const isCurrentConversation = currentConversation?.id === conversationId;
        
        if (isCurrentConversation) {
          currentMessages = messages;
          console.log(`📋 Found ${currentMessages.length} messages in current conversation`);
        }
        
        // Always check preloaded messages too
        if (preloadedMessages.has(conversationId)) {
          preloadedConversationMessages = preloadedMessages.get(conversationId) || [];
          console.log(`📦 Found ${preloadedConversationMessages.length} preloaded messages for conversation`);
        }
        
        // Combine all messages and deduplicate by ID
        const allMessages = [...currentMessages, ...preloadedConversationMessages];
        const uniqueMessages = allMessages.filter((message, index, array) => 
          array.findIndex(m => m.id === message.id) === index
        );
        
        console.log(`🔍 Total unique messages to check: ${uniqueMessages.length}`);
        
        // Find unread messages (not sent by current user and not already read)
        const unreadMessages = uniqueMessages.filter(message => {
          // Skip messages sent by current user
          if (message.senderId === userId || message.sender?.id === userId) {
            console.log(`⏭️ Skipping message from current user: ${message.id.substring(0, 8)}`);
            return false;
          }
          // Include messages that are not read yet
          const isUnread = message.status !== 'read';
          console.log(`📋 Message ${message.id.substring(0, 8)}: status='${message.status}', isUnread=${isUnread}`);
          return isUnread;
        });
        
        const unreadMessageIds = unreadMessages.map(message => message.id);
        
        if (unreadMessageIds.length > 0) {
          console.log(`📖 Marking ${unreadMessageIds.length} messages as read in conversation ${conversationId}`);
          console.log(`📖 Message IDs to mark as read:`, unreadMessageIds.map(id => id.substring(0, 8)));
          
          // Mark messages as read via API
          const promises = unreadMessageIds.map(messageId => 
            conversationsAPI.markMessageAsRead(conversationId, messageId)
          );
          await Promise.allSettled(promises);
          
          // Update BOTH current conversation messages AND preloaded messages
          const messageIdsSet = new Set(unreadMessageIds);
          const timestamp = new Date().toISOString();
          
          // Update current conversation messages if applicable
          if (isCurrentConversation && currentMessages.length > 0) {
            const updatedCurrentMessages = currentMessages.map(msg => 
              messageIdsSet.has(msg.id)
                ? { ...msg, status: 'read' as const, statusTimestamp: timestamp }
                : msg
            );
            set({ messages: updatedCurrentMessages });
            console.log(`✅ Updated ${currentMessages.length} current conversation messages`);
          }
          
          // ALWAYS update preloaded messages to keep them in sync
          if (preloadedConversationMessages.length > 0) {
            const updatedPreloadedMessages = new Map(preloadedMessages);
            const updatedMessages = preloadedConversationMessages.map(msg => 
              messageIdsSet.has(msg.id)
                ? { ...msg, status: 'read' as const, statusTimestamp: timestamp }
                : msg
            );
            updatedPreloadedMessages.set(conversationId, updatedMessages);
            set({ preloadedMessages: updatedPreloadedMessages });
            console.log(`✅ Updated ${preloadedConversationMessages.length} preloaded messages`);
          }
          
          console.log('✅ Messages marked as read and ALL local states updated');
        } else {
          console.log('ℹ️ No unread messages found to mark as read');
        }
      } catch (error) {
        console.error('❌ Failed to mark all messages as read:', error);
      }
    },

    // Presence management
    setUserOnline: (userId: string) => {
      const { onlineUsers } = get();
      const newOnlineUsers = new Set(onlineUsers);
      newOnlineUsers.add(userId);
      set({ onlineUsers: newOnlineUsers });
      console.log(`🟢 User ${userId} is now online`);
    },

    setUserOffline: (userId: string) => {
      const { onlineUsers } = get();
      const newOnlineUsers = new Set(onlineUsers);
      newOnlineUsers.delete(userId);
      set({ onlineUsers: newOnlineUsers });
      console.log(`🔴 User ${userId} is now offline`);
    },

    isUserOnline: (userId: string) => {
      const { onlineUsers } = get();
      return onlineUsers.has(userId);
    },
    
    // Status management
    setUserStatus: (userId: string, status: 'online' | 'busy' | 'away' | 'offline') => {
      const { userStatuses } = get();
      const newStatuses = new Map(userStatuses);
      newStatuses.set(userId, status);
      set({ userStatuses: newStatuses });
      console.log(`📊 User ${userId} status updated to: ${status}`);
    },
    
    getUserStatus: (userId: string) => {
      const { userStatuses } = get();
      const status = userStatuses.get(userId) || 'offline'; // Default to offline if no status set
      console.log(`🔍 getUserStatus(${userId}): returning ${status}, statuses map:`, Array.from(userStatuses.entries()));
      return status;
    },

    // Pre-loading functions
    preloadRecentConversations: async () => {
      try {
        console.log('🔄 Preloading recent conversations...');
        const { conversations, preloadedMessages } = get();
        
        // Preload messages for the 5 most recent conversations
        const recentConversations = conversations
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);
        
        const preloadPromises = recentConversations.map(async (conv) => {
          try {
            console.log(`📦 Loading messages for conversation ${conv.id}...`);
            const messages = await conversationsAPI.getMessages(conv.id, { limit: 20, offset: 0 });
            const sortedMessages = messages.reverse();
            
            const { preloadedMessages: currentPreloaded } = get();
            const existingMessages = currentPreloaded.get(conv.id) || [];
            
            // Smart merge: preserve read status from existing messages if they exist
            console.log(`🔥 SMART MERGE DEBUG: Processing ${sortedMessages.length} API messages, ${existingMessages.length} existing messages`);
            
            const mergedMessages = sortedMessages.map(apiMessage => {
              // Check if we already have this message locally
              const existingMessage = existingMessages.find(existing => existing.id === apiMessage.id);
              
              console.log(`🔍 API Message ${apiMessage.id.substring(0, 8)}: status='${apiMessage.status}', existing=${!!existingMessage}`);
              
              if (existingMessage) {
                console.log(`🔍 Existing Message ${apiMessage.id.substring(0, 8)}: status='${existingMessage.status}'`);
                // If the existing message has read status, preserve it
                if (existingMessage.status === 'read' && apiMessage.status !== 'read') {
                  console.log(`🔒 Preserving read status for message ${apiMessage.id.substring(0, 8)}`);
                  return {
                    ...apiMessage,
                    status: 'read',
                    statusTimestamp: existingMessage.statusTimestamp
                  };
                } else {
                  console.log(`⏭️ No preservation needed for message ${apiMessage.id.substring(0, 8)} (existing: ${existingMessage.status}, api: ${apiMessage.status})`);
                }
              } else {
                console.log(`ℹ️ No existing message found for ${apiMessage.id.substring(0, 8)}`);
              }
              
              return apiMessage;
            });
            
            console.log(`🔥 SMART MERGE RESULT: ${mergedMessages.filter(m => m.status === 'read').length} read messages, ${mergedMessages.filter(m => m.status !== 'read').length} unread messages`);
            
            const newPreloadedMessages = new Map(currentPreloaded);
            newPreloadedMessages.set(conv.id, mergedMessages);
            
            set({ preloadedMessages: newPreloadedMessages });
            console.log(`📦 Preloaded ${mergedMessages.length} messages for conversation ${conv.id} (with smart merge)`);
          } catch (error) {
            console.warn(`Failed to preload messages for conversation ${conv.id}:`, error);
          }
        });
        
        await Promise.allSettled(preloadPromises);
        console.log('✅ Recent conversations preload completed with smart merge');
      } catch (error) {
        console.error('❌ Failed to preload recent conversations:', error);
      }
    },
    
    addMessageToPreloaded: (message: Message) => {
      const { preloadedMessages } = get();
      console.log(`🔥 BADGE DEBUG: addMessageToPreloaded called for conversation ${message.conversationId}`);
      console.log(`🔥 BADGE DEBUG: Message sender: ${message.senderId}, status: ${message.status}`);
      
      const newPreloadedMessages = new Map(preloadedMessages);
      
      const conversationMessages = newPreloadedMessages.get(message.conversationId) || [];
      console.log(`🔥 BADGE DEBUG: Current preloaded messages count for conversation: ${conversationMessages.length}`);
      
      // Ensure message has proper status and statusTimestamp
      const messageWithStatus = {
        ...message,
        status: message.status || 'sent', // Default to 'sent' if no status
        statusTimestamp: message.statusTimestamp || message.createdAt || new Date().toISOString(),
      };
      
      const updatedMessages = [...conversationMessages, messageWithStatus];
      
      // Keep only the last 20 messages to avoid memory issues
      const trimmedMessages = updatedMessages.slice(-20);
      newPreloadedMessages.set(message.conversationId, trimmedMessages);
      
      console.log(`🔥 BADGE DEBUG: Updated preloaded messages count for conversation: ${trimmedMessages.length}`);
      console.log(`🔥 BADGE DEBUG: Message added with status: ${messageWithStatus.status}`);
      
      set({ preloadedMessages: newPreloadedMessages });
      console.log(`🔥 BADGE DEBUG: Store updated with new preloaded messages`);
    },
    
    getPreloadedMessages: (conversationId: string) => {
      const { preloadedMessages } = get();
      return preloadedMessages.get(conversationId) || [];
    },
    
    // Unread counter functions
    incrementUnreadCount: (conversationId: string) => {
      const { unreadCounts } = get();
      const newUnreadCounts = new Map(unreadCounts);
      const currentCount = newUnreadCounts.get(conversationId) || 0;
      newUnreadCounts.set(conversationId, currentCount + 1);
      set({ unreadCounts: newUnreadCounts });
      console.log(`📬 Unread count for conversation ${conversationId}: ${currentCount + 1}`);
    },
    
    resetUnreadCount: (conversationId: string) => {
      const { unreadCounts } = get();
      const newUnreadCounts = new Map(unreadCounts);
      newUnreadCounts.set(conversationId, 0);
      set({ unreadCounts: newUnreadCounts });
      console.log(`📭 Reset unread count for conversation ${conversationId}`);
    },
    
    getUnreadCount: (conversationId: string) => {
      const { unreadCounts } = get();
      return unreadCounts.get(conversationId) || 0;
    },

    // Reset store
    reset: () => {
      set({
        contacts: [],
        conversations: [],
        currentConversation: null,
        messages: [],
        preloadedMessages: new Map(),
        unreadCounts: new Map(),
        isLoading: false,
        isLoadingMessages: false,
        isLoadingOlderMessages: false,
        hasMoreMessages: true,
        selectedChatId: null,
        contactConversationCache: new Map(),
      });
      console.log('🧹 Chat store reset');
    },
  }))
);
