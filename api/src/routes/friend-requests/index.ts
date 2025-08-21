import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { sendFriendRequest } from './send';
import { respondToFriendRequest } from './respond';
import { listFriendRequests } from './list';

export const friendRequestRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de friend requests
  await app.register(sendFriendRequest);       // POST /send
  await app.register(respondToFriendRequest);  // POST /respond
  await app.register(listFriendRequests);      // GET /list
};
