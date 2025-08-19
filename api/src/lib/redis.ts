import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Redis keys helper
export const RedisKeys = {
  userOnline: (userId: string) => `user:online:${userId}`,
  userSocket: (userId: string) => `user:socket:${userId}`,
  conversationMembers: (conversationId: string) => `conversation:members:${conversationId}`,
  messageDelivery: (messageId: string) => `message:delivery:${messageId}`,
  messageRead: (messageId: string) => `message:read:${messageId}`,
  userPresence: (userId: string) => `user:presence:${userId}`,
} as const;

// Presence management
export class PresenceManager {
  static async setUserOnline(userId: string, socketId: string): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.set(RedisKeys.userOnline(userId), '1', 'EX', 300); // 5 minutes timeout
    pipeline.set(RedisKeys.userSocket(userId), socketId, 'EX', 300);
    pipeline.set(RedisKeys.userPresence(userId), JSON.stringify({
      isOnline: true,
      lastSeen: new Date().toISOString(),
      socketId,
    }), 'EX', 300);
    await pipeline.exec();
  }

  static async setUserOffline(userId: string): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.del(RedisKeys.userOnline(userId));
    pipeline.del(RedisKeys.userSocket(userId));
    pipeline.set(RedisKeys.userPresence(userId), JSON.stringify({
      isOnline: false,
      lastSeen: new Date().toISOString(),
    }), 'EX', 86400); // Keep offline status for 24 hours
    await pipeline.exec();
  }

  static async isUserOnline(userId: string): Promise<boolean> {
    const result = await redis.get(RedisKeys.userOnline(userId));
    return result === '1';
  }

  static async getUserSocketId(userId: string): Promise<string | null> {
    return redis.get(RedisKeys.userSocket(userId));
  }

  static async getUserPresence(userId: string): Promise<{ isOnline: boolean; lastSeen: string; socketId?: string } | null> {
    const presence = await redis.get(RedisKeys.userPresence(userId));
    return presence ? JSON.parse(presence) : null;
  }
}
