import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db, contacts, users } from '../../lib/db';
import { eq, and, or } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const addContactSchema = z.object({
  // Accept either contactId (UUID), username (string), or email (string)
  contactId: z.string().uuid().optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string().email().optional(),
  nickname: z.string().max(100).optional(),
}).refine(data => data.contactId || data.username || data.email, {
  message: 'Either contactId, username, or email must be provided',
});

const contactResponseSchema = z.object({
  id: z.string(),
  nickname: z.string().nullable(),
  createdAt: z.string(),
  contact: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatar: z.string().nullable(),
    status: z.string().nullable(),
    lastSeen: z.string().nullable(),
    isOnline: z.boolean(),
  }),
});

export const addContactLegacy: FastifyPluginAsyncZod = async (app) => {
  app.post('/add-direct', {
    preHandler: authenticate,
    schema: {
      tags: ['Contacts'],
      description: 'DEPRECATED: Add a user directly as contact (bypassing friend request system). Use only for testing/admin purposes.',
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
    const { contactId, username, email, nickname } = request.body;
    const userId = (request as any).user.id;

    // Only allow in development/testing
    if (process.env.NODE_ENV === 'production') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Direct contact addition is disabled in production. Use friend requests instead.',
      });
    }

    try {
      // Find contact user by either ID, username, or email
      let contactUser;
      if (contactId) {
        [contactUser] = await db
          .select({
            id: users.id,
            username: users.username,
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
      } else if (username) {
        [contactUser] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            phone: users.phone,
            name: users.name,
            avatar: users.avatar,
            status: users.status,
            lastSeen: users.lastSeen,
            isOnline: users.isOnline,
          })
          .from(users)
          .where(eq(users.username, username.toLowerCase()))
          .limit(1);
      } else if (email) {
        [contactUser] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            phone: users.phone,
            name: users.name,
            avatar: users.avatar,
            status: users.status,
            lastSeen: users.lastSeen,
            isOnline: users.isOnline,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
      }

      if (!contactUser) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Check if trying to add yourself
      if (contactUser.id === userId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot add yourself as a contact',
        });
      }

      // Check if contact already exists
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(
          eq(contacts.userId, userId),
          eq(contacts.contactId, contactUser.id)
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
          contactId: contactUser.id,
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
          username: contactUser.username,
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
