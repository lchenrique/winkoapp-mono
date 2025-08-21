import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, users } from '../../lib/db';
import { eq, or } from 'drizzle-orm';

const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, "Username ou email é obrigatório"),
    password: z.string().min(1, "Senha é obrigatória"),
  }),
});

const loginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
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
  }),
});

export const login: FastifyPluginAsyncZod = async (app) => {
  app.post('/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Login with username/email and password',
      body: loginSchema.shape.body,
      response: {
        200: loginResponseSchema,
        400: z.object({
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
    const { identifier, password } = request.body;

    // Validate input
    if (!identifier || !password) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Username/email e senha são obrigatórios',
      });
    }

    try {
      // Determine if identifier is email or username
      const isEmail = identifier.includes('@');
      
      // Find user by email or username
      const [user] = await db
        .select()
        .from(users)
        .where(
          isEmail 
            ? eq(users.email, identifier)
            : eq(users.username, identifier)
        )
        .limit(1);

      if (!user || !await bcrypt.compare(password, user.password)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      // Update user online status
      await db
        .update(users)
        .set({
          isOnline: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Generate JWT token
      const token = app.jwt.sign({ userId: user.id });

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          status: user.status,
          lastSeen: new Date().toISOString(),
          isOnline: true,
          createdAt: user.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to login',
      });
    }
  });
};
