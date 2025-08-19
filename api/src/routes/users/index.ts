import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { profile } from './profile';
import { getUserById } from './get-user';

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de usuários
  await app.register(profile);        // GET /me - perfil do usuário autenticado
  await app.register(getUserById);    // GET /:id - buscar usuário por ID
};
