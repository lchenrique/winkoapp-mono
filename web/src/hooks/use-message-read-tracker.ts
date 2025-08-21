import { useEffect, useRef, useCallback } from 'react';
import { Message } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

interface UseMessageReadTrackerProps {
  messages: Message[];
  conversationId: string | null;
  onMarkAsRead: (messageId: string) => Promise<void>;
  onMarkMultipleAsRead?: (messageIds: string[]) => Promise<void>;
}

export function useMessageReadTracker({
  messages,
  conversationId,
  onMarkAsRead,
  onMarkMultipleAsRead
}: UseMessageReadTrackerProps) {
  const { user } = useAuth();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleMessagesRef = useRef<Set<string>>(new Set());
  const markingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-mark unread messages as read when entering conversation (with delay)
  const hasMarkedInitialMessagesRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef<number>(0);
  
  useEffect(() => {
    if (!conversationId || !messages.length || !user?.id) return;
    
    // On conversation change, mark all unread messages as read
    if (hasMarkedInitialMessagesRef.current !== conversationId) {
      const unreadMessages = messages.filter(message => 
        message.sender?.id !== user.id && // Only received messages
        message.status !== 'read' // Not already read
      );

      if (unreadMessages.length > 0) {
        console.log(`📖 Auto-marking ${unreadMessages.length} unread messages as read for conversation ${conversationId}`);
        
        // Add delay to avoid marking messages too aggressively
        setTimeout(() => {
          unreadMessages.forEach(message => {
            handleMarkAsRead(message.id);
          });
        }, 500); // 500ms delay
      }
      
      hasMarkedInitialMessagesRef.current = conversationId;
      previousMessageCountRef.current = messages.length;
    }
    // On new messages, mark new unread messages as read if user is already in conversation
    else if (messages.length > previousMessageCountRef.current) {
      const newMessages = messages.slice(previousMessageCountRef.current);
      const newUnreadMessages = newMessages.filter(message => 
        message.sender?.id !== user.id && // Only received messages
        message.status !== 'read' // Not already read
      );
      
      if (newUnreadMessages.length > 0) {
        console.log(`📖 Auto-marking ${newUnreadMessages.length} new messages as read`);
        
        // Mark new messages as read immediately since user is actively viewing
        setTimeout(() => {
          newUnreadMessages.forEach(message => {
            handleMarkAsRead(message.id);
          });
        }, 1000); // 1s delay for new messages
      }
      
      previousMessageCountRef.current = messages.length;
    }
  }, [conversationId, messages.length]); // Trigger when conversation changes OR new messages arrive

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      markingTimersRef.current.forEach(timer => clearTimeout(timer));
      markingTimersRef.current.clear();
    };
  }, []);

  const handleMarkAsRead = useCallback(async (messageId: string) => {
    try {
      await onMarkAsRead(messageId);
      console.log(`📖 Marked message ${messageId} as read`);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  }, [onMarkAsRead]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const messageId = entry.target.getAttribute('data-message-id');
      if (!messageId) return;

      if (entry.isIntersecting) {
        // Message came into view
        visibleMessagesRef.current.add(messageId);
        
        // Set timer to mark as read after 1 second of visibility (reduced from 2s)
        const timer = setTimeout(() => {
          const message = messages.find(m => m.id === messageId);
          if (message && 
              message.sender?.id !== user?.id && // Only for received messages
              (message.status === 'delivered' || message.status === null || message.status === 'sent')) { // Include sent status
            handleMarkAsRead(messageId);
          }
        }, 1000);
        
        markingTimersRef.current.set(messageId, timer);
      } else {
        // Message left view
        visibleMessagesRef.current.delete(messageId);
        
        // Clear the timer if exists
        const timer = markingTimersRef.current.get(messageId);
        if (timer) {
          clearTimeout(timer);
          markingTimersRef.current.delete(messageId);
        }
      }
    });
  }, [messages, user?.id, handleMarkAsRead]);

  // Initialize intersection observer
  useEffect(() => {
    if (!conversationId) return;

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // Use viewport as root
      rootMargin: '0px',
      threshold: 0.8 // Message needs to be 80% visible
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      // Clear all timers
      markingTimersRef.current.forEach(timer => clearTimeout(timer));
      markingTimersRef.current.clear();
    };
  }, [conversationId, handleIntersection]);

  // Function to observe a message element
  const observeMessage = useCallback((element: HTMLElement | null, messageId: string) => {
    if (element && observerRef.current) {
      element.setAttribute('data-message-id', messageId);
      observerRef.current.observe(element);
    }
  }, []);

  // Function to unobserve a message element
  const unobserveMessage = useCallback((element: HTMLElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  return {
    observeMessage,
    unobserveMessage
  };
}
