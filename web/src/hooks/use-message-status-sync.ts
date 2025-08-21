import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { conversationsAPI } from '@/lib/api';

export function useMessageStatusSync() {
  const { currentConversation, messages } = useChatStore();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync message status when conversation changes or periodically
  useEffect(() => {
    if (!currentConversation) {
      // Clear any existing sync interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    const syncMessageStatus = async () => {
      try {
        // Get message IDs for messages sent by current user
        const sentMessages = messages.filter(msg => 
          msg.sender?.id && 
          msg.status !== 'read' // Only sync messages that aren't read yet
        );

        if (sentMessages.length === 0) return;

        const messageIds = sentMessages.map(msg => msg.id);
        console.log(`🔄 Syncing status for ${messageIds.length} messages`);

        // Fetch current status from API
        const statusUpdates = await conversationsAPI.getMessageStatus(
          currentConversation.id, 
          messageIds
        );

        if (statusUpdates.length === 0) return;

        // Update messages with latest status
        const currentMessages = useChatStore.getState().messages;
        const updatedMessages = currentMessages.map(msg => {
          const statusUpdate = statusUpdates.find(update => update.messageId === msg.id);
          if (statusUpdate && statusUpdate.status !== msg.status) {
            console.log(`📊 Updating message ${msg.id} status: ${msg.status} → ${statusUpdate.status}`);
            return {
              ...msg,
              status: statusUpdate.status,
              statusTimestamp: statusUpdate.timestamp
            };
          }
          return msg;
        });

        useChatStore.setState({ messages: updatedMessages });
      } catch (error) {
        console.warn('Failed to sync message status:', error);
      }
    };

    // Initial sync
    syncMessageStatus();

    // Set up periodic sync every 10 seconds
    syncIntervalRef.current = setInterval(syncMessageStatus, 10000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [currentConversation?.id, messages.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);
}
