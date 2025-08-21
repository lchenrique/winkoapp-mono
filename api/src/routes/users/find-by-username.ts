import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const findUserParamsSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatar: z.string().nullable(),
  status: z.string().nullable(),
  lastSeen: z.string().nullable(),
  isOnline: z.boolean(),
});

export const findByUsername: FastifyPluginAsyncZod = async (app) => {
  app.get('/:username', {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Find a user by username (for adding as contact)',
      params: findUserParamsSchema,
      response: {
        200: userSchema,
        404: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { username } = request.params;

    try {
      // Find user by username
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          phone: users.phone,
          avatar: users.avatar,
          status: users.status,
          lastSeen: users.lastSeen,
          isOnline: users.isOnline,
        })
        .from(users)
        .where(eq(users.username, username.toLowerCase()))
        .limit(1);

      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.lastSeen?.toISOString() || null,
        isOnline: user.isOnline ?? false,
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to find user',
      });
    }
  });
};
