import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

const checkUsernameParamsSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

const checkUsernameResponseSchema = z.object({
  available: z.boolean(),
  message: z.string(),
});

export const checkUsername: FastifyPluginAsyncZod = async (app) => {
  app.get('/:username', {
    schema: {
      tags: ['Users'],
      description: 'Check if a username is available',
      params: checkUsernameParamsSchema,
      response: {
        200: checkUsernameResponseSchema,
        400: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { username } = request.params;

    try {
      // Check if username already exists
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username.toLowerCase()))
        .limit(1);

      if (existingUser) {
        return {
          available: false,
          message: 'Username is already taken',
        };
      }

      return {
        available: true,
        message: 'Username is available',
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to check username availability',
      });
    }
  });
};
