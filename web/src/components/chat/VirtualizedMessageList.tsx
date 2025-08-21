import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageStatusIndicator } from "./MessageStatusIndicator";
import { Message } from '@/types/chat';

interface VirtualizedMessageListProps {
  messages: Message[];
  currentUserId: string;
  observeMessage: (element: HTMLElement | null, messageId: string) => void;
  onLoadOlderMessages: () => void;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
}

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

export function VirtualizedMessageList({ 
  messages, 
  currentUserId, 
  observeMessage,
  onLoadOlderMessages,
  isLoadingOlderMessages,
  hasMoreMessages
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const previousMessagesLength = useRef(messages.length);
  const shouldAutoScroll = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 100, // Estimate message height
    overscan: 5, // Render 5 extra items outside viewport
  });

  // Handle scroll events for infinite loading and auto-scroll detection
  const handleScroll = useCallback(() => {
    if (!scrollElementRef.current) return;
    
    const scrollElement = scrollElementRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    
    // Check if user is at the bottom (within 100px)
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
    shouldAutoScroll.current = isAtBottom;
    
    // Check if user scrolled to top and should load older messages
    const isAtTop = scrollTop <= 100;
    if (isAtTop && hasMoreMessages && !isLoadingOlderMessages) {
      console.log('🔄 Loading older messages...');
      onLoadOlderMessages();
    }
  }, [hasMoreMessages, isLoadingOlderMessages, onLoadOlderMessages]);
  
  // Attach scroll listener
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  // Auto-scroll to bottom when new messages arrive (only if user was at bottom)
  useEffect(() => {
    if (scrollElementRef.current && messages.length > previousMessagesLength.current) {
      const scrollElement = scrollElementRef.current;
      
      if (shouldAutoScroll.current) {
        // Scroll to bottom with smooth animation
        setTimeout(() => {
          if (scrollElement) {
            scrollElement.scrollTo({
              top: scrollElement.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 50);
      }
      
      previousMessagesLength.current = messages.length;
    }
  }, [messages.length]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (scrollElementRef.current && messages.length > 0) {
      setTimeout(() => {
        if (scrollElementRef.current) {
          scrollElementRef.current.scrollTop = scrollElementRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages.length > 0]);

  return (
    <div
      ref={scrollElementRef}
      className="flex-1 overflow-y-auto p-4"
      style={{
        height: '100%',
      }}
    >
      {/* Loading indicator for older messages */}
      {isLoadingOlderMessages && (
        <div className="flex justify-center py-4">
          <div className="text-sm text-muted-foreground">Carregando mensagens antigas...</div>
        </div>
      )}
      
      {/* No more messages indicator */}
      {!hasMoreMessages && messages.length > 50 && (
        <div className="flex justify-center py-4">
          <div className="text-xs text-muted-foreground">Início da conversa</div>
        </div>
      )}
      
      <div
        ref={parentRef}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index];
          if (!message) return null;

          // Safe check for sender
          const sender = message.sender || { id: '', name: 'Unknown', avatar: '' };
          const isOwn = sender.id === currentUserId;

          return (
            <div
              key={message.id}
              ref={(el) => observeMessage(el, message.id)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-4"
            >
              <div className={`flex items-start gap-3 py-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && (
                  <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
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
                  
                  <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(message.createdAt)}
                    </p>
                    <MessageStatusIndicator message={message} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
