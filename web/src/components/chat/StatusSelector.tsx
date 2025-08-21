import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Circle, 
  CircleDot,
  Clock,
  CircleSlash,
  ChevronDown 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type UserStatus = 'online' | 'busy' | 'away' | 'offline';

interface StatusSelectorProps {
  currentStatus: UserStatus;
  onStatusChange: (status: UserStatus) => Promise<void>;
  className?: string;
}

const statusConfig = {
  online: {
    icon: Circle,
    label: 'Online',
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    description: 'Disponível para conversar',
  },
  busy: {
    icon: CircleDot,
    label: 'Ocupado',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    description: 'Não perturbe',
  },
  away: {
    icon: Clock,
    label: 'Ausente',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    description: 'Estarei de volta em breve',
  },
  offline: {
    icon: CircleSlash,
    label: 'Offline',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500',
    description: 'Aparecer como offline',
  },
};

export function StatusSelector({ currentStatus, onStatusChange, className }: StatusSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  console.log('🎨 StatusSelector: Rendering with currentStatus:', currentStatus);
  
  const currentConfig = statusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;
  
  console.log('🎨 StatusSelector: Current config:', currentConfig);

  const handleStatusChange = async (newStatus: UserStatus) => {
    if (newStatus === currentStatus) {
      console.log('⚠️ StatusSelector: Same status clicked, ignoring:', newStatus);
      return;
    }
    
    console.log('🔄 StatusSelector: Changing status from', currentStatus, 'to', newStatus);
    console.log('🔄 StatusSelector: onStatusChange function:', typeof onStatusChange);
    setIsLoading(true);
    try {
      console.log('📡 StatusSelector: Calling onStatusChange with:', newStatus);
      await onStatusChange(newStatus);
      console.log('✅ StatusSelector: Status changed successfully to', newStatus);
      toast({
        title: 'Status atualizado',
        description: `Seu status foi alterado para ${statusConfig[newStatus].label}`,
      });
    } catch (error) {
      console.error('❌ StatusSelector: Failed to change status:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          className={`flex items-center gap-2 text-left justify-start ${className}`}
        >
          <div className="relative">
            <CurrentIcon className={`h-4 w-4 ${currentConfig.color}`} />
          </div>
          <span className="text-sm font-medium">
            {currentConfig.label}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-56">
        {(Object.entries(statusConfig) as [UserStatus, typeof statusConfig[UserStatus]][]).map(([status, config]) => {
          const StatusIcon = config.icon;
          const isCurrentStatus = status === currentStatus;
          
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`flex items-center gap-3 py-2 cursor-pointer ${
                isCurrentStatus ? 'bg-accent' : ''
              }`}
              disabled={isLoading}
            >
              <div className="relative">
                <StatusIcon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {config.label}
                  {isCurrentStatus && <span className="ml-2 text-xs opacity-60">(atual)</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {config.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
