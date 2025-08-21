import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messageStatus, messages } from '../../lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const messageStatusSchema = z.object({
  messageId: z.string(),
  status: z.enum(['sent', 'delivered', 'read']),
  timestamp: z.string(),
});

export const getMessageStatus: FastifyPluginAsyncZod = async (app) => {
  app.get('/:conversationId/messages/status', {
    preHandler: authenticate,
    schema: {
      tags: ['Messages'],
      description: 'Get message status for all messages in a conversation',
      params: z.object({
        conversationId: z.string().uuid(),
      }),
      querystring: z.object({
        messageIds: z.string().optional().describe('Comma-separated list of message IDs to filter'),
      }),
      response: {
        200: z.array(messageStatusSchema),
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
    const { messageIds } = request.query;
    const userId = (request as any).user.id;

    try {
      let query = db
        .select({
          messageId: messageStatus.messageId,
          status: messageStatus.status,
          timestamp: messageStatus.timestamp,
        })
        .from(messageStatus)
        .innerJoin(messages, eq(messages.id, messageStatus.messageId))
        .where(and(
          eq(messages.conversationId, conversationId),
          eq(messageStatus.userId, userId)
        ));

      // If specific message IDs are provided, filter by them
      if (messageIds) {
        const messageIdArray = messageIds.split(',').map(id => id.trim());
        query = query.where(and(
          eq(messages.conversationId, conversationId),
          eq(messageStatus.userId, userId),
          inArray(messageStatus.messageId, messageIdArray)
        ));
      }

      const statuses = await query;

      // Transform to expected format
      const formattedStatuses = statuses.map(status => ({
        messageId: status.messageId,
        status: status.status,
        timestamp: status.timestamp.toISOString(),
      }));

      return formattedStatuses;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get message statuses',
      });
    }
  });
};
