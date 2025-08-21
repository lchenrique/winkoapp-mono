import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { db, users } from '../../lib/db';
import { eq, and } from 'drizzle-orm';

const userResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
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

const updateProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  avatar: z.string().url().optional(),
  status: z.string().max(255).optional(),
});

export const profile: FastifyPluginAsyncZod = async (app) => {
  // GET profile
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
      username: user.username,
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

  // PUT profile - update profile
  app.put('/me', {
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      description: 'Update current user profile',
      body: updateProfileSchema,
      response: {
        200: userResponseSchema,
        400: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        409: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const updateData = request.body;

    try {
      // If username is being updated, check if it's available
      if (updateData.username) {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.username, updateData.username.toLowerCase()),
            // Make sure it's not the current user
            eq(users.id, userId)
          ))
          .limit(1);

        if (!existingUser) {
          // Check if username is taken by another user
          const [takenUsername] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, updateData.username.toLowerCase()))
            .limit(1);

          if (takenUsername) {
            return reply.status(409).send({
              statusCode: 409,
              error: 'Conflict',
              message: 'Username is already taken',
            });
          }
        }

        // Convert username to lowercase
        updateData.username = updateData.username.toLowerCase();
      }

      // Update user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          name: users.name,
          avatar: users.avatar,
          status: users.status,
          lastSeen: users.lastSeen,
          isOnline: users.isOnline,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        lastSeen: updatedUser.lastSeen?.toISOString() || null,
        isOnline: updatedUser.isOnline ?? false,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to update profile',
      });
    }
  });
};
