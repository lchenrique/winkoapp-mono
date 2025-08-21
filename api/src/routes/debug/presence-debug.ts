import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { UserStatus, getEffectiveStatus } from '../../types/user-status';

const presenceDebugRequestSchema = z.object({
  userId: z.string().uuid(),
});

const presenceDebugResponseSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  
  // Database info
  database: z.object({
    isOnline: z.boolean(),
    userStatus: z.enum(['online', 'busy', 'away', 'offline']),
    lastSeen: z.string().nullable(),
  }),
  
  // Redis presence info
  redis: z.object({
    isConnected: z.boolean(),
    presenceExists: z.boolean(),
    rawPresenceData: z.any().nullable(),
    isInOnlineSet: z.boolean(),
    socketCount: z.number(),
    deviceCount: z.number(),
  }),
  
  // Socket.IO info
  socketService: z.object({
    isConnectedInSocketService: z.boolean(),
    connectedSockets: z.array(z.string()),
    totalSockets: z.number(),
  }),
  
  // Effective status calculation
  effectiveStatus: z.object({
    userPresence: z.any().nullable(),
    calculatedStatus: z.enum(['online', 'busy', 'away', 'offline']),
  }),
  
  // Inconsistencies detected
  inconsistencies: z.array(z.string()),
  
  timestamp: z.string(),
});

export const presenceDebug: FastifyPluginAsyncZod = async (app) => {
  app.post('/presence-debug', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Debug presence information for a specific user',
      body: presenceDebugRequestSchema,
      response: {
        200: presenceDebugResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        404: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { userId } = request.body;
    const currentUserId = (request as any).user.id;
    
    try {
      // Get user info from database
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          isOnline: users.isOnline,
          userStatus: users.userStatus,
          lastSeen: users.lastSeen,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Get Redis presence data
      const redisPresence = await PresenceManager.getUserPresence(userId);
      const isInOnlineSet = await PresenceManager.isUserOnline(userId);
      const socketIds = await PresenceManager.getUserSocketIds(userId);
      const deviceCount = await PresenceManager.getDeviceCount(userId);

      // Get enhanced presence for effective status calculation
      const enhancedPresence = await PresenceManager.getEnhancedUserPresence(userId, user.userStatus as UserStatus);
      const effectiveStatus = enhancedPresence ? getEffectiveStatus(enhancedPresence) : UserStatus.OFFLINE;

      // Get Socket.IO service info
      const socketService = getSocketService();
      const isConnectedInSocketService = socketService ? socketService.isUserOnline(userId) : false;
      const connectedUsers = socketService ? socketService.getConnectedUsers() : new Map();
      const userSockets = connectedUsers.get(userId) || new Set();

      // Detect inconsistencies
      const inconsistencies: string[] = [];

      // Database vs Redis inconsistency
      if (user.isOnline && !isInOnlineSet) {
        inconsistencies.push('Database shows online but Redis online set shows offline');
      }
      if (!user.isOnline && isInOnlineSet) {
        inconsistencies.push('Database shows offline but Redis online set shows online');
      }

      // Redis vs Socket.IO inconsistency
      if (isInOnlineSet && !isConnectedInSocketService) {
        inconsistencies.push('Redis shows online but Socket.IO service shows offline');
      }
      if (!isInOnlineSet && isConnectedInSocketService) {
        inconsistencies.push('Redis shows offline but Socket.IO service shows online');
      }

      // Socket count mismatch
      if (socketIds.length !== userSockets.size) {
        inconsistencies.push(`Socket count mismatch: Redis has ${socketIds.length}, Socket.IO has ${userSockets.size}`);
      }

      // Redis presence vs online set inconsistency
      if (redisPresence) {
        const presenceOnline = redisPresence.isOnline || (redisPresence as any).isConnected;
        if (presenceOnline && !isInOnlineSet) {
          inconsistencies.push('Redis presence shows online but not in online users set');
        }
        if (!presenceOnline && isInOnlineSet) {
          inconsistencies.push('Redis presence shows offline but in online users set');
        }
      } else if (isInOnlineSet) {
        inconsistencies.push('User in Redis online set but no presence data found');
      }

      return {
        userId,
        userName: user.name,
        
        database: {
          isOnline: user.isOnline || false,
          userStatus: user.userStatus as any || 'online',
          lastSeen: user.lastSeen?.toISOString() || null,
        },
        
        redis: {
          isConnected: redisPresence?.isOnline || (redisPresence as any)?.isConnected || false,
          presenceExists: !!redisPresence,
          rawPresenceData: redisPresence,
          isInOnlineSet,
          socketCount: socketIds.length,
          deviceCount,
        },
        
        socketService: {
          isConnectedInSocketService,
          connectedSockets: Array.from(userSockets),
          totalSockets: userSockets.size,
        },
        
        effectiveStatus: {
          userPresence: enhancedPresence,
          calculatedStatus: effectiveStatus,
        },
        
        inconsistencies,
        
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error in presence debug:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to debug presence information',
      });
    }
  });
};
