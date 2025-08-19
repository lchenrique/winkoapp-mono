import { useState } from "react";
import { NavigationBar } from "@/components/chat/NavigationBar";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { ChatDetails } from "@/components/chat/ChatDetails";
import { LoginForm } from "@/components/auth/LoginForm";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/use-chat-socket";

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("chats");
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const isMobile = useIsMobile();

  // Initialize Socket.IO connection when authenticated
  const { isConnected, error: socketError } = useChatSocket();

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    if (isMobile) {
      setShowChatOnMobile(true);
    }
  };

  const handleBackToContacts = () => {
    setShowChatOnMobile(false);
  };

  return (
    <div className="h-screen flex bg-chat-background">
      {/* Desktop: Show all components side by side */}
      {!isMobile && (
        <>
          <NavigationBar 
            activeItem={activeNavItem}
            onItemSelect={setActiveNavItem}
            isSocketConnected={isConnected}
          />
          
          <ChatSidebar 
            selectedChatId={selectedChatId} 
            onChatSelect={handleChatSelect} 
          />
          
          <ChatArea 
            chatId={selectedChatId} 
            onBackToContacts={handleBackToContacts}
          />
          
          {showDetails && (
            <ChatDetails 
              isOpen={showDetails} 
              onClose={() => setShowDetails(false)} 
            />
          )}
        </>
      )}

      {/* Mobile: Show either contacts or chat */}
      {isMobile && (
        <>
          {!showChatOnMobile ? (
            /* Mobile: Show navigation + contacts list */
            <>
              <NavigationBar 
                activeItem={activeNavItem}
                onItemSelect={setActiveNavItem}
                isSocketConnected={isConnected}
              />
              
              <ChatSidebar 
                selectedChatId={selectedChatId} 
                onChatSelect={handleChatSelect} 
              />
            </>
          ) : (
            /* Mobile: Show chat area with back button */
            <ChatArea 
              chatId={selectedChatId} 
              onBackToContacts={handleBackToContacts}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Index;
