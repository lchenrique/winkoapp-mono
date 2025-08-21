import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { db, users, conversationMembers, contacts } from '../lib/db';
import { eq, and, or, isNull } from 'drizzle-orm';
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
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map(); // socketId -> interval

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Configure this properly in production
        methods: ["GET", "POST"]
      },
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupRoutine();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        console.log('🔐 Socket.IO authentication attempt for socket:', socket.id);
        
        // Try to get token from different sources
        let token = socket.handshake.auth.token;
        if (!token) {
          const authHeader = socket.handshake.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }
        }
        
        console.log('🎫 Token found:', token ? 'Yes' : 'No');
        
        if (!token) {
          console.log('❌ No token provided');
          return next(new Error('Authentication error: No token provided'));
        }

        // Use same JWT secret as Fastify
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
        console.log('🔑 Using JWT secret from env');
        
        // Clean token (remove Bearer prefix if present)
        const cleanToken = token.replace('Bearer ', '');
        const decoded = jwt.verify(cleanToken, jwtSecret) as { userId: string };
        
        console.log('✅ Token decoded, userId:', decoded.userId);
        
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
          console.log('❌ User not found in database:', decoded.userId);
          return next(new Error('Authentication error: User not found'));
        }

        console.log('👤 User authenticated:', user.name);
        (socket as any).userId = user.id;
        (socket as any).user = user;
        
        next();
      } catch (error) {
        console.error('❌ Socket authentication error:', error);
        next(new Error(`Authentication error: ${error instanceof Error ? error.message : 'Invalid token'}`));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`User ${authSocket.user.name} connected with socket ${socket.id}`);

      // Handle user going online
      this.handleUserOnline(authSocket);

      // Setup heartbeat
      this.setupHeartbeat(authSocket);

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

      // Heartbeat events
      socket.on('ping', () => this.handlePing(authSocket));
      socket.on('pong', () => this.handlePong(authSocket));

      // Disconnection
      socket.on('disconnect', () => this.handleUserOffline(authSocket));
    });
  }

  private async handleUserOnline(socket: AuthenticatedSocket) {
    const { userId } = socket;
    const deviceId = socket.handshake.headers['user-agent'] || `device-${socket.id}`;
    
    // Add connection using new PresenceManager
    const wasOffline = !(await PresenceManager.isUserOnline(userId));
    await PresenceManager.addUserConnection(userId, socket.id, deviceId, socket.handshake.headers['user-agent']);
    
    // Store connection locally
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);

    // Join user to their conversation rooms
    await this.joinUserConversations(socket);

    // Cache user contacts for faster broadcasting
    await this.cacheUserContacts(userId);

    // Only broadcast if user was offline (avoid spam when multiple devices connect)
    if (wasOffline) {
      // Update database - SET STATUS TO ONLINE when connecting (unless manually set to offline)
      const [currentUser] = await db
        .select({ userStatus: users.userStatus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const shouldSetOnline = !currentUser || currentUser.userStatus === 'offline';
      
      await db
        .update(users)
        .set({
          isOnline: true,
          lastSeen: new Date(),
          // CRITICAL: Set status to online when connecting (unless they manually chose offline)
          ...(shouldSetOnline ? { userStatus: 'online' } : {})
        })
        .where(eq(users.id, userId));
      
      console.log(`📊 StatusFix: User ${socket.user.name} connected - status set to ${shouldSetOnline ? 'online' : 'preserved'}`);

      // Broadcast presence to contacts
      await this.broadcastPresenceUpdateOptimized(userId, true);
    }
    
    console.log(`User ${socket.user.name} (${userId}) connected with device ${deviceId}`);
  }

  private async handleUserOffline(socket: AuthenticatedSocket) {
    const { userId } = socket;
    
    console.log(`🔄 User ${socket.user.name} (${userId}) disconnecting from socket ${socket.id}`);
    
    // 1. Remove connection locally (ÚNICA FONTE para Socket.IO)
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        console.log(`📱 User ${userId} has NO MORE socket connections`);
      } else {
        console.log(`📱 User ${userId} still has ${userSockets.size} other connections`);
      }
    }

    // 2. Clean up Redis and heartbeat
    await PresenceManager.removeUserConnection(userId, socket.id);
    this.clearHeartbeat(socket.id);

    // 3. Update database isOnline field for StatusService consistency
    const isStillConnected = this.connectedUsers.has(userId);
    await db
      .update(users)
      .set({
        isOnline: isStillConnected,
        lastSeen: new Date(),
        // DO NOT touch userStatus - let user keep their manual choice
        // StatusService will calculate effective status based on isConnected + userStatus
      })
      .where(eq(users.id, userId));

    console.log(`📊 StatusService: Updated isOnline=${isStillConnected} for ${socket.user.name}`);

    // 4. Broadcast using StatusService with RECONNECTION PROTECTION
    if (!isStillConnected) {
      // ANTI-FLICKER: Wait a bit before broadcasting offline
      // This prevents the offline->online flicker when user refreshes page
      console.log(`⏱️ Anti-flicker: Waiting 2 seconds before broadcasting offline for ${socket.user.name}`);
      
      setTimeout(async () => {
        // Double-check if user is still disconnected after the delay
        const stillDisconnected = !this.connectedUsers.has(userId);
        
        if (stillDisconnected) {
          // Import StatusService here to avoid circular dependency
          const { StatusService } = await import('./status-service');
          const effectiveStatus = await StatusService.getEffectiveUserStatus(userId);
          
          if (effectiveStatus) {
            console.log(`📡 Broadcasting offline after delay: ${effectiveStatus.status} for ${socket.user.name}`);
            await this.broadcastPresenceUpdateOptimized(userId, effectiveStatus.isConnected);
            await this.broadcastStatusUpdate(userId, effectiveStatus.status);
          }
        } else {
          console.log(`🔄 User ${socket.user.name} reconnected during delay - skipping offline broadcast`);
        }
      }, 2000); // 2 second delay
    }
    
    console.log(`✅ User ${socket.user.name} (${userId}) disconnection handled`);
  }

  private async joinUserConversations(socket: AuthenticatedSocket) {
    try {
      console.log(`🔍 Debug: Looking for conversations for user ${socket.user.name} (${socket.userId})`);
      
      // First, let's see ALL conversation memberships for this user
      const allUserMemberships = await db
        .select({ 
          conversationId: conversationMembers.conversationId,
          leftAt: conversationMembers.leftAt,
          joinedAt: conversationMembers.joinedAt
        })
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, socket.userId));
      
      console.log(`🔍 ALL memberships for user ${socket.userId}:`, allUserMemberships);
      
      // Get user's active conversations
      const conversations = await db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(and(
          eq(conversationMembers.userId, socket.userId),
          isNull(conversationMembers.leftAt)
        ));

      console.log(`🏠 User ${socket.user.name} joining ${conversations.length} conversation rooms`);

      // Join conversation rooms
      conversations.forEach(({ conversationId }) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`🚪 Joined room: conversation:${conversationId}`);
      });
      
      console.log(`✅ User ${socket.user.name} successfully joined all conversation rooms`);
    } catch (error) {
      console.error('❌ Error joining user conversations:', error);
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

      
    } catch (error) {
      console.error('Error broadcasting presence update:', error);
    }
  }

  private handleMessageSend(socket: AuthenticatedSocket, data: any) {
    const { conversationId, messageId } = data;
    
    console.log(`📨 Handling message send from ${socket.user.name} (${socket.userId}) to conversation ${conversationId}`);
    
    const messageData = {
      messageId,
      conversationId,
      senderId: socket.userId,
      senderName: socket.user.name,
      senderAvatar: socket.user.avatar || '',
      ...data,
    };
    
    // Broadcast to conversation members (excluding sender)
    socket.to(`conversation:${conversationId}`).emit('message:new', messageData);
    
    console.log(`📤 Broadcasted message to conversation:${conversationId}`);
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
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  public async emitToConversationMembers(conversationId: string, event: string, data: any, excludeUserId?: string) {
    try {
      console.log(`📤 Emitting ${event} to members of conversation ${conversationId}, excluding ${excludeUserId || 'none'}`);
      
      // First, let's check ALL members in this conversation (including those who left)
      const allMembers = await db
        .select({ 
          userId: conversationMembers.userId,
          leftAt: conversationMembers.leftAt,
          joinedAt: conversationMembers.joinedAt
        })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, conversationId));
      
      console.log(`🔍 ALL members in conversation ${conversationId}:`, allMembers);
      
      const members = await db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(and(
          eq(conversationMembers.conversationId, conversationId),
          isNull(conversationMembers.leftAt)
        ));

      console.log(`👥 Found ${members.length} active members in conversation ${conversationId}:`, members.map(m => m.userId));
      
      let sentCount = 0;
      const deliveredToUsers: string[] = [];
      
      members.forEach(({ userId }) => {
        if (excludeUserId && userId === excludeUserId) {
          console.log(`⏭️ Skipping sender ${userId}`);
          return;
        }
        
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets && userSockets.size > 0) {
          userSockets.forEach(socketId => {
            this.io.to(socketId).emit(event, data);
            console.log(`📨 Sent ${event} to user ${userId} via socket ${socketId}`);
            sentCount++;
          });
          
          // Add to delivered list for auto-delivery
          if (event === 'message:new' && data.messageId) {
            deliveredToUsers.push(userId);
          }
        } else {
          console.log(`🚫 User ${userId} is not connected, skipping`);
        }
      });
      
      console.log(`✅ Successfully emitted ${event} to ${sentCount} socket connections`);
      
      // Auto-mark as delivered for online recipients when it's a new message
      if (event === 'message:new' && data.messageId && deliveredToUsers.length > 0) {
        await this.autoMarkAsDelivered(data.messageId, conversationId, deliveredToUsers);
      }
    } catch (error) {
      console.error('❌ Error emitting to conversation members:', error);
    }
  }

  public getConnectedUsers(): Map<string, Set<string>> {
    return this.connectedUsers;
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Method to get all online users (for debugging)
  public getOnlineUsersList(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Heartbeat methods
  private setupHeartbeat(socket: AuthenticatedSocket) {
    const interval = setInterval(async () => {
      // Send ping to client
      socket.emit('ping', { timestamp: Date.now() });
      
      // Update heartbeat in Redis
      await PresenceManager.updateHeartbeat(socket.userId, socket.id);
    }, 10000); // Every 10 seconds (reduced)
    
    this.heartbeatIntervals.set(socket.id, interval);
  }

  private clearHeartbeat(socketId: string) {
    const interval = this.heartbeatIntervals.get(socketId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(socketId);
    }
  }

  private handlePing(socket: AuthenticatedSocket) {
    // Client sent ping, respond with pong
    socket.emit('pong', { timestamp: Date.now() });
  }

  private async handlePong(socket: AuthenticatedSocket) {
    // Client responded to our ping, update heartbeat
    await PresenceManager.updateHeartbeat(socket.userId, socket.id);
  }

  // Cache user contacts for faster presence broadcasting
  private async cacheUserContacts(userId: string) {
    try {
      // Get both directions: users this user added AND users who added this user
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
      
      const contactIds = Array.from(usersToNotify);
      await PresenceManager.cacheUserContacts(userId, contactIds);
      console.log(`📚 Cached ${contactIds.length} contacts for user ${userId}`);
    } catch (error) {
      console.error('Error caching user contacts:', error);
    }
  }

  // Cleanup routine for stale connections
  private startCleanupRoutine() {
    // Run cleanup every 30 seconds (more aggressive)
    setInterval(async () => {
      try {
        const cleaned = await PresenceManager.cleanupStaleConnections();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} stale connections`);
        }
      } catch (error) {
        console.error('Error in cleanup routine:', error);
      }
    }, 30000); // 30 seconds (reduced from 2 minutes)
  }

  // Broadcast status update to contacts
  public async broadcastStatusUpdate(userId: string, status: string) {
    try {
      console.log(`📶 [STATUS-BROADCAST] User ${userId} changed to ${status}`);
      console.log(`📶 [STATUS-BROADCAST] Connected users: [${Array.from(this.connectedUsers.keys()).join(', ')}]`);
      
      // ALWAYS fetch contacts from database to ensure we have latest data
      console.log(`📶 [STATUS-BROADCAST] Fetching contacts from database for user ${userId}`);
      const contactRelations = await db
        .select({ 
          userId: contacts.userId,
          contactId: contacts.contactId 
        })
        .from(contacts)
        .where(or(
          eq(contacts.userId, userId),
          eq(contacts.contactId, userId)
        ));
      
      console.log(`📶 [STATUS-BROADCAST] Found ${contactRelations.length} contact relations:`, contactRelations);
      
      const usersToNotify = new Set<string>();
      contactRelations.forEach(({ userId: contactUserId, contactId }) => {
        if (contactUserId === userId) {
          // This user added someone, notify that someone
          usersToNotify.add(contactId);
          console.log(`📶 [STATUS-BROADCAST] Will notify ${contactId} (added by ${userId})`);
        } else {
          // Someone added this user, notify that someone  
          usersToNotify.add(contactUserId);
          console.log(`📶 [STATUS-BROADCAST] Will notify ${contactUserId} (has ${userId} as contact)`);
        }
      });
      
      const contactIds = Array.from(usersToNotify);
      console.log(`📶 [STATUS-BROADCAST] Final list of contacts to notify: [${contactIds.join(', ')}]`);

      // Emit status update event to all contacts who are online
      let totalSent = 0;
      for (const contactUserId of contactIds) {
        const contactSockets = this.connectedUsers.get(contactUserId);
        if (contactSockets && contactSockets.size > 0) {
          console.log(`📶 [STATUS-BROADCAST] Contact ${contactUserId} has ${contactSockets.size} connected sockets: [${Array.from(contactSockets).join(', ')}]`);
          // Send to all devices of the contact
          contactSockets.forEach(socketId => {
            this.io.to(socketId).emit('status:update', {
              userId,
              status,
              timestamp: new Date().toISOString(),
            });
            totalSent++;
            console.log(`📶 [STATUS-BROADCAST] ✅ Sent status update to socket ${socketId} (user ${contactUserId})`);
          });
        } else {
          console.log(`📶 [STATUS-BROADCAST] ⚠️ Contact ${contactUserId} is not connected (no sockets)`);
        }
      }
      
      console.log(`📶 [STATUS-BROADCAST] ✅ COMPLETE: Sent ${totalSent} status updates to ${contactIds.length} contacts`);
      
    } catch (error) {
      console.error('❌ [STATUS-BROADCAST] Error broadcasting status update:', error);
    }
  }

  // Auto-mark messages as delivered for online recipients
  private async autoMarkAsDelivered(messageId: string, conversationId: string, deliveredToUsers: string[]) {
    try {
      console.log(`🔄 Auto-marking message ${messageId} as delivered to users: ${deliveredToUsers.join(', ')}`);
      
      // Dynamic import to avoid circular dependency issues
      const { messages, messageStatus } = await import('../lib/db');
      
      // Insert delivery status for each online recipient
      for (const userId of deliveredToUsers) {
        // Check if delivery status already exists to avoid duplicates
        const [existingStatus] = await db
          .select({ id: messageStatus.id })
          .from(messageStatus)
          .where(and(
            eq(messageStatus.messageId, messageId),
            eq(messageStatus.userId, userId),
            eq(messageStatus.status, 'delivered')
          ))
          .limit(1);
        
        if (!existingStatus) {
          await db.insert(messageStatus).values({
            messageId,
            userId,
            status: 'delivered',
            timestamp: new Date(),
          });
          
          console.log(`✅ Marked message ${messageId} as delivered to user ${userId}`);
          
          // Emit delivery confirmation back to sender and other conversation members
          await this.emitToConversationMembers(conversationId, 'message:delivered', {
            messageId,
            userId,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log(`ℹ️ Message ${messageId} already marked as delivered to user ${userId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error auto-marking message as delivered:', error);
    }
  }

  // Enhanced broadcasting using cached contacts
  public async broadcastPresenceUpdateOptimized(userId: string, isOnline: boolean) {
    try {
      console.log(`Broadcasting presence update: User ${userId} is ${isOnline ? 'online' : 'offline'}`);
      
      // Try to get cached contacts first
      let contactIds = await PresenceManager.getCachedContacts(userId);
      
      // Fallback to database if cache is empty
      if (contactIds.length === 0) {
        const contactRelations = await db
          .select({ 
            userId: contacts.userId,
            contactId: contacts.contactId 
          })
          .from(contacts)
          .where(or(
            eq(contacts.userId, userId),
            eq(contacts.contactId, userId)
          ));
        
        const usersToNotify = new Set<string>();
        contactRelations.forEach(({ userId: contactUserId, contactId }) => {
          if (contactUserId === userId) {
            usersToNotify.add(contactId);
          } else {
            usersToNotify.add(contactUserId);
          }
        });
        
        contactIds = Array.from(usersToNotify);
        // Cache for next time
        await PresenceManager.cacheUserContacts(userId, contactIds);
      }

      console.log(`Notifying ${contactIds.length} contacts about user ${userId} presence`);

      // Emit to all contacts who are online
      for (const contactUserId of contactIds) {
        const contactSockets = this.connectedUsers.get(contactUserId);
        if (contactSockets && contactSockets.size > 0) {
          // Send to all devices of the contact
          contactSockets.forEach(socketId => {
            this.io.to(socketId).emit('presence:update', {
              userId,
              isOnline,
              lastSeen: new Date().toISOString(),
            });
          });
          console.log(`Sent presence update to contact ${contactUserId} on ${contactSockets.size} devices`);
        }
      }
      
    } catch (error) {
      console.error('Error broadcasting presence update:', error);
    }
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
