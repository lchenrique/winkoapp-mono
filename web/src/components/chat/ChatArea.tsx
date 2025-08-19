import { useState, useEffect, useRef } from "react";
import { Send, Phone, Video, MoreHorizontal, Paperclip, Smile, Mic, ArrowLeft, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  if (!conversation || conversation.type !== 'private') {
    return conversation?.name || 'Conversa';
  }

  // Find the other member in the conversation
  const otherMember = conversation.members?.find((member: any) => member.userId !== currentUserId);
  if (!otherMember) return 'Usuário Desconhecido';

  // Find contact info for this user
  const contact = contacts.find(c => c.contact.id === otherMember.userId);
  return contact?.nickname || otherMember.user?.name || 'Usuário Desconhecido';
}

interface ChatAreaProps {
  chatId?: string;
  onBackToContacts?: () => void;
}

export function ChatArea({ chatId, onBackToContacts }: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    currentConversation,
    messages,
    contacts,
    isLoadingMessages,
    sendMessage,
  } = useChatStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
              <p className="text-sm text-muted-foreground">
                {currentConversation.type === 'private' 
                  ? `ID: ${otherMember?.userId}` 
                  : `${currentConversation.members?.length || 0} membros`
                }
              </p>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Carregando mensagens...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Início da conversa</p>
            <p className="text-xs mt-1">Envie a primeira mensagem!</p>
          </div>
        ) : (
          messages.map((message) => {
            // Safe check for sender
            const sender = message.sender || { id: '', name: 'Unknown', avatar: '' };
            const isOwn = sender.id === user?.id;
            
            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {!isOwn && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src={sender.avatar} />
                    <AvatarFallback className="bg-secondary text-xs">
                      {getInitials(sender.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-xs lg:max-w-md ${isOwn ? "text-right" : ""}`}>
                  {!isOwn && (
                    <p className="text-xs text-muted-foreground mb-1 font-medium">
                      {sender.name || 'Unknown'}
                    </p>
                  )}
                  
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-chat-message-own text-white"
                        : "bg-chat-message-other text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

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
