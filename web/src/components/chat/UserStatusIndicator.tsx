import { 
  Circle, 
  CircleDot,
  Clock,
  CircleSlash 
} from 'lucide-react';

export type UserStatus = 'online' | 'busy' | 'away' | 'offline';

interface UserStatusIndicatorProps {
  status: UserStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  online: {
    icon: Circle,
    label: 'Online',
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    dotColor: 'bg-green-500',
  },
  busy: {
    icon: CircleDot,
    label: 'Ocupado',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    dotColor: 'bg-red-500',
  },
  away: {
    icon: Clock,
    label: 'Ausente',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    dotColor: 'bg-yellow-500',
  },
  offline: {
    icon: CircleSlash,
    label: 'Offline',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500',
    dotColor: 'bg-gray-500',
  },
};

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    dot: 'w-2 h-2',
    text: 'text-xs',
  },
  md: {
    icon: 'h-4 w-4',
    dot: 'w-3 h-3',
    text: 'text-sm',
  },
  lg: {
    icon: 'h-5 w-5',
    dot: 'w-4 h-4',
    text: 'text-base',
  },
};

export function UserStatusIndicator({ 
  status, 
  size = 'md', 
  showLabel = false, 
  className = '' 
}: UserStatusIndicatorProps) {
  console.log('🌟 UserStatusIndicator: Rendering with status:', status, 'showLabel:', showLabel);
  
  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];
  const StatusIcon = config.icon;
  
  console.log('🌟 UserStatusIndicator: Config for', status, ':', config);

  if (showLabel) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StatusIcon className={`${sizeClasses.icon} ${config.color}`} />
        <span className={`${sizeClasses.text} ${config.color} font-medium`}>
          {config.label}
        </span>
      </div>
    );
  }

  // Just show as a colored dot for simple display
  return (
    <div 
      className={`${sizeClasses.dot} rounded-full ${config.dotColor} ${className}`}
      title={config.label}
    />
  );
}
