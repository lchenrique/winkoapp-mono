import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const presenceFixRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  fixAllUsers: z.boolean().optional(),
});

const fixResultSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  issuesFound: z.array(z.string()),
  actionsPerformed: z.array(z.string()),
  wasFixed: z.boolean(),
});

const presenceFixResponseSchema = z.object({
  totalUsersChecked: z.number(),
  usersWithIssues: z.number(),
  usersFixed: z.number(),
  results: z.array(fixResultSchema),
  timestamp: z.string(),
});

export const presenceFix: FastifyPluginAsyncZod = async (app) => {
  app.post('/presence-fix', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Detect and fix presence inconsistencies',
      body: presenceFixRequestSchema,
      response: {
        200: presenceFixResponseSchema,
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
    const { userId, fixAllUsers = false } = request.body;
    const currentUserId = (request as any).user.id;
    
    try {
      let usersToCheck: Array<{id: string, name: string, isOnline: boolean | null}> = [];
      
      if (fixAllUsers) {
        // Get all users
        usersToCheck = await db
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
        usersToCheck = [user];
      } else {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Must specify userId or set fixAllUsers to true',
        });
      }

      const results: any[] = [];
      let usersWithIssues = 0;
      let usersFixed = 0;

      for (const user of usersToCheck) {
        const fixResult = await fixUserPresence(user.id, user.name, user.isOnline || false);
        results.push(fixResult);
        
        if (fixResult.issuesFound.length > 0) {
          usersWithIssues++;
        }
        
        if (fixResult.wasFixed) {
          usersFixed++;
        }
      }

      return {
        totalUsersChecked: usersToCheck.length,
        usersWithIssues,
        usersFixed,
        results,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error in presence fix:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to fix presence issues',
      });
    }
  });
};

async function fixUserPresence(userId: string, userName: string, dbIsOnline: boolean) {
  const issuesFound: string[] = [];
  const actionsPerformed: string[] = [];
  let wasFixed = false;

  try {
    // Get current state from all sources
    const redisPresence = await PresenceManager.getUserPresence(userId);
    const isInOnlineSet = await PresenceManager.isUserOnline(userId);
    const socketIds = await PresenceManager.getUserSocketIds(userId);
    
    const socketService = getSocketService();
    const isConnectedInSocketService = socketService ? socketService.isUserOnline(userId) : false;

    // Issue 1: Database says online but Redis says offline
    if (dbIsOnline && !isInOnlineSet) {
      issuesFound.push('Database shows online but Redis online set shows offline');
      
      if (socketIds.length === 0 && !isConnectedInSocketService) {
        // User is truly offline, fix database
        await db
          .update(users)
          .set({
            isOnline: false,
            lastSeen: new Date(),
          })
          .where(eq(users.id, userId));
        
        actionsPerformed.push('Updated database: set user offline');
        wasFixed = true;
      }
    }

    // Issue 2: Database says offline but Redis says online  
    if (!dbIsOnline && isInOnlineSet) {
      issuesFound.push('Database shows offline but Redis online set shows online');
      
      if (socketIds.length > 0 || isConnectedInSocketService) {
        // User is truly online, fix database
        await db
          .update(users)
          .set({
            isOnline: true,
            lastSeen: new Date(),
          })
          .where(eq(users.id, userId));
        
        actionsPerformed.push('Updated database: set user online');
        wasFixed = true;
      } else {
        // Redis is wrong, clean it up
        await PresenceManager.setUserOffline(userId);
        actionsPerformed.push('Cleaned up Redis: removed from online set');
        wasFixed = true;
      }
    }

    // Issue 3: Redis presence data exists but user not in online set
    if (redisPresence && !isInOnlineSet) {
      const presenceOnline = redisPresence.isOnline || (redisPresence as any).isConnected;
      if (presenceOnline) {
        issuesFound.push('Redis presence shows online but not in online users set');
        
        if (socketIds.length > 0 || isConnectedInSocketService) {
          // Add to online set
          await PresenceManager.addUserConnection(userId, `recovery-${Date.now()}`, `recovery-device`);
          actionsPerformed.push('Added user to Redis online set');
          wasFixed = true;
        }
      }
    }

    // Issue 4: User in online set but no socket connections
    if (isInOnlineSet && socketIds.length === 0 && !isConnectedInSocketService) {
      issuesFound.push('User in Redis online set but no active socket connections');
      
      // Remove from online set
      await PresenceManager.setUserOffline(userId);
      actionsPerformed.push('Removed user from Redis online set (no connections)');
      wasFixed = true;
    }

    // Issue 5: Socket service vs Redis mismatch
    if (isConnectedInSocketService && !isInOnlineSet) {
      issuesFound.push('Socket.IO service shows online but Redis shows offline');
      
      // Trust Socket.IO service, add to Redis
      await PresenceManager.addUserConnection(userId, `recovery-${Date.now()}`, `recovery-device`);
      actionsPerformed.push('Added user to Redis based on Socket.IO service');
      wasFixed = true;
    }

    // Issue 6: Stale socket IDs in Redis
    if (socketIds.length > 0 && !isConnectedInSocketService) {
      issuesFound.push('Redis has socket IDs but Socket.IO service shows no connections');
      
      // Clean up stale sockets
      for (const socketId of socketIds) {
        await PresenceManager.removeUserConnection(userId, socketId);
      }
      actionsPerformed.push('Cleaned up stale socket connections in Redis');
      wasFixed = true;
    }

  } catch (error) {
    console.error(`Error fixing presence for user ${userId}:`, error);
    issuesFound.push(`Error during fix: ${error.message}`);
  }

  return {
    userId,
    userName,
    issuesFound,
    actionsPerformed,
    wasFixed,
  };
}
