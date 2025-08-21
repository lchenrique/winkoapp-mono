import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db, users } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { PresenceManager } from '../../lib/redis';
import { getSocketService } from '../../services/socket';

export const syncDatabaseStatus: FastifyPluginAsyncZod = async (app) => {
  app.post('/sync-database-status', {
    schema: {
      tags: ['Debug'],
      description: 'Force sync database status with real connections',
    },
  }, async (request, reply) => {
    try {
      console.log('🔄 Starting database status synchronization...');
      
      // Get all users from database
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          userStatus: users.userStatus,
          isOnline: users.isOnline,
        })
        .from(users);
      
      const socketService = getSocketService();
      const updates = [];
      
      for (const user of allUsers) {
        // Check real connection status
        const isReallyOnline = await PresenceManager.isUserOnline(user.id);
        const hasSocketConnection = socketService ? socketService.isUserOnline(user.id) : false;
        
        console.log(`👤 User ${user.name}:`)
        console.log(`  - DB isOnline: ${user.isOnline}`)
        console.log(`  - DB userStatus: ${user.userStatus}`)
        console.log(`  - Redis online: ${isReallyOnline}`)
        console.log(`  - Socket connected: ${hasSocketConnection}`)
        
        const shouldBeOnline = isReallyOnline || hasSocketConnection;
        
        // More precise logic:
        // - If disconnected: should be offline
        // - If connected: preserve current status unless it's 'offline'
        let targetStatus = user.userStatus || 'online';
        if (!shouldBeOnline) {
          targetStatus = 'offline';
        } else if (user.userStatus === 'offline') {
          // User is connected but marked as offline - probably reconnected
          targetStatus = 'online';
        }
        // If connected and has away/busy/online status, preserve it
        
        const needsUpdate = user.isOnline !== shouldBeOnline || user.userStatus !== targetStatus;
        
        if (needsUpdate) {
          console.log(`  ⚠️ INCONSISTENT - Updating:`);
          console.log(`    isOnline: ${user.isOnline} → ${shouldBeOnline}`);
          console.log(`    userStatus: ${user.userStatus} → ${targetStatus}`);
          
          const newStatus = targetStatus;
          
          await db
            .update(users)
            .set({
              isOnline: shouldBeOnline,
              userStatus: newStatus,
              lastSeen: new Date(),
            })
            .where(eq(users.id, user.id));
            
          updates.push({
            userId: user.id,
            name: user.name,
            from: { isOnline: user.isOnline, userStatus: user.userStatus },
            to: { isOnline: shouldBeOnline, userStatus: newStatus }
          });
          
          // Broadcast the corrected status
          if (socketService) {
            await socketService.broadcastPresenceUpdateOptimized(user.id, shouldBeOnline);
            await socketService.broadcastStatusUpdate(user.id, newStatus);
          }
        } else {
          console.log(`  ✅ Status is consistent`)
        }
      }
      
      console.log(`✅ Synchronization complete. Updated ${updates.length} users.`)
      
      return {
        success: true,
        message: `Synchronized ${updates.length} users`,
        updates,
        totalUsers: allUsers.length
      };
    } catch (error) {
      console.error('Error syncing database status:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });
};
