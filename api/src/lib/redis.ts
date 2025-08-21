import Redis from 'ioredis';
import { UserStatus, getEffectiveStatus, type UserPresence } from '../types/user-status';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Redis keys helper
export const RedisKeys = {
  userOnline: (userId: string) => `user:online:${userId}`,
  userSockets: (userId: string) => `user:sockets:${userId}`, // Changed to support multiple connections
  userDevices: (userId: string) => `user:devices:${userId}`, // Track device connections
  conversationMembers: (conversationId: string) => `conversation:members:${conversationId}`,
  messageDelivery: (messageId: string) => `message:delivery:${messageId}`,
  messageRead: (messageId: string) => `message:read:${messageId}`,
  userPresence: (userId: string) => `user:presence:${userId}`,
  contactsCache: (userId: string) => `contacts:cache:${userId}`,
  onlineUsersSet: () => 'online:users:set',
} as const;

// Device connection interface
export interface DeviceConnection {
  socketId: string;
  deviceId: string;
  userAgent?: string;
  connectedAt: string;
  lastHeartbeat: string;
}

// Enhanced Presence management with multiple connections support
export class PresenceManager {
  private static readonly HEARTBEAT_TIMEOUT = 20000; // 20 seconds (reduced)
  private static readonly PRESENCE_TIMEOUT = 60; // 1 minute (reduced from 5 minutes)
  private static readonly OFFLINE_RETENTION = 86400; // 24 hours

  /**
   * Add a device connection for a user
   */
  static async addUserConnection(userId: string, socketId: string, deviceId: string, userAgent?: string): Promise<boolean> {
    const pipeline = redis.pipeline();
    const now = new Date().toISOString();
    
    const deviceConnection: DeviceConnection = {
      socketId,
      deviceId,
      userAgent,
      connectedAt: now,
      lastHeartbeat: now,
    };

    // Add to user's socket set with expiration
    pipeline.hset(RedisKeys.userSockets(userId), socketId, JSON.stringify(deviceConnection));
    pipeline.expire(RedisKeys.userSockets(userId), this.PRESENCE_TIMEOUT);
    
    // Add to devices set
    pipeline.hset(RedisKeys.userDevices(userId), deviceId, socketId);
    pipeline.expire(RedisKeys.userDevices(userId), this.PRESENCE_TIMEOUT);
    
    // Add to global online users set
    pipeline.sadd(RedisKeys.onlineUsersSet(), userId);
    
    // Get current presence to preserve manual status
    const currentPresence = await redis.get(RedisKeys.userPresence(userId));
    let userStatus = UserStatus.ONLINE; // default
    if (currentPresence) {
      const data = JSON.parse(currentPresence);
      userStatus = data.userStatus || UserStatus.ONLINE;
    }
    
    // Update presence with enhanced data
    pipeline.set(RedisKeys.userPresence(userId), JSON.stringify({
      isConnected: true,
      isOnline: true, // legacy compatibility
      userStatus,
      lastSeen: now,
      deviceCount: await this.getDeviceCount(userId) + 1,
    }), 'EX', this.PRESENCE_TIMEOUT);
    
    const results = await pipeline.exec();
    return results?.every(([err]) => !err) || false;
  }

  /**
   * Remove a device connection for a user
   */
  static async removeUserConnection(userId: string, socketId: string): Promise<boolean> {
    const pipeline = redis.pipeline();
    const now = new Date().toISOString();
    
    // Get device info before removing
    const deviceData = await redis.hget(RedisKeys.userSockets(userId), socketId);
    let deviceId = null;
    if (deviceData) {
      const device: DeviceConnection = JSON.parse(deviceData);
      deviceId = device.deviceId;
    }
    
    // Remove from sockets hash
    pipeline.hdel(RedisKeys.userSockets(userId), socketId);
    
    // Remove from devices if we found the deviceId
    if (deviceId) {
      pipeline.hdel(RedisKeys.userDevices(userId), deviceId);
    }
    
    // Check if user has other connections
    const remainingConnections = await redis.hlen(RedisKeys.userSockets(userId));
    
    // Get current presence to preserve manual status
    const currentPresence = await redis.get(RedisKeys.userPresence(userId));
    let userStatus = UserStatus.ONLINE; // default
    if (currentPresence) {
      const data = JSON.parse(currentPresence);
      userStatus = data.userStatus || UserStatus.ONLINE;
    }
    
    if (remainingConnections <= 1) { // Will be 0 after this removal
      // User is going offline
      pipeline.srem(RedisKeys.onlineUsersSet(), userId);
      pipeline.del(RedisKeys.userSockets(userId));
      pipeline.del(RedisKeys.userDevices(userId));
      
      // Set offline presence (preserve manual status)
      pipeline.set(RedisKeys.userPresence(userId), JSON.stringify({
        isConnected: false,
        isOnline: false, // legacy compatibility
        userStatus, // preserve manual status
        lastSeen: now,
        deviceCount: 0,
      }), 'EX', this.OFFLINE_RETENTION);
    } else {
      // User still has other connections, just update device count
      pipeline.set(RedisKeys.userPresence(userId), JSON.stringify({
        isConnected: true,
        isOnline: true, // legacy compatibility
        userStatus, // preserve manual status
        lastSeen: now,
        deviceCount: remainingConnections - 1,
      }), 'EX', this.PRESENCE_TIMEOUT);
    }
    
    const results = await pipeline.exec();
    return results?.every(([err]) => !err) || false;
  }

  /**
   * Update heartbeat for a connection
   */
  static async updateHeartbeat(userId: string, socketId: string): Promise<void> {
    const deviceData = await redis.hget(RedisKeys.userSockets(userId), socketId);
    if (deviceData) {
      const device: DeviceConnection = JSON.parse(deviceData);
      device.lastHeartbeat = new Date().toISOString();
      
      const pipeline = redis.pipeline();
      pipeline.hset(RedisKeys.userSockets(userId), socketId, JSON.stringify(device));
      pipeline.expire(RedisKeys.userSockets(userId), this.PRESENCE_TIMEOUT);
      await pipeline.exec();
    }
  }

  /**
   * Check if user is online (has any active connections)
   */
  static async isUserOnline(userId: string): Promise<boolean> {
    return await redis.sismember(RedisKeys.onlineUsersSet(), userId);
  }

  /**
   * Get all socket IDs for a user
   */
  static async getUserSocketIds(userId: string): Promise<string[]> {
    const sockets = await redis.hgetall(RedisKeys.userSockets(userId));
    return Object.keys(sockets);
  }

  /**
   * Get device count for a user
   */
  static async getDeviceCount(userId: string): Promise<number> {
    return await redis.hlen(RedisKeys.userSockets(userId));
  }

  /**
   * Get user presence information
   */
  static async getUserPresence(userId: string): Promise<{ 
    isOnline: boolean; 
    lastSeen: string; 
    deviceCount: number;
    devices?: DeviceConnection[];
  } | null> {
    const presence = await redis.get(RedisKeys.userPresence(userId));
    if (!presence) return null;
    
    const presenceData = JSON.parse(presence);
    
    // Optionally include device details
    if (presenceData.isOnline) {
      const socketsData = await redis.hgetall(RedisKeys.userSockets(userId));
      presenceData.devices = Object.values(socketsData).map((data: string) => JSON.parse(data));
    }
    
    return presenceData;
  }

  /**
   * Get all online users
   */
  static async getOnlineUsers(): Promise<string[]> {
    return await redis.smembers(RedisKeys.onlineUsersSet());
  }

  /**
   * Clean up stale connections
   */
  static async cleanupStaleConnections(): Promise<number> {
    const onlineUsers = await this.getOnlineUsers();
    const cutoffTime = Date.now() - this.HEARTBEAT_TIMEOUT;
    let cleanedCount = 0;
    
    for (const userId of onlineUsers) {
      const socketsData = await redis.hgetall(RedisKeys.userSockets(userId));
      const staleSockets: string[] = [];
      
      for (const [socketId, data] of Object.entries(socketsData)) {
        const device: DeviceConnection = JSON.parse(data);
        const lastHeartbeat = new Date(device.lastHeartbeat).getTime();
        
        if (lastHeartbeat < cutoffTime) {
          staleSockets.push(socketId);
        }
      }
      
      // Remove stale connections
      for (const socketId of staleSockets) {
        await this.removeUserConnection(userId, socketId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Cache user contacts for quick presence broadcasting
   */
  static async cacheUserContacts(userId: string, contactIds: string[]): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.del(RedisKeys.contactsCache(userId));
    if (contactIds.length > 0) {
      pipeline.sadd(RedisKeys.contactsCache(userId), ...contactIds);
      pipeline.expire(RedisKeys.contactsCache(userId), 3600); // 1 hour cache
    }
    await pipeline.exec();
  }

  /**
   * Get cached contacts for a user
   */
  static async getCachedContacts(userId: string): Promise<string[]> {
    return await redis.smembers(RedisKeys.contactsCache(userId));
  }

  /**
   * Update user's manual status (online, busy, away, offline)
   */
  static async updateUserStatus(userId: string, userStatus: UserStatus): Promise<void> {
    const pipeline = redis.pipeline();
    const now = new Date().toISOString();
    
    // Get current presence to preserve connection info
    const currentPresence = await redis.get(RedisKeys.userPresence(userId));
    let presenceData: any = {
      isConnected: false,
      userStatus,
      lastSeen: now,
      deviceCount: 0,
    };
    
    if (currentPresence) {
      presenceData = { ...JSON.parse(currentPresence), userStatus, lastSeen: now };
    }
    
    // Update presence with new status
    const ttl = presenceData.isConnected ? this.PRESENCE_TIMEOUT : this.OFFLINE_RETENTION;
    pipeline.set(RedisKeys.userPresence(userId), JSON.stringify(presenceData), 'EX', ttl);
    
    await pipeline.exec();
  }

  /**
   * Get enhanced user presence with effective status
   */
  static async getEnhancedUserPresence(userId: string, userDbStatus?: UserStatus): Promise<UserPresence | null> {
    const redisPresence = await redis.get(RedisKeys.userPresence(userId));
    
    let presence: UserPresence = {
      isConnected: false,
      userStatus: userDbStatus || UserStatus.ONLINE,
      lastSeen: new Date(),
      deviceCount: 0,
    };
    
    if (redisPresence) {
      const data = JSON.parse(redisPresence);
      presence = {
        isConnected: data.isConnected || data.isOnline || false,
        userStatus: data.userStatus || userDbStatus || UserStatus.ONLINE,
        lastSeen: new Date(data.lastSeen),
        deviceCount: data.deviceCount || 0,
      };
    }
    
    return presence;
  }

  /**
   * Get effective status for display purposes
   */
  static async getEffectiveUserStatus(userId: string, userDbStatus?: UserStatus): Promise<UserStatus> {
    const presence = await this.getEnhancedUserPresence(userId, userDbStatus);
    if (!presence) return UserStatus.OFFLINE;
    
    return getEffectiveStatus(presence);
  }

  // Legacy methods for backward compatibility (deprecated)
  /** @deprecated Use addUserConnection instead */
  static async setUserOnline(userId: string, socketId: string): Promise<void> {
    await this.addUserConnection(userId, socketId, `device-${socketId}`);
  }

  /** @deprecated Use removeUserConnection instead */
  static async setUserOffline(userId: string): Promise<void> {
    // Get all sockets for user and remove them
    const socketIds = await this.getUserSocketIds(userId);
    for (const socketId of socketIds) {
      await this.removeUserConnection(userId, socketId);
    }
  }

  /** @deprecated Use getUserSocketIds instead */
  static async getUserSocketId(userId: string): Promise<string | null> {
    const socketIds = await this.getUserSocketIds(userId);
    return socketIds.length > 0 ? socketIds[0] : null;
  }
}
