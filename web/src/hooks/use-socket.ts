import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@/types/chat';

const SOCKET_URL = 'http://localhost:3000';

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    console.log('🔌 Connecting to Socket.IO server...');

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      extraHeaders: {
        authorization: `Bearer ${token}`,
      },
      autoConnect: true,
      forceNew: true, // Force new connection to avoid cached issues
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      setIsConnected(true);
      setError(null);
      
      // Setup heartbeat monitoring
      setupHeartbeat(socket);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO:', reason);
      setIsConnected(false);
      
      // Clear heartbeat on disconnect
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error);
      setError(error.message);
      setIsConnected(false);
    });

    // Heartbeat events
    socket.on('ping', (data) => {
      console.log('🏓 Received ping from server');
      socket.emit('pong', { timestamp: Date.now() });
      setLastHeartbeat(Date.now());
    });
    
    socket.on('pong', (data) => {
      console.log('🏓 Received pong from server');
      setLastHeartbeat(Date.now());
    });

    // Cleanup on unmount or token change
    return () => {
      if (socket) {
        console.log('🔌 Disconnecting socket...');
        socket.disconnect();
      }
    };
  }, [token]);

  // Heartbeat setup function
  const setupHeartbeat = (socket: Socket) => {
    // Clear existing heartbeat if any
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    // Setup client-side heartbeat monitoring
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        // Send ping to server
        socket.emit('ping', { timestamp: Date.now() });
        
        // Check if we've received a recent heartbeat
        const now = Date.now();
        const timeSinceLastHeartbeat = now - lastHeartbeat;
        
        // If no heartbeat in 45 seconds, consider connection stale
        if (timeSinceLastHeartbeat > 45000 && lastHeartbeat > 0) {
          console.warn('⚠️ No heartbeat received, connection may be stale');
          // Optionally trigger a reconnection
        }
      }
    }, 20000); // Every 20 seconds
  };

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
