import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { StatusService, UserStatus } from '../../services/status-service';

const updateStatusRequestSchema = z.object({
  userStatus: z.enum(['online', 'busy', 'away', 'offline']),
});

const updateStatusResponseSchema = z.object({
  success: z.boolean(),
  userStatus: z.enum(['online', 'busy', 'away', 'offline']),
  isConnected: z.boolean(),
  message: z.string(),
});

export const updateStatus: FastifyPluginAsyncZod = async (app) => {
  const statusUpdateHandler = async (request: any, reply: any) => {
    try {
      const { userStatus } = request.body;
      const userId = (request as any).user.id;
      
      console.log(`📊 StatusService: User ${userId} requesting status change to ${userStatus}`);
      
      // Use StatusService as single source of truth
      const updatedStatus = await StatusService.updateUserStatus(userId, userStatus as UserStatus);
      
      if (!updatedStatus) {
        return reply.status(500).send({
          success: false,
          message: 'Failed to update status',
        });
      }
      
      console.log(`✅ StatusService: User ${userId} status updated successfully`);
      console.log(`   Requested: ${userStatus}`);
      console.log(`   Effective: ${updatedStatus.status}`);
      console.log(`   Connected: ${updatedStatus.isConnected}`);
      
      return {
        success: true,
        userStatus: updatedStatus.status,
        isConnected: updatedStatus.isConnected,
        message: `Status updated to ${updatedStatus.status}`,
      };
      
    } catch (error) {
      console.error('Error updating user status:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update status',
      });
    }
  };

  const schemaConfig = {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Update user status (single source of truth)',
      body: updateStatusRequestSchema,
      response: {
        200: updateStatusResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  };

  // Register both routes for compatibility
  app.put('/status', schemaConfig, statusUpdateHandler);
  app.patch('/me/status', schemaConfig, statusUpdateHandler);
};
