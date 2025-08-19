import { FastifyRequest, FastifyReply } from 'fastify';
import { db, users } from '../lib/db';
import { eq } from 'drizzle-orm';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = await request.jwtVerify<{ userId: string }>();
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        name: users.name,
        avatar: users.avatar,
        status: users.status,
        isOnline: users.isOnline,
        lastSeen: users.lastSeen,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, token.userId))
      .limit(1);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid token',
        statusCode: 401,
      });
    }

    request.user = user as any;
  } catch (error) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing token',
      statusCode: 401,
    });
  }
}
