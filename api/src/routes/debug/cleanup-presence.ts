import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const cleanupPresenceResponseSchema = z.object({
  message: z.string(),
  actions: z.array(z.string()),
  staleSocksdCleaned: z.number(),
  usersUpdated: z.number(),
  inconsistenciesFixed: z.number(),
  timestamp: z.string(),
});

export const cleanupPresence: FastifyPluginAsyncZod = async (app) => {
  app.post('/cleanup-presence', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Perform complete presence cleanup and sync',
      response: {
        200: cleanupPresenceResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const actions: string[] = [];
      let staleSocksdCleaned = 0;
      let usersUpdated = 0;
      let inconsistenciesFixed = 0;

      // Step 1: Clean up stale connections in Redis
      actions.push('Cleaning up stale Redis connections...');
      staleSocksdCleaned = await PresenceManager.cleanupStaleConnections();
      actions.push(`Cleaned ${staleSocksdCleaned} stale connections`);

      // Step 2: Get Socket.IO service and sync all users
      const socketService = getSocketService();
      if (!socketService) {
        actions.push('Warning: Socket.IO service not available');
        return {
          message: 'Cleanup completed with warnings',
          actions,
          staleSocksdCleaned,
          usersUpdated: 0,
          inconsistenciesFixed: 0,
          timestamp: new Date().toISOString(),
        };
      }

      // Step 3: Get all online users from Socket.IO (source of truth)
      const socketOnlineUsers = new Set(socketService.getOnlineUsersList());
      actions.push(`Found ${socketOnlineUsers.size} users connected via Socket.IO`);

      // Step 4: Get all users marked as online in database
      const dbOnlineUsers = await db
        .select({
          id: users.id,
          name: users.name,
          isOnline: users.isOnline,
        })
        .from(users)
        .where(eq(users.isOnline, true));

      actions.push(`Found ${dbOnlineUsers.length} users marked online in database`);

      // Step 5: Fix users marked online in DB but not connected via Socket.IO
      for (const user of dbOnlineUsers) {
        if (!socketOnlineUsers.has(user.id)) {
          // User is marked online in DB but not connected - fix it
          await db
            .update(users)
            .set({
              isOnline: false,
              lastSeen: new Date(),
            })
            .where(eq(users.id, user.id));

          // Remove from Redis
          await PresenceManager.setUserOffline(user.id);

          // Broadcast offline status
          await socketService.broadcastPresenceUpdateOptimized(user.id, false);

          actions.push(`Fixed ${user.name}: marked offline (was online in DB but no Socket.IO connection)`);
          usersUpdated++;
          inconsistenciesFixed++;
        }
      }

      // Step 6: Fix users connected via Socket.IO but not marked online in DB
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          isOnline: users.isOnline,
        })
        .from(users);

      const userMap = new Map(allUsers.map(u => [u.id, u]));

      for (const socketUserId of socketOnlineUsers) {
        const user = userMap.get(socketUserId);
        if (user && !user.isOnline) {
          // User is connected via Socket.IO but marked offline in DB - fix it
          await db
            .update(users)
            .set({
              isOnline: true,
              lastSeen: new Date(),
            })
            .where(eq(users.id, socketUserId));

          // Ensure in Redis
          await PresenceManager.addUserConnection(socketUserId, `cleanup-${Date.now()}`, 'cleanup-device');

          // Broadcast online status
          await socketService.broadcastPresenceUpdateOptimized(socketUserId, true);

          actions.push(`Fixed ${user.name}: marked online (was offline in DB but has Socket.IO connection)`);
          usersUpdated++;
          inconsistenciesFixed++;
        }
      }

      // Step 7: Final verification
      const finalDbCount = await db.select({ count: users.id }).from(users).where(eq(users.isOnline, true));
      const finalRedisCount = (await PresenceManager.getOnlineUsers()).length;
      
      actions.push(`Final state: ${finalDbCount.length} online in DB, ${finalRedisCount} in Redis, ${socketOnlineUsers.size} in Socket.IO`);

      return {
        message: 'Presence cleanup completed successfully',
        actions,
        staleSocksdCleaned,
        usersUpdated,
        inconsistenciesFixed,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error in cleanup presence:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to cleanup presence',
      });
    }
  });
};
