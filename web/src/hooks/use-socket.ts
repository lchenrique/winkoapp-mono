import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@/types/chat';

const SOCKET_URL = 'http://localhost:3000';

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    console.log('🔌 Connecting to Socket.IO server...');

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      autoConnect: true,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error);
      setError(error.message);
      setIsConnected(false);
    });

    // Cleanup on unmount or token change
    return () => {
      if (socket) {
        console.log('🔌 Disconnecting socket...');
        socket.disconnect();
      }
    };
  }, [token]);

  // Helper functions
  const joinConversation = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('conversation:join', { conversationId });
      console.log(`🏠 Joined conversation room: ${conversationId}`);
    }
  };

  const leaveConversation = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('conversation:leave', { conversationId });
      console.log(`🚪 Left conversation room: ${conversationId}`);
    }
  };

  const onNewMessage = (callback: SocketEvents['message:new']) => {
    if (socketRef.current) {
      socketRef.current.on('message:new', callback);
    }
  };

  const offNewMessage = (callback: SocketEvents['message:new']) => {
    if (socketRef.current) {
      socketRef.current.off('message:new', callback);
    }
  };

  const onTypingStart = (callback: SocketEvents['typing:start']) => {
    if (socketRef.current) {
      socketRef.current.on('typing:start', callback);
    }
  };

  const onTypingStop = (callback: SocketEvents['typing:stop']) => {
    if (socketRef.current) {
      socketRef.current.on('typing:stop', callback);
    }
  };

  const onPresenceUpdate = (callback: SocketEvents['presence:update']) => {
    if (socketRef.current) {
      socketRef.current.on('presence:update', callback);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinConversation,
    leaveConversation,
    onNewMessage,
    offNewMessage,
    onTypingStart,
    onTypingStop,
    onPresenceUpdate,
  };
}
