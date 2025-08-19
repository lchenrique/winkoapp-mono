import { useEffect, useState } from "react";
import { Search, Settings, Plus, User, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
    loadContacts,
    selectContactConversation,
    addContact,
  } = useChatStore();
  
  // Add contact dialog state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContactId, setNewContactId] = useState('');
  const [newContactNickname, setNewContactNickname] = useState('');

  // Load contacts on mount
  useEffect(() => {
    if (user) {
      loadContacts().catch(console.error);
    }
  }, [user, loadContacts]);

  // Handle contact selection
  const handleContactSelect = async (contactId: string, contactName: string) => {
    try {
      await selectContactConversation(contactId, contactName);
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

  // Handle add contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactId.trim()) return;
    
    try {
      await addContact(newContactId.trim(), newContactNickname.trim() || undefined);
      setIsAddContactOpen(false);
      setNewContactId('');
      setNewContactNickname('');
      toast({
        title: 'Contato adicionado!',
        description: 'Conversa iniciada com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro ao adicionar contato',
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
            <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="p-1 h-6 w-6">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Contato</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-id">ID do Usuário</Label>
                    <Input
                      id="contact-id"
                      placeholder={`Seu ID: ${user?.id || ''}`}
                      value={newContactId}
                      onChange={(e) => setNewContactId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-nickname">Apelido (opcional)</Label>
                    <Input
                      id="contact-nickname"
                      placeholder="Como você quer chamá-lo?"
                      value={newContactNickname}
                      onChange={(e) => setNewContactNickname(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      Adicionar
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddContactOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
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
                <Avatar className="h-10 w-10">
                  <AvatarImage src={contact.contact.avatar} />
                  <AvatarFallback className="bg-secondary text-sm">
                    {getInitials(contactName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground truncate">
                      {contactName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(contact.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    #{contact.contact.id}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
