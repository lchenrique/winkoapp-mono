import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';

export const userStatusDetail: FastifyPluginAsyncZod = async (app) => {
  app.get('/user-status-detail/:userId', {
    schema: {
      tags: ['Debug'],
      description: 'Get detailed status information for a specific user',
      params: z.object({
        userId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params;
      
      // Get user from database
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          userStatus: users.userStatus,
          isOnline: users.isOnline,
          lastSeen: users.lastSeen,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      // Check Redis presence
      const redisOnline = await PresenceManager.isUserOnline(userId);
      const redisConnections = await PresenceManager.getUserConnections(userId);
      
      // Check Socket service
      const socketService = getSocketService();
      const socketOnline = socketService ? socketService.isUserOnline(userId) : false;
      const socketConnections = socketService ? socketService.getConnectedUsers().get(userId) : new Set();

      return {
        user: {
          id: user.id,
          name: user.name,
        },
        database: {
          userStatus: user.userStatus || 'online',
          isOnline: user.isOnline || false,
          lastSeen: user.lastSeen?.toISOString() || null,
        },
        redis: {
          isOnline: redisOnline,
          connections: redisConnections,
          connectionCount: redisConnections.length,
        },
        socket: {
          isOnline: socketOnline,
          connections: Array.from(socketConnections || []),
          connectionCount: socketConnections ? socketConnections.size : 0,
        },
        summary: {
          anyConnectionActive: redisOnline || socketOnline,
          statusConsistent: (user.isOnline === (redisOnline || socketOnline)),
          recommendedAction: (user.isOnline !== (redisOnline || socketOnline)) 
            ? 'Database needs synchronization' 
            : 'Status is consistent'
        }
      };
    } catch (error) {
      console.error('Error getting user status detail:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });
};
