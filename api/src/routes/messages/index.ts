import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { listMessages } from './list';
import { sendMessage } from './send';

export const messageRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de mensagens
  await app.register(listMessages);     // GET /:conversationId/messages
  await app.register(sendMessage);      // POST /:conversationId/messages
};
