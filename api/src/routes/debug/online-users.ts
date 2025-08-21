import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getSocketService } from '../../services/socket';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const onlineUsersResponseSchema = z.object({
  connectedInSocket: z.array(z.string()),
  connectedInDatabase: z.array(z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    isOnline: z.boolean(),
  })),
  totalConnected: z.number(),
});

export const onlineUsersDebug: FastifyPluginAsyncZod = async (app) => {
  app.get('/online-users', {
    schema: {
      tags: ['Debug'],
      description: 'Get list of currently online users (debug endpoint)',
      response: {
        200: onlineUsersResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const socketService = getSocketService();
      
      // Get users connected in Socket.IO
      const connectedInSocket = socketService ? socketService.getOnlineUsersList() : [];
      
      // Get users marked as online in database
      const onlineUsersInDB = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          isOnline: users.isOnline,
        })
        .from(users)
        .where(eq(users.isOnline, true));

      return {
        connectedInSocket,
        connectedInDatabase: onlineUsersInDB,
        totalConnected: connectedInSocket.length,
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get online users',
      });
    }
  });
};
