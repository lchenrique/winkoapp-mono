import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authRoutes } from './auth';
import { userRoutes } from './users';
import { contactRoutes } from './contacts';
import { conversationRoutes } from './conversations';
import { messageRoutes } from './messages';

export const routes: FastifyPluginAsyncZod = async (app) => {
  // Registro de todas as rotas da API
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(contactRoutes, { prefix: '/contacts' });
  await app.register(conversationRoutes, { prefix: '/conversations' });
  await app.register(messageRoutes, { prefix: '/conversations' });
};
