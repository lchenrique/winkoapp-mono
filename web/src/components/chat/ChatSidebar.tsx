import { useEffect, useState } from "react";
import { Search, Settings, Plus, User, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FriendRequests } from "@/components/FriendRequests";
import { UnreadBadge } from "@/components/UnreadBadge";

// Helper functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusConfig(status: 'online' | 'busy' | 'away' | 'offline') {
  switch (status) {
    case 'online':
      return { color: 'bg-green-500', label: 'Online' };
    case 'busy':
      return { color: 'bg-red-500', label: 'Ocupado' };
    case 'away':
      return { color: 'bg-yellow-500', label: 'Ausente' };
    case 'offline':
    default:
      return { color: 'bg-gray-400', label: 'Offline' };
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60);
    return `${minutes} m`;
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    return 'Ontem';
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

interface ChatSidebarProps {
  selectedChatId?: string;
  onChatSelect: (chatId: string) => void;
}

export function ChatSidebar({ selectedChatId, onChatSelect }: ChatSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    contacts,
    isLoading,
    selectContactConversation,
    isUserOnline,
    getUserStatus,
    loadContacts,
    loadConversations,
    preloadRecentConversations,
    preloadedMessages,
    contactConversationCache,
  } = useChatStore();
  
  // Get current user status
  const currentUserStatus = user?.id ? getUserStatus(user.id) : 'online';
  const currentUserStatusConfig = getStatusConfig(currentUserStatus);
  
  // Friend requests dialog state
  const [showFriendRequests, setShowFriendRequests] = useState(false);





  // Load contacts and setup preloading on mount
  useEffect(() => {
    if (user) {
      const initializeChat = async () => {
        try {
          // Load basic data first
          await Promise.all([
            loadContacts(),
            loadConversations(),
          ]);
          
          // Preload recent conversations ONLY on initial page load
          // This ensures badges appear after refresh, but won't interfere with real-time updates
          console.log('🚀 Chat initialized, calling preloadRecentConversations for initial load');
          setTimeout(() => {
            preloadRecentConversations().catch(console.error);
          }, 500); // Shorter timeout for better UX
        } catch (error) {
          console.error('Failed to initialize chat:', error);
        }
      };
      
      initializeChat();
    }
  }, [user, loadContacts, loadConversations, preloadRecentConversations]);

  // Handle contact selection
  const handleContactSelect = async (contactId: string, contactName: string) => {
    try {
      // Pass userId to automatically mark messages as read
      await selectContactConversation(contactId, contactName, user?.id);
      
      // The selectedChatId will be updated by the store, but we need to notify parent
      onChatSelect(contactId);
    } catch (error) {
      toast({
        title: 'Erro ao abrir conversa',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              className="p-1 h-6 w-6"
              onClick={() => setShowFriendRequests(true)}
              title="Adicionar Contato"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{contacts.length}</span>
          </div>
          <Button size="sm" variant="ghost" className="p-1 h-6 w-6">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search"
            className="pl-9 bg-input border-border"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            Carregando contatos...
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum contato ainda</p>
            <p className="text-xs mt-1">Adicione um contato para começar!</p>
          </div>
        ) : (
          contacts.map((contact) => {
            const contactName = contact.nickname || contact.contact.name;
            const isSelected = selectedChatId === contact.contact.id;
            const userStatus = getUserStatus(contact.contact.id);
            const isOnline = isUserOnline(contact.contact.id);
            const statusConfig = getStatusConfig(userStatus);
            
            // Force re-render by accessing preloadedMessages state directly
            const _forceUpdate = preloadedMessages;
            
            // Get unread count for this contact's conversation using your approach
            const conversationId = contactConversationCache.get(contact.contact.id);
            
            let unreadCount = 0;
            if (conversationId && preloadedMessages.get(conversationId)) {
              const messages = preloadedMessages.get(conversationId)!;
              const timestamp = new Date().toISOString();
             
              unreadCount = messages.reduce((acc, message) => {
                // Skip messages sent by current user
                if (message.senderId === user?.id || message.sender?.id === user?.id) {
                  console.log(`⏭️ [${timestamp}] Skipping message from current user: ${message.id.substring(0, 8)}`);
                  return acc;
                }
                
                // Count messages that are not read
                const isUnread = message.status !== 'read';
                console.log(`📋 [${timestamp}] Message ${message.id.substring(0, 8)}: status='${message.status}', statusTimestamp='${message.statusTimestamp}', isUnread=${isUnread}`);
                
                if (isUnread) {
                  return acc + 1;
                }
                return acc;
              }, 0);
            }
            
            console.log('📋 ChatSidebar: Contact', contactName, {
              contactId: contact.contact.id,
              conversationId,
              unreadCount,
              hasCachedConversation: !!conversationId,
              status: userStatus,
              isOnline
            });
            
            // Debug: Check if we have the conversation in the cache
            if (!conversationId) {
              console.log('⚠️ No conversation ID found for contact:', contact.contact.id, 'Cache:', Array.from(contactConversationCache.entries()));
            }
            
            return (
              <button
                key={contact.id}
                onClick={() => handleContactSelect(contact.contact.id, contactName)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-chat-hover transition-colors border-l-2 ${
                  isSelected
                    ? "bg-chat-active border-l-primary" 
                    : "border-l-transparent"
                }`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.contact.avatar} />
                    <AvatarFallback className="bg-secondary text-sm">
                      {getInitials(contactName)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Status badge */}
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                      statusConfig.color
                    }`}
                    title={statusConfig.label}
                  />
                  {/* Unread messages badge */}
                  {unreadCount > 0 && (
                    <UnreadBadge 
                      count={unreadCount} 
                      className="-top-1 -right-1" 
                    />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground truncate">
                        {contactName}
                      </span>
                      {userStatus !== 'offline' && (
                        <span className={`text-xs font-medium ${
                          userStatus === 'online' ? 'text-green-500' :
                          userStatus === 'busy' ? 'text-red-500' :
                          userStatus === 'away' ? 'text-yellow-500' :
                          'text-gray-400'
                        }`}>
                          •
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(contact.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">
                      @{contact.contact.username || 'user'}
                    </p>
                    <span className={`text-xs ${
                      userStatus === 'online' ? 'text-green-500' :
                      userStatus === 'busy' ? 'text-red-500' :
                      userStatus === 'away' ? 'text-yellow-500' :
                      'text-gray-400'
                    }`}>
                      {statusConfig.label.toLowerCase()}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      
      {/* Friend Requests Modal */}
      <FriendRequests
        open={showFriendRequests}
        onOpenChange={setShowFriendRequests}
      />
    </div>
  );
}
