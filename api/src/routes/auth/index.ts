import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { login } from './login';
import { register } from './register';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Registro das rotas de autenticação
  await app.register(login);
  await app.register(register);
};
