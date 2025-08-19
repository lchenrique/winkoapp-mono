import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, conversations, conversationMembers } from '../../lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const conversationSchema = z.object({
  id: z.string(),
  type: z.enum(['private', 'group']),
  name: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listConversations: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Conversations'],
      description: 'Get all conversations for the authenticated user',
      response: {
        200: z.array(conversationSchema),
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const userConversations = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
        .where(and(
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.leftAt)
        ))
        .orderBy(conversations.updatedAt);

      const formattedConversations = userConversations.map(conv => ({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      }));

      return formattedConversations;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get conversations',
      });
    }
  });
};
