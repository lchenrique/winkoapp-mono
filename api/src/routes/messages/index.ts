import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { listMessages } from './list';
import { sendMessage } from './send';
import { markMessageDelivered } from './mark-delivered';
import { markMessageRead } from './mark-read';
import { getMessageStatus } from './status';

export const messageRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de mensagens
  await app.register(listMessages);     // GET /:conversationId/messages
  await app.register(sendMessage);      // POST /:conversationId/messages
  await app.register(markMessageDelivered); // POST /:conversationId/messages/mark-delivered
  await app.register(markMessageRead);  // POST /:conversationId/messages/mark-read
  await app.register(getMessageStatus); // GET /:conversationId/messages/status
};
