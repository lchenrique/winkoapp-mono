import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { StatusService } from '../../services/status-service';

const contactsStatusRequestSchema = z.object({
  contactIds: z.array(z.string().uuid()),
});

const contactStatusSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  status: z.enum(['online', 'busy', 'away', 'offline']),
  isConnected: z.boolean(),
  lastSeen: z.string(),
});

const contactsStatusResponseSchema = z.array(contactStatusSchema);

export const contactsStatus: FastifyPluginAsyncZod = async (app) => {
  app.post('/contacts-status', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Get effective status for contacts (single source of truth)',
      body: contactsStatusRequestSchema,
      response: {
        200: contactsStatusResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { contactIds } = request.body;
      
      console.log(`🔍 StatusService: Getting status for ${contactIds.length} contacts`);
      
      // Use StatusService as single source of truth
      const statusResults = await StatusService.getEffectiveUserStatuses(contactIds);
      
      const response = statusResults.map(result => ({
        userId: result.userId,
        userName: result.userName,
        status: result.status,
        isConnected: result.isConnected,
        lastSeen: result.lastSeen.toISOString(),
      }));
      
      console.log(`✅ StatusService: Retrieved status for ${response.length} users`);
      response.forEach(status => {
        console.log(`   ${status.userName}: ${status.status} (connected: ${status.isConnected})`);
      });
      
      return response;
      
    } catch (error) {
      console.error('Error getting contacts status:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get contacts status',
      });
    }
  });
};
