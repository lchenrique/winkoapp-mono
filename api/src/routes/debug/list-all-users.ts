import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db, users } from '../../lib/db';

export const listAllUsersDebug: FastifyPluginAsyncZod = async (app) => {
  app.get('/list-all-users', {
    schema: {
      tags: ['Debug'],
      description: 'List all users in the database (debug endpoint)',
    },
  }, async (request, reply) => {
    try {
      const allUsers = await db
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
        .orderBy(users.createdAt);

      return {
        totalUsers: allUsers.length,
        users: allUsers.map(user => ({
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          userStatus: user.userStatus || 'online',
          isOnline: user.isOnline || false,
          lastSeen: user.lastSeen?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
        }))
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
