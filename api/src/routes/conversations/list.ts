import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, conversations, conversationMembers, users } from '../../lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  conversationId: z.string(),
  isAdmin: z.boolean(),
  joinedAt: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    avatar: z.string().nullable(),
  }),
});

const conversationSchema = z.object({
  id: z.string(),
  type: z.enum(['private', 'group']),
  name: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.array(memberSchema),
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
      // First get user's conversations
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

      // Then get members for each conversation
      const conversationsWithMembers = await Promise.all(
        userConversations.map(async (conv) => {
          const members = await db
            .select({
              id: conversationMembers.id,
              userId: conversationMembers.userId,
              conversationId: conversationMembers.conversationId,
              isAdmin: conversationMembers.isAdmin,
              joinedAt: conversationMembers.joinedAt,
              // User info
              userName: users.name,
              userUsername: users.username,
              userEmail: users.email,
              userAvatar: users.avatar,
            })
            .from(conversationMembers)
            .innerJoin(users, eq(conversationMembers.userId, users.id))
            .where(and(
              eq(conversationMembers.conversationId, conv.id),
              isNull(conversationMembers.leftAt)
            ));

          return {
            id: conv.id,
            type: conv.type,
            name: conv.name,
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString(),
            members: members.map(member => ({
              id: member.id,
              userId: member.userId,
              conversationId: member.conversationId,
              isAdmin: member.isAdmin ?? false,
              joinedAt: member.joinedAt.toISOString(),
              user: {
                id: member.userId,
                username: member.userUsername,
                name: member.userName,
                email: member.userEmail,
                avatar: member.userAvatar,
              },
            })),
          };
        })
      );

      return conversationsWithMembers;
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
