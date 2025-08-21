import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messageStatus } from '../../lib/db';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

const markReadSchema = z.object({
  messageId: z.string().uuid(),
});

export const markMessageRead: FastifyPluginAsyncZod = async (app) => {
  app.post('/:conversationId/messages/mark-read', {
    preHandler: authenticate,
    schema: {
      tags: ['Messages'],
      description: 'Mark a message as read',
      params: z.object({
        conversationId: z.string().uuid(),
      }),
      body: markReadSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
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
    const { messageId } = request.body;
    const userId = (request as any).user.id;

    try {
      // Check if this status record already exists
      const [existingStatus] = await db
        .select()
        .from(messageStatus)
        .where(and(
          eq(messageStatus.messageId, messageId),
          eq(messageStatus.userId, userId)
        ))
        .limit(1);

      if (existingStatus) {
        // Update existing status to 'read'
        await db
          .update(messageStatus)
          .set({ 
            status: 'read',
            timestamp: new Date(),
          })
          .where(and(
            eq(messageStatus.messageId, messageId),
            eq(messageStatus.userId, userId)
          ));
      } else {
        // Insert new status record directly as 'read'
        await db
          .insert(messageStatus)
          .values({
            messageId,
            userId,
            status: 'read',
          });
      }

      // Emit Socket.IO event to notify the sender
      const socketService = getSocketService();
      if (socketService) {
        await socketService.emitToConversationMembers(
          conversationId,
          'message:read',
          {
            messageId,
            userId,
            timestamp: new Date().toISOString(),
          }
        );
        
        console.log(`📖 Message ${messageId} marked as read by user ${userId}`);
      }

      return reply.status(200).send({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to mark message as read',
      });
    }
  });
};
