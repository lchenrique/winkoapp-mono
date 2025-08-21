import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, users } from '../../lib/db';
import { eq, or } from 'drizzle-orm';

const registerSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(20).optional(),
    password: z.string().min(6).max(100),
    name: z.string().min(1).max(100),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone is required"
  }),
});

const registerResponseSchema = z.object({
  token: z.string(),
  user: z.object({
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
  }),
});

export const register: FastifyPluginAsyncZod = async (app) => {
  app.post('/register', {
    schema: {
      tags: ['Authentication'],
      description: 'Register a new user account',
      body: registerSchema.shape.body,
      response: {
        201: registerResponseSchema,
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
    const { username, email, phone, password, name } = request.body;

    // Validate input
    if (!email && !phone) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Either email or phone is required',
      });
    }

    try {
      // Check if user already exists (username, email, or phone)
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            eq(users.username, username.toLowerCase()),
            email ? eq(users.email, email) : undefined,
            phone ? eq(users.phone, phone) : undefined
          )
        )
        .limit(1);

      if (existingUser.length > 0) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'User with this username, email, or phone already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          username: username.toLowerCase(),
          email: email || null,
          phone: phone || null,
          password: hashedPassword,
          name,
        })
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

      // Generate JWT token
      const token = app.jwt.sign({ userId: newUser.id });

      return reply.status(201).send({
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          avatar: newUser.avatar,
          status: newUser.status,
          lastSeen: newUser.lastSeen?.toISOString() || null,
          isOnline: newUser.isOnline ?? false,
          createdAt: newUser.createdAt.toISOString(),
          updatedAt: newUser.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  });
};
