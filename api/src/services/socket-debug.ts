import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SimpleSocketService {
  private io: SocketIOServer;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Configure this properly in production
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 Socket connected: ${socket.id}`);

      // Test conversation join
      socket.on('conversation:join', (data) => {
        const { conversationId } = data;
        socket.join(`conversation:${conversationId}`);
        console.log(`📨 Socket ${socket.id} joined conversation:${conversationId}`);
      });

      // Test message sending
      socket.on('test-message', (data) => {
        console.log('🧪 Test message received:', data);
        socket.broadcast.emit('message:new', {
          messageId: 'test-' + Date.now(),
          content: data.content,
          senderId: 'test-user',
          senderName: 'Test User',
          conversationId: 'test-room-123',
          createdAt: data.timestamp,
        });
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      });
    });
  }

  // Public method for emitting events from REST API
  public emitToConversation(conversationId: string, event: string, data: any) {
    console.log(`📡 Emitting ${event} to conversation:${conversationId}:`, data);
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public async emitToConversationMembers(conversationId: string, event: string, data: any, excludeUserId?: string) {
    console.log(`📡 Broadcasting ${event} to conversation ${conversationId}, excluding ${excludeUserId}:`, data);
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

// Singleton instance
let simpleSocketService: SimpleSocketService | null = null;

export function initializeSimpleSocketService(server: HttpServer): SimpleSocketService {
  if (simpleSocketService) {
    return simpleSocketService;
  }
  
  simpleSocketService = new SimpleSocketService(server);
  return simpleSocketService;
}

export function getSimpleSocketService(): SimpleSocketService | null {
  return simpleSocketService;
}
