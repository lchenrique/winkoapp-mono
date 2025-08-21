export enum UserStatus {
  ONLINE = 'online',
  BUSY = 'busy', 
  AWAY = 'away',
  OFFLINE = 'offline'
}

export interface UserStatusInfo {
  status: UserStatus;
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const USER_STATUS_CONFIG: Record<UserStatus, UserStatusInfo> = {
  [UserStatus.ONLINE]: {
    status: UserStatus.ONLINE,
    label: 'Online',
    color: '#10b981', // green-500
    icon: '🟢',
    description: 'Disponível para conversar'
  },
  [UserStatus.BUSY]: {
    status: UserStatus.BUSY,
    label: 'Ocupado',
    color: '#ef4444', // red-500
    icon: '🔴',
    description: 'Não perturbe, estou ocupado'
  },
  [UserStatus.AWAY]: {
    status: UserStatus.AWAY,
    label: 'Ausente',
    color: '#f59e0b', // yellow-500
    icon: '🟡',
    description: 'Ausente, volto em breve'
  },
  [UserStatus.OFFLINE]: {
    status: UserStatus.OFFLINE,
    label: 'Offline',
    color: '#6b7280', // gray-500
    icon: '⚫',
    description: 'Aparecer como offline'
  }
};

export interface UserPresence {
  isConnected: boolean;     // Conectado via socket
  userStatus: UserStatus;   // Status manual escolhido pelo usuário
  lastSeen: Date;
  deviceCount: number;
}

// Função para determinar o status efetivo do usuário
export function getEffectiveStatus(presence: UserPresence): UserStatus {
  // Se o usuário escolheu offline manualmente, respeitar
  if (presence.userStatus === UserStatus.OFFLINE) {
    return UserStatus.OFFLINE;
  }
  
  // Se não está conectado, mostrar offline independente do status manual
  if (!presence.isConnected) {
    return UserStatus.OFFLINE;
  }
  
  // Se está conectado, mostrar o status manual escolhido
  return presence.userStatus;
}

// Função para determinar se deve mostrar "online" baseado no status efetivo
export function isEffectivelyOnline(effectiveStatus: UserStatus): boolean {
  return effectiveStatus !== UserStatus.OFFLINE;
}
