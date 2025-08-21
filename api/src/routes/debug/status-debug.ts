import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth';
import { StatusService } from '../../services/status-service';
import { getSocketService } from '../../services/socket';

export const statusDebug: FastifyPluginAsyncZod = async (app) => {
  app.get('/status-debug', {
    preHandler: authenticate,
    schema: {
      tags: ['Debug'],
      description: 'Debug status system - show all users status in real time',
    },
  }, async (request, reply) => {
    try {
      const socketService = getSocketService();
      
      console.log('🔍 STATUS DEBUG STARTED');
      
      // 1. Lista de usuários conectados no Socket.IO
      const connectedUsers = socketService ? socketService.getOnlineUsersList() : [];
      console.log('📡 Connected users from Socket.IO:', connectedUsers);
      
      // 2. Status efetivo de todos os usuários conectados
      const statusResults = await StatusService.getEffectiveUserStatuses(connectedUsers);
      
      // 3. Verificar também usuários específicos (se existirem)
      const specificUsers = ['bob-id', 'alice-id']; // IDs de exemplo
      const specificResults = await StatusService.getEffectiveUserStatuses(specificUsers);
      
      const response = {
        timestamp: new Date().toISOString(),
        socketService: {
          available: !!socketService,
          connectedUsers: connectedUsers,
          connectedCount: connectedUsers.length,
        },
        connectedUsersStatus: statusResults,
        specificUsersStatus: specificResults,
        debug: {
          message: 'Check console logs for detailed information',
        }
      };
      
      console.log('🔍 STATUS DEBUG RESULT:', JSON.stringify(response, null, 2));
      
      return response;
      
    } catch (error) {
      console.error('Error in status debug:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to debug status',
      });
    }
  });
};
