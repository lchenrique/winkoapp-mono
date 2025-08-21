import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';
import { StatusService } from '../../services/status-service';

const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatar: z.string().nullable(),
  status: z.string().nullable(),
  userStatus: z.enum(['online', 'busy', 'away', 'offline']),
  effectiveStatus: z.enum(['online', 'busy', 'away', 'offline']),
  lastSeen: z.string().nullable(),
  isOnline: z.boolean(),
  isConnected: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getUserById: FastifyPluginAsyncZod = async (app) => {
  app.get('/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Get user profile by ID',
      params: z.object({
        id: z.string().uuid('Invalid user ID'),
      }),
      response: {
        200: userResponseSchema,
        404: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          name: users.name,
          avatar: users.avatar,
          status: users.status,
          userStatus: users.userStatus,
          lastSeen: users.lastSeen,
          isOnline: users.isOnline,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Get effective status using StatusService (single source of truth)
      const effectiveStatusInfo = await StatusService.getEffectiveUserStatus(id);
      const effectiveStatus = effectiveStatusInfo?.status || 'offline';
      const isConnected = effectiveStatusInfo?.isConnected || false;

      console.log(`🔍 getUserById: ${user.name} - DB status: ${user.userStatus}, Effective: ${effectiveStatus}, Connected: ${isConnected}`);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status,
        userStatus: user.userStatus || 'online', // Raw status from DB
        effectiveStatus, // Calculated status (SOURCE OF TRUTH)
        lastSeen: user.lastSeen?.toISOString() || null,
        isOnline: user.isOnline ?? false, // Legacy field
        isConnected, // Real connection status
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get user profile',
      });
    }
  });
};
