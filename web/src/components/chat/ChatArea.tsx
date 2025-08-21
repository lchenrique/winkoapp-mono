import { useState, useEffect, useRef } from "react";
import { Send, Phone, Video, MoreHorizontal, Paperclip, Smile, Mic, ArrowLeft, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserStatusIndicator } from "./UserStatusIndicator";
import { VirtualizedMessageList } from "./VirtualizedMessageList";
import { useMessageReadTracker } from "@/hooks/use-message-read-tracker";

// Helper functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function getContactName(conversation: any, contacts: any[], currentUserId: string): string {
  console.log('🏷️ getContactName debug:', {
    conversation: conversation?.id,
    type: conversation?.type,
    membersCount: conversation?.members?.length,
    contactsCount: contacts.length,
    currentUserId
  });
  
  if (!conversation) {
    console.warn('⚠️ No conversation provided');
    return 'Conversa';
  }
  
  if (conversation.type !== 'private') {
    return conversation?.name || 'Conversa em Grupo';
  }

  // Find the other member in the conversation
  const otherMember = conversation.members?.find((member: any) => member.userId !== currentUserId);
  console.log('👤 otherMember found:', {
    userId: otherMember?.userId,
    userName: otherMember?.user?.name,
    fullMemberData: otherMember
  });
  
  if (!otherMember) {
    console.warn('⚠️ No other member found in conversation');
    console.log('📇 Available members:', conversation.members);
    return 'Usuário Desconhecido';
  }

  // STRATEGY 1: Try to get name from contact list (preferred - has nicknames)
  const contact = contacts.find(c => c.contact.id === otherMember.userId);
  if (contact) {
    const contactName = contact.nickname || contact.contact.name;
    console.log('🏷️ ✅ Found in contacts:', contactName);
    return contactName;
  }

  // STRATEGY 2: Use member user data directly (fallback)
  if (otherMember.user?.name) {
    console.log('🏷️ ✅ Using member user data:', otherMember.user.name);
    return otherMember.user.name;
  }

  // STRATEGY 3: Last resort - try username
  if (otherMember.user?.username) {
    console.log('🏷️ ⚠️ Using username as fallback:', otherMember.user.username);
    return `@${otherMember.user.username}`;
  }

  console.error('❌ All name resolution strategies failed!');
  console.log('📇 Debug info:', {
    searchingFor: otherMember.userId,
    availableContacts: contacts.map(c => ({
      id: c.contact.id,
      name: c.contact.name,
      nickname: c.nickname
    })),
    memberUserData: otherMember.user
  });
  
  return 'Usuário Desconhecido';
}

interface ChatAreaProps {
  chatId?: string;
  onBackToContacts?: () => void;
}

export function ChatArea({ chatId, onBackToContacts }: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const isMobile = useIsMobile();
  
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    currentConversation,
    messages,
    contacts,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasMoreMessages,
    sendMessage,
    loadOlderMessages,
    isUserOnline,
    getUserStatus,
    markMessageAsRead,
    markMultipleMessagesAsRead,
  } = useChatStore();

  // Initialize read tracking
  const { observeMessage } = useMessageReadTracker({
    messages,
    conversationId: currentConversation?.id || null,
    onMarkAsRead: markMessageAsRead,
    onMarkMultipleAsRead: markMultipleMessagesAsRead,
  });


  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentConversation) return;
    
    try {
      await sendMessage(newMessage.trim());
      setNewMessage("");
    } catch (error) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // No conversation selected
  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-background">
        <div className="text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Bem-vindo ao WinkoApp!
          </h3>
          <p className="text-muted-foreground">
            Selecione um contato na barra lateral para começar a conversar
          </p>
        </div>
      </div>
    );
  }

  // Get conversation display name
  const conversationName = getContactName(currentConversation, contacts, user?.id || '');
  const otherMember = currentConversation.members?.find(member => member.userId !== user?.id);
  const isContactOnline = otherMember ? isUserOnline(otherMember.userId) : false;
  const contactStatus = otherMember ? getUserStatus(otherMember.userId) : 'offline';
  
  console.log('🏗️ ChatArea: Contact status debug:', {
    otherMemberId: otherMember?.userId,
    contactStatus,
    isContactOnline,
    conversationName
  });

  return (
    <div className="flex-1 flex flex-col bg-chat-background">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && onBackToContacts && (
              <Button size="sm" variant="ghost" onClick={onBackToContacts}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherMember?.user?.avatar} />
              <AvatarFallback className="bg-secondary">
                {getInitials(conversationName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-foreground">{conversationName}</h2>
              <div className="flex items-center gap-2">
                {currentConversation.type === 'private' && (
                  <UserStatusIndicator 
                    status={contactStatus}
                    size="sm"
                    showLabel={true}
                  />
                )}
                {currentConversation.type === 'group' && (
                  <span className="text-sm text-muted-foreground">
                    {currentConversation.members?.length || 0} membros
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost">
              <Phone className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Video className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      {isLoadingMessages ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Carregando mensagens...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Início da conversa</p>
          <p className="text-xs mt-1">Envie a primeira mensagem!</p>
        </div>
      ) : (
        <VirtualizedMessageList
          messages={messages}
          currentUserId={user?.id || ''}
          observeMessage={observeMessage}
          onLoadOlderMessages={() => loadOlderMessages(currentConversation.id)}
          isLoadingOlderMessages={isLoadingOlderMessages}
          hasMoreMessages={hasMoreMessages}
        />
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-3">
          <Button size="sm" variant="ghost" className="mb-2">
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="pr-20 bg-input border-border"
              disabled={!currentConversation}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <Button size="sm" variant="ghost" className="p-1 h-6 w-6">
                <Smile className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="p-1 h-6 w-6">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Button 
            size="sm" 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !currentConversation}
            className="mb-2"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
