import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { listContacts } from './list';
import { addContact } from './add';

export const contactRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de contatos
  await app.register(listContacts);     // GET /contacts
  await app.register(addContact);       // POST /contacts
};
