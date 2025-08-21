import { db, users } from '../lib/db';
import { eq } from 'drizzle-orm';
import { getSocketService } from './socket';

export enum UserStatus {
  ONLINE = 'online',
  BUSY = 'busy', 
  AWAY = 'away',
  OFFLINE = 'offline'
}

export interface UserStatusInfo {
  userId: string;
  userName: string;
  status: UserStatus;
  isConnected: boolean;
  lastSeen: Date;
}

/**
 * ÚNICA FONTE DE VERDADE para status de usuários
 * 
 * Regras:
 * 1. Se usuário não está conectado via Socket.IO -> SEMPRE offline
 * 2. Se usuário está conectado + userStatus = 'offline' -> offline (escolheu aparecer offline)
 * 3. Se usuário está conectado + userStatus != 'offline' -> status manual (online/busy/away)
 */
export class StatusService {
  
  /**
   * Obter status efetivo de um usuário - FONTE ÚNICA DE VERDADE
   */
  static async getEffectiveUserStatus(userId: string): Promise<UserStatusInfo | null> {
    try {
      // 1. Buscar dados do usuário no database
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          userStatus: users.userStatus,
          lastSeen: users.lastSeen,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return null;

      // 2. Verificar se está conectado via Socket.IO (fonte de verdade para conexões)
      const socketService = getSocketService();
      const isConnected = socketService ? socketService.isUserOnline(userId) : false;

      // DEBUG: Log detalhado
      console.log(`🔍 StatusService: User ${user.name} (${userId})`);
      console.log(`   - DB userStatus: ${user.userStatus}`);
      console.log(`   - Socket connected: ${isConnected}`);
      console.log(`   - Socket service available: ${socketService ? 'yes' : 'no'}`);
      if (socketService) {
        const onlineUsers = socketService.getOnlineUsersList();
        console.log(`   - All connected users: [${onlineUsers.join(', ')}]`);
      }

      // 3. Calcular status efetivo baseado na ÚNICA regra
      let effectiveStatus: UserStatus;
      
      if (!isConnected) {
        // Não está conectado = sempre offline
        effectiveStatus = UserStatus.OFFLINE;
        console.log(`   ➡️ RULE: Not connected -> offline`);
      } else if (user.userStatus === 'offline') {
        // Conectado mas escolheu aparecer offline
        effectiveStatus = UserStatus.OFFLINE;
        console.log(`   ➡️ RULE: Connected but chose offline -> offline`);
      } else {
        // Conectado + status manual válido
        effectiveStatus = (user.userStatus as UserStatus) || UserStatus.ONLINE;
        console.log(`   ➡️ RULE: Connected + manual status -> ${effectiveStatus}`);
      }

      return {
        userId: user.id,
        userName: user.name,
        status: effectiveStatus,
        isConnected,
        lastSeen: user.lastSeen || new Date(),
      };

    } catch (error) {
      console.error(`Error getting effective status for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Obter status efetivo de múltiplos usuários
   */
  static async getEffectiveUserStatuses(userIds: string[]): Promise<UserStatusInfo[]> {
    const results = await Promise.allSettled(
      userIds.map(id => this.getEffectiveUserStatus(id))
    );

    return results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<UserStatusInfo>).value);
  }

  /**
   * Atualizar status manual de um usuário
   */
  static async updateUserStatus(userId: string, newStatus: UserStatus): Promise<UserStatusInfo | null> {
    try {
      console.log(`📊 StatusService: Updating user ${userId} status to ${newStatus}`);

      // 1. Atualizar no database (única fonte de verdade)
      await db
        .update(users)
        .set({
          userStatus: newStatus,
          lastSeen: new Date(),
        })
        .where(eq(users.id, userId));

      // 2. Se usuário escolheu offline, desconectar sockets se necessário
      if (newStatus === UserStatus.OFFLINE) {
        const socketService = getSocketService();
        if (socketService) {
          // Opcional: desconectar sockets do usuário que escolheu offline
          // Isso força o cliente a reconectar se quiser voltar online
        }
      }

      // 3. Obter status efetivo atualizado
      const updatedStatus = await this.getEffectiveUserStatus(userId);

      // 4. Broadcast da mudança para contatos
      if (updatedStatus) {
        await this.broadcastStatusChange(userId, updatedStatus.status);
      }

      console.log(`✅ StatusService: Status updated successfully to ${updatedStatus?.status}`);
      return updatedStatus;

    } catch (error) {
      console.error(`Error updating status for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Broadcast de mudança de status para contatos
   */
  static async broadcastStatusChange(userId: string, newStatus: UserStatus): Promise<void> {
    try {
      const socketService = getSocketService();
      if (!socketService) return;

      // Usar o método existente de broadcast (se houver)
      // Isso irá notificar apenas os contatos do usuário sobre a mudança
      await socketService.broadcastStatusUpdate(userId, newStatus);

      console.log(`📡 StatusService: Broadcasted status change for ${userId} to ${newStatus}`);
    } catch (error) {
      console.warn(`Failed to broadcast status change for ${userId}:`, error);
    }
  }

  /**
   * Obter status de todos os usuários online
   */
  static async getOnlineUsersStatus(): Promise<UserStatusInfo[]> {
    try {
      const socketService = getSocketService();
      if (!socketService) return [];

      // Obter lista de usuários conectados do Socket.IO
      const connectedUserIds = socketService.getOnlineUsersList ? 
        socketService.getOnlineUsersList() : [];

      if (connectedUserIds.length === 0) return [];

      // Buscar status efetivo de todos os usuários conectados
      return await this.getEffectiveUserStatuses(connectedUserIds);

    } catch (error) {
      console.error('Error getting online users status:', error);
      return [];
    }
  }

  /**
   * Limpar status inconsistentes (ferramenta de manutenção)
   */
  static async cleanupInconsistentStatuses(): Promise<{
    fixed: number;
    issues: string[];
  }> {
    try {
      console.log('🧹 StatusService: Starting status cleanup...');

      const socketService = getSocketService();
      if (!socketService) {
        return { fixed: 0, issues: ['Socket service not available'] };
      }

      // 1. Buscar todos os usuários
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          userStatus: users.userStatus,
          isOnline: users.isOnline,
        })
        .from(users);

      let fixed = 0;
      const issues: string[] = [];

      // 2. Para cada usuário, verificar consistência
      for (const user of allUsers) {
        const isConnected = socketService.isUserOnline(user.id);
        const effectiveStatus = await this.getEffectiveUserStatus(user.id);
        
        if (!effectiveStatus) continue;

        // 3. Atualizar isOnline baseado na conexão real
        if (user.isOnline !== isConnected) {
          await db
            .update(users)
            .set({
              isOnline: isConnected,
              lastSeen: new Date(),
            })
            .where(eq(users.id, user.id));
          
          fixed++;
          issues.push(`Fixed isOnline for ${user.name}: ${user.isOnline} -> ${isConnected}`);
        }
      }

      console.log(`✅ StatusService: Cleanup completed. Fixed ${fixed} issues`);
      return { fixed, issues };

    } catch (error) {
      console.error('Error during status cleanup:', error);
      return { fixed: 0, issues: [`Error: ${error.message}`] };
    }
  }
}
