import { useEffect } from 'react';
import { useSocket } from './use-socket';
import { usePresenceSync } from './use-presence-sync';
import { useWindowCloseDetection } from './use-window-close-detection';
import { useMessageStatusSync } from './use-message-status-sync';
import { useChatStore } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@/types/chat';

export function useChatSocket() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const { 
    currentConversation, 
    addMessage, 
    setUserOnline, 
    setUserOffline, 
    setUserStatus, 
    messages,
    preloadRecentConversations,
    getPreloadedMessages,
    incrementUnreadCount,
    loadContacts 
  } = useChatStore();
  const { 
    socket, 
    isConnected, 
    error, 
    joinConversation, 
    onNewMessage,
    offNewMessage,
    onPresenceUpdate,
  } = useSocket(token);

  // Sync presence status on connection
  const { syncPresenceStatus } = usePresenceSync(isConnected);

  // Detect window close and notify server
  useWindowCloseDetection();

  // Sync message status periodically and on conversation changes
  useMessageStatusSync();

  // Join conversation room when currentConversation changes
  useEffect(() => {
    if (socket && isConnected && currentConversation) {
      joinConversation(currentConversation.id);
      console.log(`🏠 Joined conversation room: ${currentConversation.id}`);
    }
  }, [socket, isConnected, currentConversation, joinConversation]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = async (data: {
      messageId: string;
      conversationId: string;
      senderId: string;
      senderName: string;
      senderAvatar?: string;
      content: string;
      type: string;
      createdAt: string;
    }) => {
      console.log('📨 New message received via Socket.IO:', data);
      console.log('🔍 Debug conditions:');
      console.log('  - Current conversation:', currentConversation?.id);
      console.log('  - Message conversation:', data.conversationId);
      console.log('  - Current user:', user.id);
      console.log('  - Message sender:', data.senderId);
      console.log('  - Has current conversation:', !!currentConversation);
      console.log('  - Is same conversation:', currentConversation?.id === data.conversationId);
      console.log('  - Is not from self:', data.senderId !== user.id);
      
      const newMessage: Message = {
        id: data.messageId,
        content: data.content,
        type: data.type as any,
        conversationId: data.conversationId,
        senderId: data.senderId,
        sender: {
          id: data.senderId,
          name: data.senderName || 'Unknown',
          email: '', // Not provided by socket event
          avatar: data.senderAvatar || '',
          createdAt: '', // Not provided by socket event
          updatedAt: '', // Not provided by socket event
        },
        createdAt: data.createdAt,
        updatedAt: data.createdAt,
        // Add default status for new messages
        status: 'sent', // Default status for incoming messages
        statusTimestamp: data.createdAt,
      };
      
      // Always add message to store (will handle current vs preloaded internally)
      console.log('🎯 Adding message to store...');
      addMessage(newMessage);
      console.log('✅ Message added to store');
      
      // Auto-mark as delivered for messages from other users
      if (data.senderId !== user.id) {
        console.log('✅ Auto-marking message as delivered (user is online)');
        try {
          const { conversationsAPI } = await import('@/lib/api');
          await conversationsAPI.markMessageAsDelivered(data.conversationId, data.messageId);
          console.log('📨 Auto-marked message as delivered');
        } catch (error) {
          console.warn('Failed to auto-mark message as delivered:', error);
        }
        
        // Increment unread count if message is not for the current conversation
        if (!currentConversation || data.conversationId !== currentConversation.id) {
          console.log(`🔥 BADGE DEBUG: Message is not for current conversation, should increment badge`);
          console.log(`🔥 BADGE DEBUG: currentConversation?.id = ${currentConversation?.id}`);
          console.log(`🔥 BADGE DEBUG: data.conversationId = ${data.conversationId}`);
          incrementUnreadCount(data.conversationId);
          console.log(`📬 Incremented unread count for conversation ${data.conversationId}`);
        } else {
          console.log(`🔥 BADGE DEBUG: Message IS for current conversation, NOT incrementing badge`);
        }
      } else {
        console.log(`🔥 BADGE DEBUG: Message is from current user (${user.id}), NOT incrementing badge`);
      }
    };

    onNewMessage(handleNewMessage);

    return () => {
      offNewMessage(handleNewMessage);
    };
  }, [socket, user, currentConversation, addMessage, onNewMessage, offNewMessage]);

  // Listen for presence updates
  useEffect(() => {
    if (!socket || !user) return;

    const handlePresenceUpdate = (data: {
      userId: string;
      isOnline: boolean;
      lastSeen: string;
    }) => {
      console.log(`👤 Presence update received:`, data);
      console.log(`👤 User ${data.userId} is ${data.isOnline ? 'online' : 'offline'}`);
      
      if (data.isOnline) {
        setUserOnline(data.userId);
        // Don't override status - user may be busy/away while online
        // Only set to online if currently offline
        const currentStatus = useChatStore.getState().getUserStatus(data.userId);
        if (currentStatus === 'offline') {
          setUserStatus(data.userId, 'online');
        }
      } else {
        setUserOffline(data.userId);
        setUserStatus(data.userId, 'offline');
      }
    };

    onPresenceUpdate(handlePresenceUpdate);

    return () => {
      // onPresenceUpdate doesn't have an off function in current implementation
      // This would need to be added to useSocket hook if needed
    };
  }, [socket, user, setUserOnline, setUserOffline, setUserStatus, onPresenceUpdate]);

  // Listen for status updates
  useEffect(() => {
    if (!socket || !user) return;

    const handleStatusUpdate = (data: {
      userId: string;
      status: 'online' | 'busy' | 'away' | 'offline';
      timestamp: string;
    }) => {
      console.log(`📶 Status update received:`, data);
      console.log(`📶 User ${data.userId} status changed to: ${data.status}`);
      
      // Update user status in store
      setUserStatus(data.userId, data.status);
    };

    socket.on('status:update', handleStatusUpdate);

    return () => {
      socket.off('status:update', handleStatusUpdate);
    };
  }, [socket, user, setUserStatus]);

  // Listen for message delivery status updates
  useEffect(() => {
    if (!socket || !user) return;

    const handleMessageDelivered = (data: {
      messageId: string;
      userId: string;
      timestamp: string;
    }) => {
      console.log('📨 Message delivered event received:', data);
      
      // Update message status in store if it's in current conversation
      if (currentConversation) {
        const currentMessages = useChatStore.getState().messages;
        const updatedMessages = currentMessages.map(msg => {
          // Only update status for messages sent by current user
          if (msg.id === data.messageId && msg.sender?.id === user.id) {
            // Only upgrade from sent to delivered, not downgrade from read
            if (msg.status === 'sent' || msg.status === null) {
              console.log(`📨 Upgrading message ${msg.id} status to delivered`);
              return { ...msg, status: 'delivered' as const, statusTimestamp: data.timestamp };
            }
          }
          return msg;
        });
        
        useChatStore.setState({ messages: updatedMessages });
      }
    };

    const handleMessageRead = (data: {
      messageId: string;
      userId: string;
      timestamp: string;
    }) => {
      console.log('📖 Message read event received:', data);
      
      // Update message status in store if it's in current conversation
      if (currentConversation) {
        const currentMessages = useChatStore.getState().messages;
        const updatedMessages = currentMessages.map(msg => {
          // Only update status for messages sent by current user
          if (msg.id === data.messageId && msg.sender?.id === user.id) {
            console.log(`📖 Upgrading message ${msg.id} status to read`);
            return { ...msg, status: 'read' as const, statusTimestamp: data.timestamp };
          }
          return msg;
        });
        
        useChatStore.setState({ messages: updatedMessages });
      }
    };

    socket.on('message:delivered', handleMessageDelivered);
    socket.on('message:read', handleMessageRead);

    return () => {
      socket.off('message:delivered', handleMessageDelivered);
      socket.off('message:read', handleMessageRead);
    };
  }, [socket, user, currentConversation]);

  // Listen for friend request events
  useEffect(() => {
    if (!socket || !user) return;

    const handleFriendRequestAccepted = (data: {
      id: string;
      status: string;
      acceptedBy: {
        id: string;
        username: string;
        name: string;
        avatar: string | null;
      };
    }) => {
      console.log('🤝 Friend request accepted:', data);
      // Show toast notification
      toast({
        title: 'Friend request accepted!',
        description: `${data.acceptedBy.name} accepted your friend request`,
      });
    };

    const handleFriendRequestRejected = (data: {
      id: string;
      status: string;
      rejectedBy: {
        id: string;
        username: string;
        name: string;
      };
    }) => {
      console.log('❌ Friend request rejected:', data);
      // Show toast notification
      toast({
        title: 'Friend request rejected',
        description: `${data.rejectedBy.name} rejected your friend request`,
        variant: 'destructive',
      });
    };

    const handleContactAdded = (data: {
      contact: {
        id: string;
        username: string;
        name: string;
        avatar: string | null;
      };
    }) => {
      console.log('👤 New contact added:', data);
      // Reload contacts to show the new contact
      loadContacts().catch(console.error);
      // Show toast notification
      toast({
        title: 'New contact added!',
        description: `${data.contact.name} is now your contact`,
      });
    };

    const handleFriendRequestReceived = (data: {
      id: string;
      status: string;
      message: string | null;
      createdAt: string;
      sender: {
        id: string;
        username: string;
        name: string;
        avatar: string | null;
      };
    }) => {
      console.log('📩 Friend request received:', data);
      // Show toast notification
      toast({
        title: 'New friend request!',
        description: `${data.sender.name} sent you a friend request`,
      });
    };

    socket.on('friend_request:accepted', handleFriendRequestAccepted);
    socket.on('friend_request:rejected', handleFriendRequestRejected);
    socket.on('contact:added', handleContactAdded);
    socket.on('friend_request:received', handleFriendRequestReceived);

    return () => {
      socket.off('friend_request:accepted', handleFriendRequestAccepted);
      socket.off('friend_request:rejected', handleFriendRequestRejected);
      socket.off('contact:added', handleContactAdded);
      socket.off('friend_request:received', handleFriendRequestReceived);
    };
  }, [socket, user, loadContacts, toast]);

  return {
    socket,
    isConnected,
    error,
  };
}
