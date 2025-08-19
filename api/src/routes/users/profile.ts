import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';

const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatar: z.string().nullable(),
  status: z.string().nullable(),
  lastSeen: z.string().nullable(),
  isOnline: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const profile: FastifyPluginAsyncZod = async (app) => {
  app.get('/me', {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Get current user profile',
      response: {
        200: userResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      lastSeen: user.lastSeen?.toISOString() || null,
      isOnline: user.isOnline ?? false,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });
};
