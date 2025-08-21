import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PresenceManager } from '../../lib/redis';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

const offlineNotificationSchema = z.object({
  userId: z.string().uuid(),
  timestamp: z.number(),
  method: z.enum(['fetch', 'beacon', 'manual']).optional(),
});

export const offlineNotification: FastifyPluginAsyncZod = async (app) => {
  app.post('/offline', {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Notify server that user is going offline',
      body: offlineNotificationSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
        }),
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { userId, timestamp, method = 'manual' } = request.body;
      const authenticatedUserId = (request as any).user.id;

      // Security check: ensure user can only mark themselves offline
      if (userId !== authenticatedUserId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only mark yourself as offline',
          statusCode: 403,
        });
      }

      console.log(`🚪 User ${userId} going offline via ${method} method`);

      // Force remove all user connections from Redis
      await PresenceManager.setUserOffline(userId);

      // Update database - set both connection status AND user status to offline
      await db
        .update(users)
        .set({
          isOnline: false,
          lastSeen: new Date(timestamp),
          userStatus: 'offline', // Important: Change status to offline when manually going offline
        })
        .where(eq(users.id, userId));

      // Get socket service and force broadcast presence update
      const socketService = getSocketService();
      if (socketService) {
        // Force broadcast to contacts that user is offline
        try {
          await socketService.broadcastPresenceUpdateOptimized(userId, false);
          // Also broadcast status change to offline
          await socketService.broadcastStatusUpdate(userId, 'offline');
        } catch (error) {
          console.warn('Failed to broadcast offline status:', error);
        }
      }

      console.log(`✅ User ${userId} successfully marked as offline`);

      return {
        success: true,
        message: 'User marked as offline successfully',
      };

    } catch (error) {
      console.error('Error marking user as offline:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to mark user as offline',
      });
    }
  });
};
