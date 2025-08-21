import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, messages, users, messageStatus } from '../../lib/db';
import { eq, asc, desc, and, isNull, or, ne, inArray } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { getSocketService } from '../../services/socket';

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
  status: z.enum(['sent', 'delivered', 'read']).nullable(),
  statusTimestamp: z.string().nullable(),
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
      const userId = (request as any).user.id;
      
      // Get messages with sender info
      const conversationMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          type: messages.type,
          createdAt: messages.createdAt,
          senderId: messages.senderId,
          // Sender info
          senderName: users.name,
          senderAvatar: users.avatar,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      // Now we need to get the correct status for each message
      const messageIds = conversationMessages.map(m => m.id);
      
      // Get status information for all messages
      let statusRecords: any[] = [];
      if (messageIds.length > 0) {
        statusRecords = await db
          .select({
            messageId: messageStatus.messageId,
            userId: messageStatus.userId,
            status: messageStatus.status,
            timestamp: messageStatus.timestamp,
          })
          .from(messageStatus)
          .where(inArray(messageStatus.messageId, messageIds));
      }
        
      // Build status map for quick lookup
      const statusMap = new Map<string, Array<{userId: string; status: string; timestamp: Date}>>();
      for (const record of statusRecords) {
        if (!statusMap.has(record.messageId)) {
          statusMap.set(record.messageId, []);
        }
        statusMap.get(record.messageId)?.push({
          userId: record.userId,
          status: record.status,
          timestamp: record.timestamp
        });
      }
      
      // Transform to expected format
      const formattedMessages = conversationMessages.map(message => {
        let messageStatus = null;
        let statusTimestamp = null;
        
        // For messages sent BY current user, show aggregated status from recipients
        if (message.senderId === userId) {
          const statuses = statusMap.get(message.id) || [];
          const recipientStatuses = statuses.filter(s => s.userId !== userId);
          
          if (recipientStatuses.length > 0) {
            // Find the lowest status level (sent < delivered < read)
            const hasRead = recipientStatuses.some(s => s.status === 'read');
            const hasDelivered = recipientStatuses.some(s => s.status === 'delivered');
            
            if (hasRead) {
              messageStatus = 'read';
              const readStatus = recipientStatuses.find(s => s.status === 'read');
              statusTimestamp = readStatus?.timestamp.toISOString() || null;
            } else if (hasDelivered) {
              messageStatus = 'delivered';
              const deliveredStatus = recipientStatuses.find(s => s.status === 'delivered');
              statusTimestamp = deliveredStatus?.timestamp.toISOString() || null;
            } else {
              messageStatus = 'sent';
            }
          } else {
            messageStatus = 'sent'; // No recipient status = just sent
          }
        } else {
          // For messages received BY current user, show their read status
          const statuses = statusMap.get(message.id) || [];
          const currentUserStatus = statuses.find(s => s.userId === userId);
          
          if (currentUserStatus) {
            messageStatus = currentUserStatus.status;
            statusTimestamp = currentUserStatus.timestamp.toISOString();
          } else {
            messageStatus = 'sent'; // Default status for untracked messages
          }
        }
        
        return {
          id: message.id,
          content: message.content || '',
          type: message.type,
          createdAt: message.createdAt.toISOString(),
          sender: {
            id: message.senderId,
            name: message.senderName,
            avatar: message.senderAvatar,
          },
          status: messageStatus,
          statusTimestamp,
        };
      });

      // Auto-mark messages as delivered for messages from other users that don't have status yet
      const messagesToMarkDelivered = conversationMessages.filter(message => {
        const statuses = statusMap.get(message.id) || [];
        const currentUserStatus = statuses.find(s => s.userId === userId);
        return message.senderId !== userId && !currentUserStatus;
      });

      if (messagesToMarkDelivered.length > 0) {
        try {
          // Batch insert delivery status for undelivered messages
          const deliveryRecords = messagesToMarkDelivered.map(message => ({
            messageId: message.id,
            userId: userId,
            status: 'delivered' as const,
            timestamp: new Date(),
          }));

          await db.insert(messageStatus).values(deliveryRecords);

          // Add to statusMap for immediate use
          messagesToMarkDelivered.forEach(message => {
            if (!statusMap.has(message.id)) {
              statusMap.set(message.id, []);
            }
            statusMap.get(message.id)?.push({
              userId: userId,
              status: 'delivered',
              timestamp: new Date()
            });
          });

          // Emit Socket.IO events for each delivered message
          const socketService = getSocketService();
          if (socketService) {
            for (const message of messagesToMarkDelivered) {
              await socketService.emitToConversationMembers(
                conversationId,
                'message:delivered',
                {
                  messageId: message.id,
                  userId,
                  timestamp: new Date().toISOString(),
                }
              );
            }
            console.log(`📨 Auto-marked ${messagesToMarkDelivered.length} messages as delivered for user ${userId}`);
          }
        } catch (deliveryError) {
          request.log.warn(deliveryError, 'Failed to auto-mark messages as delivered');
          // Don't fail the request if delivery marking fails
        }
      }

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
