import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';

export const findUserByEmailDebug: FastifyPluginAsyncZod = async (app) => {
  app.get('/find-user-by-email/:email', {
    schema: {
      tags: ['Debug'],
      description: 'Find user by email (debug endpoint)',
      params: z.object({
        email: z.string().email(),
      }),
    },
  }, async (request, reply) => {
    const { email } = request.params;

    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          userStatus: users.userStatus,
          isOnline: users.isOnline,
          lastSeen: users.lastSeen,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.send({
          found: false,
          message: 'Usuário não encontrado'
        });
      }

      return {
        found: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          userStatus: user.userStatus,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Erro interno do servidor',
        message: error.message,
      });
    }
  });
};
