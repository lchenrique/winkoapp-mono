import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messages, users } from '../../lib/db';
import { eq, asc } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document']),
  createdAt: z.string(),
  sender: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
});

export const listMessages: FastifyPluginAsyncZod = async (app) => {
  app.get('/:conversationId/messages', {
    preHandler: authenticate,
    schema: {
      tags: ['Messages'],
      description: 'Get messages from a conversation',
      params: z.object({
        conversationId: z.string(),
      }),
      querystring: z.object({
        limit: z.coerce.number().int().positive().max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.array(messageSchema),
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        403: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { conversationId } = request.params;
    const { limit, offset } = request.query;

    try {
      // Get messages with sender info
      const conversationMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          type: messages.type,
          createdAt: messages.createdAt,
          // Sender info
          senderId: users.id,
          senderName: users.name,
          senderAvatar: users.avatar,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform to expected format
      const formattedMessages = conversationMessages.map(message => ({
        id: message.id,
        content: message.content || '',
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.senderId,
          name: message.senderName,
          avatar: message.senderAvatar,
        },
      }));

      return formattedMessages;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get messages',
      });
    }
  });
};
