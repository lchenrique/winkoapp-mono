import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, friendRequests, contacts, users } from '../../lib/db';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

const respondToFriendRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
});

const respondResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  message: z.string(),
});

export const respondToFriendRequest: FastifyPluginAsyncZod = async (app) => {
  app.post('/respond', {
    preHandler: authenticate,
    schema: {
      tags: ['Friend Requests'],
      description: 'Accept or reject a friend request',
      body: respondToFriendRequestSchema,
      response: {
        200: respondResponseSchema,
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
      },
    },
  }, async (request, reply) => {
    const { requestId, action } = request.body;
    const userId = (request as any).user.id;

    try {
      // Find the friend request and verify user is the receiver
      const [friendRequest] = await db
        .select({
          id: friendRequests.id,
          senderId: friendRequests.senderId,
          receiverId: friendRequests.receiverId,
          status: friendRequests.status,
        })
        .from(friendRequests)
        .where(and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.receiverId, userId)
        ))
        .limit(1);

      if (!friendRequest) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Friend request not found or you are not authorized',
        });
      }

      if (friendRequest.status !== 'pending') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Friend request has already been responded to',
        });
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      // Update friend request status
      await db
        .update(friendRequests)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(friendRequests.id, requestId));

      // If accepted, create contacts for both users
      if (action === 'accept') {
        // Get sender info
        const [sender] = await db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            avatar: users.avatar,
          })
          .from(users)
          .where(eq(users.id, friendRequest.senderId))
          .limit(1);

        // Create contact entries for both users
        await db.insert(contacts).values([
          {
            userId: friendRequest.senderId,
            contactId: friendRequest.receiverId,
            friendRequestId: requestId,
          },
          {
            userId: friendRequest.receiverId,
            contactId: friendRequest.senderId,
            friendRequestId: requestId,
          },
        ]);

        // Send real-time notification to sender about acceptance
        const socketService = getSocketService();
        if (socketService && sender) {
          socketService.emitToUser(friendRequest.senderId, 'friend_request:accepted', {
            id: requestId,
            status: 'accepted',
            acceptedBy: {
              id: userId,
              username: (request as any).user.username,
              name: (request as any).user.name,
              avatar: (request as any).user.avatar,
            },
          });

          // Also emit contact added event to both users
          socketService.emitToUser(friendRequest.senderId, 'contact:added', {
            contact: {
              id: userId,
              username: (request as any).user.username,
              name: (request as any).user.name,
              avatar: (request as any).user.avatar,
            },
          });

          socketService.emitToUser(userId, 'contact:added', {
            contact: {
              id: sender.id,
              username: sender.username,
              name: sender.name,
              avatar: sender.avatar,
            },
          });
        }
      } else {
        // Send rejection notification to sender
        const socketService = getSocketService();
        if (socketService) {
          socketService.emitToUser(friendRequest.senderId, 'friend_request:rejected', {
            id: requestId,
            status: 'rejected',
            rejectedBy: {
              id: userId,
              username: (request as any).user.username,
              name: (request as any).user.name,
            },
          });
        }
      }

      return {
        id: requestId,
        status: newStatus,
        message: action === 'accept' ? 'Friend request accepted' : 'Friend request rejected',
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to respond to friend request',
      });
    }
  });
};
