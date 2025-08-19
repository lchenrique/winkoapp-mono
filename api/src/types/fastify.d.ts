import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      name: string;
      avatar: string | null;
      status: string | null;
      isOnline: boolean | null;
      lastSeen: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
