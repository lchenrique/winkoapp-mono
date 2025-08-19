import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createConversation } from './create';
import { listConversations } from './list';

export const conversationRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de conversas
  await app.register(createConversation);     // POST /conversations
  await app.register(listConversations);     // GET /conversations
};
