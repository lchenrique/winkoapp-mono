import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messages, conversationMembers, users } from '../../lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSimpleSocketService } from '../../services/socket-debug';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  type: z.enum(['text', 'image', 'video', 'audio', 'document']).default('text'),
});

const messageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sendMessage: FastifyPluginAsyncZod = async (app) => {
  app.post('/:conversationId/messages', {
    preHandler: authenticate,
    schema: {
      tags: ['Messages'],
      description: 'Send a message to a conversation',
      params: z.object({
        conversationId: z.string().uuid(),
      }),
      body: sendMessageSchema,
      response: {
        201: messageResponseSchema,
        403: z.object({
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
    const { conversationId } = request.params;
    const { content, type } = request.body;
    const userId = (request as any).user.id;

    try {
      // Check if user is member of conversation
      const [membership] = await db
        .select()
        .from(conversationMembers)
        .where(and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.leftAt)
        ))
        .limit(1);

      if (!membership) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'You are not a member of this conversation',
        });
      }

      // Get sender information for Socket.IO event
      const [sender] = await db
        .select({
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Create message
      const [newMessage] = await db
        .insert(messages)
        .values({
          conversationId,
          senderId: userId,
          type,
          content,
        })
        .returning({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          content: messages.content,
          type: messages.type,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
        });

      // Emit Socket.IO event to notify other users in the conversation
      const socketService = getSimpleSocketService();
      if (socketService && sender) {
        const messageData = {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
          senderId: newMessage.senderId,
          senderName: sender.name,
          senderAvatar: sender.avatar,
          content: newMessage.content || '',
          type: newMessage.type,
          createdAt: newMessage.createdAt.toISOString(),
        };

        // Emit to all conversation members except the sender
        await socketService.emitToConversationMembers(
          conversationId,
          'message:new',
          messageData,
          userId // exclude sender
        );
        
        console.log(`📨 Message broadcast via Socket.IO to conversation ${conversationId}`);
      }

      return reply.status(201).send({
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        content: newMessage.content || '',
        type: newMessage.type,
        createdAt: newMessage.createdAt.toISOString(),
        updatedAt: newMessage.updatedAt.toISOString(),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to send message',
      });
    }
  });
};
