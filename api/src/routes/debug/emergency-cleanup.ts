import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const emergencyCleanupResponseSchema = z.object({
  message: z.string(),
  before: z.object({
    socketOnlineUsers: z.number(),
    databaseOnlineUsers: z.number(),
    redisOnlineUsers: z.number(),
  }),
  after: z.object({
    socketOnlineUsers: z.number(),
    databaseOnlineUsers: z.number(),  
    redisOnlineUsers: z.number(),
  }),
  actions: z.array(z.string()),
  usersFixed: z.number(),
  bobStatus: z.object({
    before: z.object({
      database: z.boolean(),
      redis: z.boolean(),
      socketService: z.boolean(),
    }),
    after: z.object({
      database: z.boolean(),
      redis: z.boolean(), 
      socketService: z.boolean(),
    }),
  }),
  timestamp: z.string(),
});

export const emergencyCleanup: FastifyPluginAsyncZod = async (app) => {
  // ⚠️ NO AUTHENTICATION - EMERGENCY USE ONLY!
  app.post('/emergency-cleanup', async (request, reply) => {
    try {
      const actions: string[] = [];
      let usersFixed = 0;
      const socketService = getSocketService();
      const bobId = 'fb9c7e96-1d4e-46d4-bdbb-6abf8b4a71d5';

      // BEFORE state
      const beforeSocketOnline = socketService ? socketService.getOnlineUsersList().length : 0;
      const beforeDbOnline = await db.select().from(users).where(eq(users.isOnline, true));
      const beforeRedisOnline = await PresenceManager.getOnlineUsers();
      
      // Bob's state before
      const bobBeforeDb = beforeDbOnline.find(u => u.id === bobId)?.isOnline || false;
      const bobBeforeRedis = await PresenceManager.isUserOnline(bobId);
      const bobBeforeSocket = socketService ? socketService.isUserOnline(bobId) : false;

      actions.push(`BEFORE: Socket=${beforeSocketOnline}, DB=${beforeDbOnline.length}, Redis=${beforeRedisOnline.length}`);
      actions.push(`Bob BEFORE: DB=${bobBeforeDb}, Redis=${bobBeforeRedis}, Socket=${bobBeforeSocket}`);
      const reallyConnectedUsers = socketService ? socketService.getOnlineUsersList() : [];
      actions.push(`🔧 LOGIC: ${reallyConnectedUsers.length} users really connected via Socket.IO`);
      
      // Fix inconsistencies: users marked online in DB but not connected via Socket.IO
      // Fix users marked online in DB but not really connected via Socket.IO
      for (const user of beforeDbOnline) {
        const isReallyConnected = reallyConnectedUsers.includes(user.id);
        
        if (!isReallyConnected) {
          // User is marked online in DB but not connected via Socket.IO - FIX IT!
          await db
            .update(users)
            .set({
              isOnline: false,
              lastSeen: new Date(),
            })
            .where(eq(users.id, user.id));

          // Remove from Redis using proper method
          await PresenceManager.setUserOffline(user.id);

          actions.push(`🔧 FIXED ${user.name} (${user.id}): marked OFFLINE (not connected via Socket.IO)`);
          usersFixed++;
        } else {
          actions.push(`✅ OK ${user.name} (${user.id}): properly online via Socket.IO`);
        }
      }

      // Clean up stale Redis connections
      const staleConnections = await PresenceManager.cleanupStaleConnections();
      if (staleConnections > 0) {
        actions.push(`🧹 Cleaned ${staleConnections} stale Redis connections`);
      }

      // AFTER state
      const afterDbOnline = await db.select().from(users).where(eq(users.isOnline, true));
      const afterRedisOnline = await PresenceManager.getOnlineUsers();
      const afterSocketOnline = socketService ? socketService.getOnlineUsersList().length : 0;

      // Bob's state after
      const bobAfterDb = afterDbOnline.find(u => u.id === bobId)?.isOnline || false;
      const bobAfterRedis = await PresenceManager.isUserOnline(bobId);
      const bobAfterSocket = socketService ? socketService.isUserOnline(bobId) : false;

      actions.push(`AFTER: Socket=${afterSocketOnline}, DB=${afterDbOnline.length}, Redis=${afterRedisOnline.length}`);
      actions.push(`Bob AFTER: DB=${bobAfterDb}, Redis=${bobAfterRedis}, Socket=${bobAfterSocket}`);

      if (bobBeforeDb && !bobAfterDb) {
        actions.push('🎉 BOB PROBLEM FIXED! Alice should now see Bob as OFFLINE');
      }

      return {
        message: usersFixed > 0 ? '✅ Emergency cleanup completed - issues fixed!' : '✅ Emergency cleanup completed - no issues found',
        before: {
          socketOnlineUsers: beforeSocketOnline,
          databaseOnlineUsers: beforeDbOnline.length,
          redisOnlineUsers: beforeRedisOnline.length,
        },
        after: {
          socketOnlineUsers: afterSocketOnline,
          databaseOnlineUsers: afterDbOnline.length,
          redisOnlineUsers: afterRedisOnline.length,
        },
        actions,
        usersFixed,
        bobStatus: {
          before: { database: bobBeforeDb, redis: bobBeforeRedis, socketService: bobBeforeSocket },
          after: { database: bobAfterDb, redis: bobAfterRedis, socketService: bobAfterSocket },
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Emergency cleanup error:', error);
      return {
        message: `❌ Emergency cleanup failed with error: ${error.message}`,
        before: { socketOnlineUsers: 0, databaseOnlineUsers: 0, redisOnlineUsers: 0 },
        after: { socketOnlineUsers: 0, databaseOnlineUsers: 0, redisOnlineUsers: 0 },
        actions: [`Error: ${error.message}`],
        usersFixed: 0,
        bobStatus: {
          before: { database: false, redis: false, socketService: false },
          after: { database: false, redis: false, socketService: false },
        },
        timestamp: new Date().toISOString(),
      };
    }
  });
};
