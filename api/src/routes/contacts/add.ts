import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, contacts, users } from '../../lib/db';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const addContactSchema = z.object({
  contactId: z.string().uuid(),
  nickname: z.string().max(100).optional(),
});

const contactResponseSchema = z.object({
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

export const addContact: FastifyPluginAsyncZod = async (app) => {
  app.post('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Contacts'],
      description: 'Add a user to your contacts list',
      body: addContactSchema,
      response: {
        201: contactResponseSchema,
        400: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        404: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
        409: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { contactId, nickname } = request.body;
    const userId = (request as any).user.id;

    if (contactId === userId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Cannot add yourself as a contact',
      });
    }

    try {
      // Check if contact user exists
      const [contactUser] = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          name: users.name,
          avatar: users.avatar,
          status: users.status,
          lastSeen: users.lastSeen,
          isOnline: users.isOnline,
        })
        .from(users)
        .where(eq(users.id, contactId))
        .limit(1);

      if (!contactUser) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Check if contact already exists
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(
          eq(contacts.userId, userId),
          eq(contacts.contactId, contactId)
        ))
        .limit(1);

      if (existingContact) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Contact already exists',
        });
      }

      // Add contact
      const [newContact] = await db
        .insert(contacts)
        .values({
          userId,
          contactId,
          nickname: nickname || null,
        })
        .returning({
          id: contacts.id,
          nickname: contacts.nickname,
          createdAt: contacts.createdAt,
        });

      return reply.status(201).send({
        id: newContact.id,
        nickname: newContact.nickname,
        createdAt: newContact.createdAt.toISOString(),
        contact: {
          id: contactUser.id,
          name: contactUser.name,
          email: contactUser.email,
          phone: contactUser.phone,
          avatar: contactUser.avatar,
          status: contactUser.status,
          lastSeen: contactUser.lastSeen?.toISOString() || null,
          isOnline: contactUser.isOnline ?? false,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to add contact',
      });
    }
  });
};
