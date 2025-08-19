import { useEffect } from 'react';
import { useSocket } from './use-socket';
import { useChatStore } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { Message } from '@/types/chat';

export function useChatSocket() {
  const { token, user } = useAuth();
  const { currentConversation, addMessage } = useChatStore();
  const { 
    socket, 
    isConnected, 
    error, 
    joinConversation, 
    onNewMessage,
    offNewMessage,
  } = useSocket(token);

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

    const handleNewMessage = (data: {
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
      
      // Only add if it's for the current conversation and not from current user
      if (
        currentConversation && 
        data.conversationId === currentConversation.id && 
        data.senderId !== user.id
      ) {
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
        };
        
        addMessage(newMessage);
      }
    };

    onNewMessage(handleNewMessage);

    return () => {
      offNewMessage(handleNewMessage);
    };
  }, [socket, user, currentConversation, addMessage, onNewMessage, offNewMessage]);

  return {
    socket,
    isConnected,
    error,
  };
}
