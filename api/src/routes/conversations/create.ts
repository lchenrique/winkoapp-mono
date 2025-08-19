import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, conversations, conversationMembers } from '../../lib/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const createConversationSchema = z.object({
  type: z.enum(['private', 'group']),
  name: z.string().min(1).max(100).optional(),
  memberIds: z.array(z.string().uuid()).min(1),
});

const conversationResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['private', 'group']),
  name: z.string().nullable(),
  createdAt: z.string(),
  members: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    isAdmin: z.boolean(),
    joinedAt: z.string(),
  })),
});

export const createConversation: FastifyPluginAsyncZod = async (app) => {
  app.post('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Conversations'],
      description: 'Create a new conversation',
      body: createConversationSchema,
      response: {
        201: conversationResponseSchema,
        400: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { type, name, memberIds } = request.body;
    const userId = (request as any).user.id;

    // For private conversations, ensure only 2 members (including creator)
    if (type === 'private' && memberIds.length !== 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Private conversation must have exactly 2 members',
      });
    }

    try {
      // For private conversations, check if conversation already exists
      if (type === 'private') {
        const otherUserId = memberIds[0];
        const allParticipants = [userId, otherUserId];
        
        // Find existing private conversations where both users are members
        const existingConversation = await db
          .select({
            id: conversations.id,
            type: conversations.type,
            name: conversations.name,
            createdAt: conversations.createdAt,
          })
          .from(conversations)
          .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
          .where(
            and(
              eq(conversations.type, 'private'),
              inArray(conversationMembers.userId, allParticipants)
            )
          )
          .groupBy(conversations.id, conversations.type, conversations.name, conversations.createdAt)
          .having(sql`COUNT(DISTINCT ${conversationMembers.userId}) = 2`)
          .limit(1);
        
        if (existingConversation.length > 0) {
          // Return existing conversation with its members
          const existingMembers = await db
            .select({
              id: conversationMembers.id,
              userId: conversationMembers.userId,
              isAdmin: conversationMembers.isAdmin,
              joinedAt: conversationMembers.joinedAt,
            })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, existingConversation[0].id));
          
          return reply.status(201).send({
            id: existingConversation[0].id,
            type: existingConversation[0].type,
            name: existingConversation[0].name,
            createdAt: existingConversation[0].createdAt.toISOString(),
            members: existingMembers.map(member => ({
              id: member.id,
              userId: member.userId,
              isAdmin: member.isAdmin,
              joinedAt: member.joinedAt.toISOString(),
            })),
          });
        }
      }
      
      // Create conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          type,
          name: type === 'group' ? name : null,
          createdBy: userId,
        })
        .returning({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
        });

      // Add creator as member
      await db.insert(conversationMembers).values({
        conversationId: newConversation.id,
        userId,
        isAdmin: type === 'group',
      });

      // Add other members
      const memberValues = memberIds.map(memberId => ({
        conversationId: newConversation.id,
        userId: memberId,
        isAdmin: false,
      }));

      if (memberValues.length > 0) {
        await db.insert(conversationMembers).values(memberValues);
      }

      // Get all members for response
      const members = await db
        .select({
          id: conversationMembers.id,
          userId: conversationMembers.userId,
          isAdmin: conversationMembers.isAdmin,
          joinedAt: conversationMembers.joinedAt,
        })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, newConversation.id));

      return reply.status(201).send({
        id: newConversation.id,
        type: newConversation.type,
        name: newConversation.name,
        createdAt: newConversation.createdAt.toISOString(),
        members: members.map(member => ({
          id: member.id,
          userId: member.userId,
          isAdmin: member.isAdmin,
          joinedAt: member.joinedAt.toISOString(),
        })),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to create conversation',
      });
    }
  });
};
