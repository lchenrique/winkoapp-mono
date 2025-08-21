import { Check, CheckCheck } from 'lucide-react';
import { Message, MessageStatusType, MessageStatus } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

interface MessageStatusIndicatorProps {
  message: Message;
  className?: string;
}

export function MessageStatusIndicator({ message, className = '' }: MessageStatusIndicatorProps) {
  const { user } = useAuth();
  
  // Only show status for messages sent by current user
  if (!user || !message.sender || message.sender.id !== user.id) {
    return null;
  }
  
  // Get status from message - this represents the aggregated status from all recipients
  const status: MessageStatusType = message.status || 'sent';
  
  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <Check 
            className={`w-4 h-4 text-gray-400 ${className}`}
            title="Enviado"
          />
        );
      case 'delivered':
        return (
          <CheckCheck 
            className={`w-4 h-4 text-gray-400 ${className}`}
            title="Entregue"
          />
        );
      case 'read':
        return (
          <CheckCheck 
            className={`w-4 h-4 text-blue-500 ${className}`}
            title="Lido"
          />
        );
      default:
        // If no status, show single check (sent)
        return (
          <Check 
            className={`w-4 h-4 text-gray-400 ${className}`}
            title="Enviado"
          />
        );
    }
  };
  
  return (
    <div className="flex items-center ml-1">
      {getStatusIcon()}
    </div>
  );
}
