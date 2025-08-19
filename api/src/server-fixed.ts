import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import bcrypt from 'bcryptjs';
import { db, users, contacts } from './lib/db';
import { eq, or, and } from 'drizzle-orm';
import { redis } from './lib/redis';
import { initializeBucket } from './lib/storage';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  getUserSchema,
  addContactSchema,
  removeContactSchema,
  authResponseSchema,
  userResponseSchema,
  contactResponseSchema,
  errorResponseSchema
} from './schemas';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || 'localhost';

async function start() {
  try {
    console.log('🚀 Starting WhatsApp-like Chat API...');

    // Initialize MinIO bucket
    console.log('📦 Initializing MinIO bucket...');
    await initializeBucket();

    // Create Fastify instance with ZodTypeProvider
    const server = Fastify({
      logger: {
        level: 'info',
      },
    }).withTypeProvider<ZodTypeProvider>();

    const fastify = server;

    // Register essential plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
    });

    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
        files: 1,
      },
    });

    // Swagger documentation
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'WhatsApp-like Chat API',
          description: 'Real-time chat API with JWT authentication, file uploads, and Socket.IO',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://${HOST}:${PORT}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });

    // Authentication middleware
    async function authenticate(request: any, reply: any) {
      try {
        const token = await request.jwtVerify();
        
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

        request.user = user;
      } catch (error) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or missing token',
          statusCode: 401,
        });
      }
    }

    // Health check
    fastify.get('/health', {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check if the API is running',
      }
    }, async (request, reply) => {
      try {
        await redis.ping();
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          services: {
            redis: 'connected',
            database: 'connected',
          },
        };
      } catch (error) {
        reply.code(503).send({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'Service unavailable',
        });
      }
    });

    // Root endpoint
    fastify.get('/', {
      schema: {
        tags: ['System'],
        summary: 'API Information',
        description: 'Get API information and available endpoints',
      }
    }, async (request, reply) => {
      return {
        name: 'WhatsApp-like Chat API',
        version: '1.0.0',
        description: 'Real-time chat API with JWT authentication, file uploads, and Socket.IO',
        documentation: '/docs',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          contacts: '/api/contacts',
          conversations: '/api/conversations',
          messages: '/api/conversations/:id/messages',
          upload: '/api/upload',
          health: '/health',
        },
      };
    });

    // AUTH ROUTES
    fastify.post('/api/auth/register', {
      schema: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Create a new user account with email or phone',
        body: {
          type: 'object',
          required: ['password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string', minLength: 1 },
          },
        },
      },
    }, async (request: any, reply) => {
      const { email, phone, password, name } = request.body;

      if (!email && !phone) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Either email or phone is required',
          statusCode: 400,
        });
      }

      try {
        // Check if user already exists
        const existingUser = await db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              email ? eq(users.email, email) : undefined,
              phone ? eq(users.phone, phone) : undefined
            )
          )
          .limit(1);

        if (existingUser.length > 0) {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'User with this email or phone already exists',
            statusCode: 409,
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const [newUser] = await db
          .insert(users)
          .values({
            email: email || null,
            phone: phone || null,
            password: hashedPassword,
            name,
          })
          .returning({
            id: users.id,
            email: users.email,
            phone: users.phone,
            name: users.name,
            avatar: users.avatar,
            status: users.status,
            lastSeen: users.lastSeen,
            isOnline: users.isOnline,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });

        // Generate JWT token
        const token = fastify.jwt.sign({ userId: newUser.id });

        return reply.code(201).send({
          token,
          user: newUser,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to create user',
          statusCode: 400,
        });
      }
    });

    fastify.post('/api/auth/login', {
      schema: {
        tags: ['Authentication'],
        summary: 'Login user',
        description: 'Authenticate user with email/phone and password',
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    }, async (request: any, reply) => {
      const { email, phone, password } = request.body;

      if (!email && !phone) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Either email or phone is required',
          statusCode: 400,
        });
      }

      try {
        // Find user
        const [user] = await db
          .select()
          .from(users)
          .where(
            or(
              email ? eq(users.email, email) : undefined,
              phone ? eq(users.phone, phone) : undefined
            )
          )
          .limit(1);

        if (!user) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid credentials',
            statusCode: 401,
          });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid credentials',
            statusCode: 401,
          });
        }

        // Update user online status
        await db
          .update(users)
          .set({
            isOnline: true,
            lastSeen: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Generate JWT token
        const token = fastify.jwt.sign({ userId: user.id });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        return reply.code(200).send({
          token,
          user: {
            ...userWithoutPassword,
            isOnline: true,
            lastSeen: new Date(),
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to login',
          statusCode: 400,
        });
      }
    });

    fastify.post('/api/auth/logout', {
      preHandler: authenticate,
      schema: {
        tags: ['Authentication'],
        summary: 'Logout user',
        description: 'Logout current user and update online status',
      },
    }, async (request: any, reply) => {
      try {
        // Update user offline status
        await db
          .update(users)
          .set({
            isOnline: false,
            lastSeen: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, request.user.id));

        return reply.code(200).send({
          message: 'Logged out successfully',
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to logout',
          statusCode: 400,
        });
      }
    });

    // USER ROUTES
    fastify.get('/api/users/me', {
      preHandler: authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Get current user profile',
        description: 'Get the profile of the authenticated user',
      },
    }, async (request: any, reply) => {
      return reply.code(200).send(request.user);
    });

    fastify.patch('/api/users/me', {
      preHandler: authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Update current user profile',
        description: 'Update name, status, or avatar of the authenticated user',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            status: { type: 'string' },
            avatar: { type: 'string', format: 'uri' },
          },
        },
      },
    }, async (request: any, reply) => {
      const { name, status, avatar } = request.body;

      try {
        const updates: any = {
          updatedAt: new Date(),
        };

        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;
        if (avatar !== undefined) updates.avatar = avatar;

        const [updatedUser] = await db
          .update(users)
          .set(updates)
          .where(eq(users.id, request.user.id))
          .returning({
            id: users.id,
            email: users.email,
            phone: users.phone,
            name: users.name,
            avatar: users.avatar,
            status: users.status,
            lastSeen: users.lastSeen,
            isOnline: users.isOnline,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });

        return reply.code(200).send(updatedUser);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to update user profile',
          statusCode: 400,
        });
      }
    });

    fastify.get('/api/users/:id', {
      preHandler: authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Get user profile by ID',
        description: 'Get public profile information of a user by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
      },
    }, async (request: any, reply) => {
      const { id } = request.params;

      try {
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            phone: users.phone,
            name: users.name,
            avatar: users.avatar,
            status: users.status,
            lastSeen: users.lastSeen,
            isOnline: users.isOnline,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);

        if (!user) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'User not found',
            statusCode: 404,
          });
        }

        return reply.code(200).send(user);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to get user profile',
          statusCode: 400,
        });
      }
    });

    // CONTACT ROUTES
    fastify.post('/api/contacts', {
      preHandler: authenticate,
      schema: {
        tags: ['Contacts'],
        summary: 'Add a new contact',
        description: 'Add a user to your contacts list',
        body: {
          type: 'object',
          required: ['contactId'],
          properties: {
            contactId: { type: 'string', format: 'uuid' },
            nickname: { type: 'string' },
          },
        },
      },
    }, async (request: any, reply) => {
      const { contactId, nickname } = request.body;
      const userId = request.user.id;

      if (contactId === userId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Cannot add yourself as a contact',
          statusCode: 400,
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
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.id, contactId))
          .limit(1);

        if (!contactUser) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'User not found',
            statusCode: 404,
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
          return reply.code(409).send({
            error: 'Conflict',
            message: 'Contact already exists',
            statusCode: 409,
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

        return reply.code(201).send({
          id: newContact.id,
          contact: contactUser,
          nickname: newContact.nickname,
          createdAt: newContact.createdAt,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to add contact',
          statusCode: 400,
        });
      }
    });

    fastify.get('/api/contacts', {
      preHandler: authenticate,
      schema: {
        tags: ['Contacts'],
        summary: 'Get all contacts',
        description: 'Get list of all contacts for the authenticated user',
      },
    }, async (request: any, reply) => {
      const userId = request.user.id;

      try {
        const userContacts = await db
          .select({
            id: contacts.id,
            nickname: contacts.nickname,
            createdAt: contacts.createdAt,
            contact: {
              id: users.id,
              email: users.email,
              phone: users.phone,
              name: users.name,
              avatar: users.avatar,
              status: users.status,
              lastSeen: users.lastSeen,
              isOnline: users.isOnline,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
            },
          })
          .from(contacts)
          .innerJoin(users, eq(contacts.contactId, users.id))
          .where(eq(contacts.userId, userId))
          .orderBy(contacts.createdAt);

        return reply.code(200).send(userContacts);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to get contacts',
          statusCode: 400,
        });
      }
    });

    fastify.delete('/api/contacts/:id', {
      preHandler: authenticate,
      schema: {
        tags: ['Contacts'],
        summary: 'Remove a contact',
        description: 'Remove a contact from your contacts list',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
      },
    }, async (request: any, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      try {
        // Check if contact exists and belongs to user
        const [existingContact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(
            eq(contacts.id, id),
            eq(contacts.userId, userId)
          ))
          .limit(1);

        if (!existingContact) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Contact not found',
            statusCode: 404,
          });
        }

        // Remove contact
        await db
          .delete(contacts)
          .where(eq(contacts.id, id));

        return reply.code(200).send({
          message: 'Contact removed successfully',
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Failed to remove contact',
          statusCode: 400,
        });
      }
    });

    // Global error handler
    fastify.setErrorHandler(async (error, request, reply) => {
      request.log.error(error);

      // Validation errors
      if (error.validation) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: error.validation,
          statusCode: 400,
        });
      }

      // JWT errors
      if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
          statusCode: 401,
        });
      }

      // Default error response
      return reply.code(error.statusCode || 500).send({
        error: error.name || 'Internal Server Error',
        message: error.message || 'Something went wrong',
        statusCode: error.statusCode || 500,
      });
    });

    await fastify.listen({
      port: PORT,
      host: '0.0.0.0',
    });

    console.log(`✅ Server running at http://${HOST}:${PORT}`);
    console.log(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
    console.log(`🔧 Health Check: http://${HOST}:${PORT}/health`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
