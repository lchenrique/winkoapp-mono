import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { StatusService } from '../../services/status-service';

const statusCleanupRequestSchema = z.object({
  fixAll: z.boolean().optional().default(false),
});

const statusCleanupResponseSchema = z.object({
  success: z.boolean(),
  fixed: z.number(),
  issues: z.array(z.string()),
  timestamp: z.string(),
});

export const statusCleanup: FastifyPluginAsyncZod = async (app) => {
  app.post('/status-cleanup', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Clean up status inconsistencies using StatusService',
      body: statusCleanupRequestSchema,
      response: {
        200: statusCleanupResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { fixAll } = request.body;
      
      console.log('🧹 StatusService: Starting status cleanup...');
      
      // Use StatusService cleanup method
      const result = await StatusService.cleanupInconsistentStatuses();
      
      console.log(`✅ StatusService: Cleanup completed - Fixed ${result.fixed} issues`);
      
      return {
        success: true,
        fixed: result.fixed,
        issues: result.issues,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error during status cleanup:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to cleanup status inconsistencies',
      });
    }
  });
};
