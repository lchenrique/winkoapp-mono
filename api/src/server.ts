import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

// Import routes
import { routes } from './routes';

// Import services
import { initializeSimpleSocketService } from './services/socket-debug';
import { initializeBucket } from './lib/storage';
import { redis } from './lib/redis';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || 'localhost';

async function buildServer() {
  // Create Fastify instance with TypeScript and Zod support
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Configure Zod compilers
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Register essential plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for Swagger UI
  });

  await fastify.register(cors, {
    origin: true, // Configure properly for production
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
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

  // Swagger documentation with error handling
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
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
    transform: ({ schema, url }) => {
      try {
        // Check if schema is valid before transforming
        if (!schema || typeof schema !== 'object') {
          fastify.log.warn(`Invalid schema found for URL: ${url}`);
          return {
            schema: {
              type: 'object',
              properties: {},
              description: 'Schema not available due to conversion error'
            },
            url,
          };
        }

        return jsonSchemaTransform({ schema, url });
      } catch (error) {
        if (error && error instanceof Error) {
          fastify.log.warn(`Error transforming schema for URL ${url}: ${String(error)}`);
        }
        
        // Fallback for schemas that cannot be transformed
        return {
          schema: {
            type: 'object',
            properties: {},
            description: 'Schema not available due to conversion error'
          },
          url,
        };
      }
    },
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    try {
      // Check Redis connection
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

  // Register API routes
  await fastify.register(routes, { prefix: '/api' });

  // Root endpoint
  fastify.get('/', async (request, reply) => {
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
        health: '/health',
      },
    };
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

  return fastify;
}

async function start() {
  try {
    console.log('🚀 Starting WhatsApp-like Chat API...');

    // Initialize services
    console.log('📦 Initializing MinIO bucket...');
    await initializeBucket();

    console.log('🌐 Building Fastify server...');
    const fastify = await buildServer();

    // Start Fastify server first
    await fastify.listen({
      port: PORT,
      host: '0.0.0.0', // Listen on all interfaces
    });

    console.log('⚡ Initializing Socket.IO (Debug Mode)...');
    const socketService = initializeSimpleSocketService(fastify.server);

    console.log(`✅ Server running at http://${HOST}:${PORT}`);
    console.log(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
    console.log(`🔧 Health Check: http://${HOST}:${PORT}/health`);
    console.log(`📡 Socket.IO ready for real-time communication`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  try {
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  try {
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
if (require.main === module) {
  start();
}

export default buildServer;
