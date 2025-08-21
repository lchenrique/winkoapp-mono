import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messageStatus } from '../../lib/db';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

const markDeliveredSchema = z.object({
  messageId: z.string().uuid(),
});

export const markMessageDelivered: FastifyPluginAsyncZod = async (app) => {
  app.post('/:conversationId/messages/mark-delivered', {
    preHandler: authenticate,
    schema: {
      tags: ['Messages'],
      description: 'Mark a message as delivered',
      params: z.object({
        conversationId: z.string().uuid(),
      }),
      body: markDeliveredSchema,
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
        // If status is already 'read', don't downgrade to 'delivered'
        if (existingStatus.status === 'read') {
          return reply.status(200).send({
            success: true,
            message: 'Message already marked as read',
          });
        }
        
        // Update existing status
        await db
          .update(messageStatus)
          .set({ 
            status: 'delivered',
            timestamp: new Date(),
          })
          .where(and(
            eq(messageStatus.messageId, messageId),
            eq(messageStatus.userId, userId)
          ));
      } else {
        // Insert new status record
        await db
          .insert(messageStatus)
          .values({
            messageId,
            userId,
            status: 'delivered',
          });
      }

      // Emit Socket.IO event to notify the sender
      const socketService = getSocketService();
      if (socketService) {
        await socketService.emitToConversationMembers(
          conversationId,
          'message:delivered',
          {
            messageId,
            userId,
            timestamp: new Date().toISOString(),
          }
        );
        
        console.log(`📨 Message ${messageId} marked as delivered by user ${userId}`);
      }

      return reply.status(200).send({
        success: true,
        message: 'Message marked as delivered',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to mark message as delivered',
      });
    }
  });
};
