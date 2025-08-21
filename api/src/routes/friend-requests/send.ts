import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, friendRequests, users } from '../../lib/db';
import { eq, and, or } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

const sendFriendRequestSchema = z.object({
  // Accept username or email to find the user
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string().email().optional(),
  message: z.string().max(255).optional(),
}).refine(data => data.username || data.email, {
  message: 'Either username or email must be provided',
});

const friendRequestResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
  receiver: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
});

export const sendFriendRequest: FastifyPluginAsyncZod = async (app) => {
  app.post('/send', {
    preHandler: authenticate,
    schema: {
      tags: ['Friend Requests'],
      description: 'Send a friend request to a user',
      body: sendFriendRequestSchema,
      response: {
        201: friendRequestResponseSchema,
        400: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        404: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        409: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { username, email, message } = request.body;
    const senderId = (request as any).user.id;

    try {
      // Find receiver by username or email
      let receiver;
      if (username) {
        [receiver] = await db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            avatar: users.avatar,
          })
          .from(users)
          .where(eq(users.username, username.toLowerCase()))
          .limit(1);
      } else if (email) {
        [receiver] = await db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            avatar: users.avatar,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
      }

      if (!receiver) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Check if trying to send request to yourself
      if (receiver.id === senderId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot send friend request to yourself',
        });
      }

      // Check if there's already a pending request between these users (both directions)
      const [existingRequest] = await db
        .select({ id: friendRequests.id, status: friendRequests.status })
        .from(friendRequests)
        .where(or(
          and(
            eq(friendRequests.senderId, senderId),
            eq(friendRequests.receiverId, receiver.id)
          ),
          and(
            eq(friendRequests.senderId, receiver.id),
            eq(friendRequests.receiverId, senderId)
          )
        ))
        .limit(1);

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Friend request already exists',
          });
        } else if (existingRequest.status === 'accepted') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'You are already friends',
          });
        }
      }

      // Create friend request
      const [newRequest] = await db
        .insert(friendRequests)
        .values({
          senderId,
          receiverId: receiver.id,
          message: message || null,
          status: 'pending',
        })
        .returning({
          id: friendRequests.id,
          status: friendRequests.status,
          message: friendRequests.message,
          createdAt: friendRequests.createdAt,
        });

      // Send real-time notification to receiver
      const socketService = getSocketService();
      if (socketService) {
        socketService.emitToUser(receiver.id, 'friend_request:received', {
          id: newRequest.id,
          status: newRequest.status,
          message: newRequest.message,
          createdAt: newRequest.createdAt.toISOString(),
          sender: {
            id: senderId,
            username: (request as any).user.username,
            name: (request as any).user.name,
            avatar: (request as any).user.avatar,
          },
        });
      }

      return reply.status(201).send({
        id: newRequest.id,
        status: newRequest.status,
        message: newRequest.message,
        createdAt: newRequest.createdAt.toISOString(),
        receiver: {
          id: receiver.id,
          username: receiver.username,
          name: receiver.name,
          avatar: receiver.avatar,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to send friend request',
      });
    }
  });
};
