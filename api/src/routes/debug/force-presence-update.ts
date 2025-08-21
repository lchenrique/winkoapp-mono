import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const forcePresenceUpdateRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  updateAllUsers: z.boolean().optional(),
});

const presenceUpdateResultSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  previousState: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    socketService: z.boolean(),
  }),
  currentState: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    socketService: z.boolean(),
  }),
  actionTaken: z.string(),
  wasUpdated: z.boolean(),
});

const forcePresenceUpdateResponseSchema = z.object({
  totalUsersProcessed: z.number(),
  usersUpdated: z.number(),
  results: z.array(presenceUpdateResultSchema),
  timestamp: z.string(),
});

export const forcePresenceUpdate: FastifyPluginAsyncZod = async (app) => {
  app.post('/force-presence-update', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Force presence update based on real Socket.IO connection state',
      body: forcePresenceUpdateRequestSchema,
      response: {
        200: forcePresenceUpdateResponseSchema,
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
    const { userId, updateAllUsers = false } = request.body;
    
    try {
      let usersToProcess: Array<{id: string, name: string, isOnline: boolean | null}> = [];
      
      if (updateAllUsers) {
        // Get all users
        usersToProcess = await db
          .select({
            id: users.id,
            name: users.name,
            isOnline: users.isOnline,
          })
          .from(users);
      } else if (userId) {
        // Get specific user
        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            isOnline: users.isOnline,
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
        usersToProcess = [user];
      } else {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Must specify userId or set updateAllUsers to true',
        });
      }

      const results: any[] = [];
      let usersUpdated = 0;
      const socketService = getSocketService();

      for (const user of usersToProcess) {
        const result = await forceUpdateUserPresence(user.id, user.name, user.isOnline || false, socketService);
        results.push(result);
        
        if (result.wasUpdated) {
          usersUpdated++;
        }
      }

      return {
        totalUsersProcessed: usersToProcess.length,
        usersUpdated,
        results,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error in force presence update:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to force presence update',
      });
    }
  });
};

async function forceUpdateUserPresence(userId: string, userName: string, dbIsOnline: boolean, socketService: any) {
  let wasUpdated = false;
  let actionTaken = 'No action needed';

  try {
    // Get current state from all sources
    const redisIsOnline = await PresenceManager.isUserOnline(userId);
    const socketIsOnline = socketService ? socketService.isUserOnline(userId) : false;

    const previousState = {
      database: dbIsOnline,
      redis: redisIsOnline,
      socketService: socketIsOnline,
    };

    // Determine the REAL state based on Socket.IO (source of truth for active connections)
    const realState = socketIsOnline;

    // If there's any mismatch, force update everything to match reality
    if (dbIsOnline !== realState || redisIsOnline !== realState) {
      // Update database to match reality
      await db
        .update(users)
        .set({
          isOnline: realState,
          lastSeen: new Date(),
        })
        .where(eq(users.id, userId));

      // Update Redis to match reality
      if (realState) {
        // User should be online - add a connection if not exists
        if (!redisIsOnline) {
          await PresenceManager.addUserConnection(userId, `force-update-${Date.now()}`, 'force-update-device');
          actionTaken = 'Added user to Redis online set (user is connected via Socket.IO)';
        } else {
          actionTaken = 'Database updated to match online state';
        }
      } else {
        // User should be offline - clean up Redis
        if (redisIsOnline) {
          await PresenceManager.setUserOffline(userId);
          actionTaken = 'Removed user from Redis online set (no active Socket.IO connections)';
        } else {
          actionTaken = 'Database updated to match offline state';
        }
      }

      // Broadcast the correct presence to contacts
      if (socketService) {
        await socketService.broadcastPresenceUpdateOptimized(userId, realState);
        actionTaken += ' + Broadcasted correct presence to contacts';
      }

      wasUpdated = true;
    } else {
      actionTaken = 'All states are consistent - no update needed';
    }

    // Get current state after update
    const currentState = {
      database: realState,
      redis: realState,
      socketService: socketIsOnline,
    };

    return {
      userId,
      userName,
      previousState,
      currentState,
      actionTaken,
      wasUpdated,
    };

  } catch (error) {
    console.error(`Error forcing presence update for user ${userId}:`, error);
    return {
      userId,
      userName,
      previousState: { database: false, redis: false, socketService: false },
      currentState: { database: false, redis: false, socketService: false },
      actionTaken: `Error during update: ${error.message}`,
      wasUpdated: false,
    };
  }
}
