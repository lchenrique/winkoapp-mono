import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, friendRequests, users } from '../../lib/db';
import { eq, and, or } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const friendRequestSchema = z.object({
  id: z.string(),
  status: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
  sender: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
  receiver: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
});

const listFriendRequestsResponseSchema = z.object({
  sent: z.array(friendRequestSchema),
  received: z.array(friendRequestSchema),
});

export const listFriendRequests: FastifyPluginAsyncZod = async (app) => {
  app.get('/list', {
    preHandler: authenticate,
    schema: {
      tags: ['Friend Requests'],
      description: 'List all friend requests (sent and received)',
      response: {
        200: listFriendRequestsResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      // Get sent requests
      const sentRequests = await db
        .select({
          id: friendRequests.id,
          status: friendRequests.status,
          message: friendRequests.message,
          createdAt: friendRequests.createdAt,
          // Sender info (current user)
          senderId: users.id,
          senderUsername: users.username,
          senderName: users.name,
          senderAvatar: users.avatar,
          // Receiver info
          receiverId: friendRequests.receiverId,
        })
        .from(friendRequests)
        .innerJoin(users, eq(friendRequests.senderId, users.id))
        .where(eq(friendRequests.senderId, userId))
        .orderBy(friendRequests.createdAt);

      // Get receiver details for sent requests
      const sentRequestsWithReceivers = await Promise.all(
        sentRequests.map(async (request) => {
          const [receiver] = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name,
              avatar: users.avatar,
            })
            .from(users)
            .where(eq(users.id, request.receiverId))
            .limit(1);

          return {
            id: request.id,
            status: request.status,
            message: request.message,
            createdAt: request.createdAt.toISOString(),
            sender: {
              id: request.senderId,
              username: request.senderUsername,
              name: request.senderName,
              avatar: request.senderAvatar,
            },
            receiver: {
              id: receiver.id,
              username: receiver.username,
              name: receiver.name,
              avatar: receiver.avatar,
            },
          };
        })
      );

      // Get received requests
      const receivedRequests = await db
        .select({
          id: friendRequests.id,
          status: friendRequests.status,
          message: friendRequests.message,
          createdAt: friendRequests.createdAt,
          // Sender info
          senderId: users.id,
          senderUsername: users.username,
          senderName: users.name,
          senderAvatar: users.avatar,
          // Receiver info (current user)
          receiverId: friendRequests.receiverId,
        })
        .from(friendRequests)
        .innerJoin(users, eq(friendRequests.senderId, users.id))
        .where(eq(friendRequests.receiverId, userId))
        .orderBy(friendRequests.createdAt);

      // Get receiver details for received requests (current user)
      const currentUser = (request as any).user;
      const receivedRequestsFormatted = receivedRequests.map((request) => ({
        id: request.id,
        status: request.status,
        message: request.message,
        createdAt: request.createdAt.toISOString(),
        sender: {
          id: request.senderId,
          username: request.senderUsername,
          name: request.senderName,
          avatar: request.senderAvatar,
        },
        receiver: {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
      }));

      return {
        sent: sentRequestsWithReceivers,
        received: receivedRequestsFormatted,
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get friend requests',
      });
    }
  });
};
