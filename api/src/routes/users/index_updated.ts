import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { profile } from './profile';
import { getUserById } from './get-user';
import { checkUsername } from './check-username';
import { findByUsername } from './find-by-username';

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de usuários
  await app.register(profile);        // GET /me - perfil do usuário autenticado
  await app.register(getUserById);    // GET /:id - buscar usuário por ID
  
  // Username routes
  await app.register(checkUsername, { prefix: '/check-username' });  // GET /check-username/:username
  await app.register(findByUsername, { prefix: '/username' });        // GET /username/:username
};
