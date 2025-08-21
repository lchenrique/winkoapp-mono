import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PresenceManager } from '../../lib/redis';
import { db, users, contacts } from '../../lib/db';
import { eq, inArray } from 'drizzle-orm';
import { authenticate } from '../../middlewares/auth';

const contactsPresenceRequestSchema = z.object({
  contactIds: z.array(z.string().uuid()).max(100), // Limit to 100 contacts per request
});

const contactPresenceSchema = z.object({
  userId: z.string(),
  isOnline: z.boolean(),
  lastSeen: z.string(),
  deviceCount: z.number().optional(),
});

const contactsPresenceResponseSchema = z.array(contactPresenceSchema);

export const contactsPresenceDebug: FastifyPluginAsyncZod = async (app) => {
  app.post('/contacts-presence', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Get presence status for multiple contacts',
      body: contactsPresenceRequestSchema,
      response: {
        200: contactsPresenceResponseSchema,
        401: z.object({
          error: z.string(),
          message: z.string(),
          statusCode: z.number(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { contactIds } = request.body;
      
      if (contactIds.length === 0) {
        return [];
      }

      console.log(`🔍 Fetching presence for ${contactIds.length} contacts`);

      // Get authenticated user ID (guaranteed by preHandler)
      const userId = (request as any).user.id;

      // Verify the user actually has these contacts
      const userContacts = await db
        .select({ contactId: contacts.contactId })
        .from(contacts)
        .where(eq(contacts.userId, userId));
      
      const validContactIds = userContacts
        .map(c => c.contactId)
        .filter(id => contactIds.includes(id));

      if (validContactIds.length === 0) {
        return [];
      }

      // Get presence information from Redis for each contact
      const presencePromises = validContactIds.map(async (contactId) => {
        try {
          const presence = await PresenceManager.getUserPresence(contactId);
          
          if (presence) {
            return {
              userId: contactId,
              isOnline: presence.isOnline,
              lastSeen: presence.lastSeen,
              deviceCount: presence.deviceCount,
            };
          } else {
            // Fallback to database if not in Redis
            const [user] = await db
              .select({
                id: users.id,
                isOnline: users.isOnline,
                lastSeen: users.lastSeen,
              })
              .from(users)
              .where(eq(users.id, contactId))
              .limit(1);

            return {
              userId: contactId,
              isOnline: user?.isOnline || false,
              lastSeen: user?.lastSeen?.toISOString() || new Date().toISOString(),
              deviceCount: 0,
            };
          }
        } catch (error) {
          console.error(`Error fetching presence for contact ${contactId}:`, error);
          return {
            userId: contactId,
            isOnline: false,
            lastSeen: new Date().toISOString(),
            deviceCount: 0,
          };
        }
      });

      const presenceResults = await Promise.all(presencePromises);
      
      console.log(`✅ Returned presence for ${presenceResults.length} contacts`);
      
      return presenceResults;

    } catch (error) {
      console.error('Error in contacts-presence endpoint:', error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to get contacts presence',
      });
    }
  });
};
