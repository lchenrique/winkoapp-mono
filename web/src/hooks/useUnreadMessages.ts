import { useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadMessages() {
  const { user } = useAuth();
  const { conversations, preloadedMessages, currentConversation } = useChatStore();

  // Calculate unread count for each conversation
  const unreadCounts = useMemo(() => {
    if (!user) {
      console.log('🚫 useUnreadMessages: No user found');
      return new Map<string, number>();
    }

    console.log('🔄 useUnreadMessages: Recalculating badges...', {
      userId: user.id,
      conversationsCount: conversations.length,
      preloadedMessagesCount: preloadedMessages.size,
      currentConversation: currentConversation?.id
    });

    const counts = new Map<string, number>();

    conversations.forEach((conversation) => {
      // Skip current open conversation (messages there are considered "read")
      if (currentConversation?.id === conversation.id) {
        console.log(`⏭️ Skipping current conversation: ${conversation.id}`);
        counts.set(conversation.id, 0);
        return;
      }

      // Get messages for this conversation
      const messages = preloadedMessages.get(conversation.id) || [];
      console.log(`📨 Conversation ${conversation.id}:`, {
        messagesCount: messages.length,
        messages: messages.map(m => ({
          id: m.id.substring(0, 8),
          senderId: m.senderId?.substring(0, 8),
          senderName: m.sender?.name,
          status: m.status,
          isFromCurrentUser: (m.senderId === user.id || m.sender?.id === user.id)
        }))
      });
      
      // Count messages that are not read (using reduce approach)
      const unreadCount = messages.reduce((acc, message) => {
        // Skip messages sent by current user
        if (message.senderId === user.id || message.sender?.id === user.id) {
          return acc;
        }
        
        // Count messages that are not read by current user
        // If status is NOT 'read', it means current user hasn't read it yet
        const isUnread = message.status !== 'read';
        console.log(`📋 Message ${message.id.substring(0, 8)}: status=${message.status}, isUnread=${isUnread}`);
        
        return isUnread ? acc + 1 : acc;
      }, 0);
      console.log(`🔢 Conversation ${conversation.id}: ${unreadCount} unread messages`);
      counts.set(conversation.id, unreadCount);
    });

    console.log('📊 Final unread counts:', Array.from(counts.entries()));
    return counts;
  }, [conversations, preloadedMessages, currentConversation, user]);

  // Get unread count for a specific conversation
  const getUnreadCount = (conversationId: string): number => {
    return unreadCounts.get(conversationId) || 0;
  };

  // Get total unread count across all conversations
  const getTotalUnreadCount = (): number => {
    return Array.from(unreadCounts.values()).reduce((total, count) => total + count, 0);
  };

  // Check if a conversation has unread messages
  const hasUnreadMessages = (conversationId: string): boolean => {
    return getUnreadCount(conversationId) > 0;
  };

  return {
    unreadCounts,
    getUnreadCount,
    getTotalUnreadCount,
    hasUnreadMessages,
  };
}

export default useUnreadMessages;
