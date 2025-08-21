import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { db, users, conversationMembers, contacts } from '../lib/db';
import { eq, and, or } from 'drizzle-orm';
import { PresenceManager } from '../lib/redis';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Configure this properly in production
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token.replace('Bearer ', ''), jwtSecret) as { userId: string };
        
        // Get user from database
        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        (socket as any).userId = user.id;
        (socket as any).user = user;
        
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`User ${authSocket.user.name} connected with socket ${socket.id}`);

      // Handle user going online
      this.handleUserOnline(authSocket);

      // Message events
      socket.on('message:send', (data) => this.handleMessageSend(authSocket, data));
      socket.on('message:delivered', (data) => this.handleMessageDelivered(authSocket, data));
      socket.on('message:read', (data) => this.handleMessageRead(authSocket, data));

      // Reaction events
      socket.on('reaction:add', (data) => this.handleReactionAdd(authSocket, data));
      socket.on('reaction:remove', (data) => this.handleReactionRemove(authSocket, data));

      // Conversation events
      socket.on('conversation:join', (data) => this.handleConversationJoin(authSocket, data));
      socket.on('conversation:leave', (data) => this.handleConversationLeave(authSocket, data));

      // Typing events
      socket.on('typing:start', (data) => this.handleTypingStart(authSocket, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(authSocket, data));

      // Disconnection
      socket.on('disconnect', () => this.handleUserOffline(authSocket));
    });
  }

  private async handleUserOnline(socket: AuthenticatedSocket) {
    const { userId } = socket;
    
    // Update Redis presence
    await PresenceManager.setUserOnline(userId, socket.id);
    
    // Update database
    await db
      .update(users)
      .set({
        isOnline: true,
        lastSeen: new Date(),
      })
      .where(eq(users.id, userId));

    // Store connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their conversation rooms
    await this.joinUserConversations(socket);

    // Broadcast presence to contacts
    await this.broadcastPresenceUpdate(userId, true);
    
    console.log(`User ${socket.user.name} (${userId}) is now online`);
  }

  private async handleUserOffline(socket: AuthenticatedSocket) {
    const { userId } = socket;
    
    // Update Redis presence
    await PresenceManager.setUserOffline(userId);
    
    // Update database
    await db
      .update(users)
      .set({
        isOnline: false,
        lastSeen: new Date(),
      })
      .where(eq(users.id, userId));

    // Remove connection
    this.connectedUsers.delete(userId);

    // Broadcast presence to contacts
    await this.broadcastPresenceUpdate(userId, false);

    console.log(`User ${socket.user.name} (${userId}) disconnected`);
  }

  private async joinUserConversations(socket: AuthenticatedSocket) {
    try {
      // Get user's conversations
      const conversations = await db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(and(
          eq(conversationMembers.userId, socket.userId),
          eq(conversationMembers.leftAt, null)
        ));

      // Join conversation rooms
      conversations.forEach(({ conversationId }) => {
        socket.join(`conversation:${conversationId}`);
      });
    } catch (error) {
      console.error('Error joining user conversations:', error);
    }
  }

  private async broadcastPresenceUpdate(userId: string, isOnline: boolean) {
    try {
      console.log(`Broadcasting presence update: User ${userId} is ${isOnline ? 'online' : 'offline'}`);
      
      // Get all users who have this user as a contact (both ways)
      const contactRelations = await db
        .select({ 
          userId: contacts.userId,
          contactId: contacts.contactId 
        })
        .from(contacts)
        .where(or(
          eq(contacts.userId, userId),        // People who this user added
          eq(contacts.contactId, userId)      // People who added this user
        ));

      // Create a set of unique user IDs who should receive the presence update
      const usersToNotify = new Set<string>();
      
      contactRelations.forEach(({ userId: contactUserId, contactId }) => {
        if (contactUserId === userId) {
          // This user added someone, notify that someone
          usersToNotify.add(contactId);
        } else {
          // Someone added this user, notify that someone
          usersToNotify.add(contactUserId);
        }
      });

      console.log(`Notifying ${usersToNotify.size} contacts about user ${userId} presence`);

      // Emit to all contacts who are online
      usersToNotify.forEach((contactUserId) => {
        const contactSocketId = this.connectedUsers.get(contactUserId);
        if (contactSocketId) {
          console.log(`Sending presence update to contact ${contactUserId} via socket ${contactSocketId}`);
          this.io.to(contactSocketId).emit('presence:update', {
            userId,
            isOnline,
            lastSeen: new Date().toISOString(),
          });
        } else {
          console.log(`Contact ${contactUserId} is not online, skipping notification`);
        }
      });

      // Also broadcast globally for now (for debugging - remove in production)
      this.io.emit('presence:update', {
        userId,
        isOnline,
        lastSeen: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error broadcasting presence update:', error);
    }
  }

  private handleMessageSend(socket: AuthenticatedSocket, data: any) {
    const { conversationId, messageId } = data;
    
    // Broadcast to conversation members
    socket.to(`conversation:${conversationId}`).emit('message:new', {
      messageId,
      conversationId,
      senderId: socket.userId,
      ...data,
    });
  }

  private handleMessageDelivered(socket: AuthenticatedSocket, data: any) {
    const { messageId, conversationId } = data;
    
    // Broadcast delivery status to conversation
    socket.to(`conversation:${conversationId}`).emit('message:delivered', {
      messageId,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });
  }

  private handleMessageRead(socket: AuthenticatedSocket, data: any) {
    const { messageId, conversationId } = data;
    
    // Broadcast read status to conversation
    socket.to(`conversation:${conversationId}`).emit('message:read', {
      messageId,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });
  }

  private handleReactionAdd(socket: AuthenticatedSocket, data: any) {
    const { messageId, conversationId, emoji, reactionId } = data;
    
    socket.to(`conversation:${conversationId}`).emit('reaction:added', {
      messageId,
      reactionId,
      emoji,
      userId: socket.userId,
      userName: socket.user.name,
      timestamp: new Date().toISOString(),
    });
  }

  private handleReactionRemove(socket: AuthenticatedSocket, data: any) {
    const { messageId, conversationId, reactionId } = data;
    
    socket.to(`conversation:${conversationId}`).emit('reaction:removed', {
      messageId,
      reactionId,
      userId: socket.userId,
    });
  }

  private handleConversationJoin(socket: AuthenticatedSocket, data: any) {
    const { conversationId } = data;
    socket.join(`conversation:${conversationId}`);
  }

  private handleConversationLeave(socket: AuthenticatedSocket, data: any) {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
  }

  private handleTypingStart(socket: AuthenticatedSocket, data: any) {
    const { conversationId } = data;
    
    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      userId: socket.userId,
      userName: socket.user.name,
      conversationId,
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, data: any) {
    const { conversationId } = data;
    
    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      userId: socket.userId,
      conversationId,
    });
  }

  // Public methods for emitting events from REST API
  public emitToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public async emitToConversationMembers(conversationId: string, event: string, data: any, excludeUserId?: string) {
    try {
      const members = await db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.leftAt, null)
        ));

      members.forEach(({ userId }) => {
        if (excludeUserId && userId === excludeUserId) return;
        
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
          this.io.to(socketId).emit(event, data);
        }
      });
    } catch (error) {
      console.error('Error emitting to conversation members:', error);
    }
  }

  public getConnectedUsers(): Map<string, string> {
    return this.connectedUsers;
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Method to get all online users (for debugging)
  public getOnlineUsersList(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}

// Singleton instance
let socketService: SocketService | null = null;

export function initializeSocketService(server: HttpServer): SocketService {
  if (socketService) {
    return socketService;
  }
  
  socketService = new SocketService(server);
  return socketService;
}

export function getSocketService(): SocketService | null {
  return socketService;
}
