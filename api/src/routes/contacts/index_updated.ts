import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { listContacts } from './list';
import { addContactLegacy } from './add_legacy';

export const contactRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de contatos
  await app.register(listContacts);     // GET /contacts
  
  // Legacy route for direct contact addition (development only)
  await app.register(addContactLegacy); // POST /contacts/add-direct
};
