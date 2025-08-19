import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, contacts, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const contactSchema = z.object({
  id: z.string(),
  nickname: z.string().nullable(),
  createdAt: z.string(),
  contact: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatar: z.string().nullable(),
    status: z.string().nullable(),
    lastSeen: z.string().nullable(),
    isOnline: z.boolean(),
  }),
});

export const listContacts: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Contacts'],
      description: 'Get all contacts for the authenticated user',
      
      response: {
        200: z.array(contactSchema),
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const userContacts = await db
        .select({
          id: contacts.id,
          nickname: contacts.nickname,
          createdAt: contacts.createdAt,
          // Contact user info
          contactId: users.id,
          contactEmail: users.email,
          contactPhone: users.phone,
          contactName: users.name,
          contactAvatar: users.avatar,
          contactStatus: users.status,
          contactLastSeen: users.lastSeen,
          contactIsOnline: users.isOnline,
        })
        .from(contacts)
        .innerJoin(users, eq(contacts.contactId, users.id))
        .where(eq(contacts.userId, userId))
        .orderBy(contacts.createdAt);

      // Transform to match expected response format
      const formattedContacts = userContacts.map(contact => ({
        id: contact.id,
        nickname: contact.nickname,
        createdAt: contact.createdAt.toISOString(),
        contact: {
          id: contact.contactId,
          name: contact.contactName,
          email: contact.contactEmail,
          phone: contact.contactPhone,
          avatar: contact.contactAvatar,
          status: contact.contactStatus,
          lastSeen: contact.contactLastSeen?.toISOString() || null,
          isOnline: contact.contactIsOnline ?? false,
        },
      }));

      return formattedContacts;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get contacts',
      });
    }
  });
};
