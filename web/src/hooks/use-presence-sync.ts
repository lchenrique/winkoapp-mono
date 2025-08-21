import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = 'http://localhost:3000';

interface ContactStatus {
  userId: string;
  userName: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  isConnected: boolean;
  lastSeen: string;
}

/**
 * Hook to sync initial presence status of contacts
 * Fetches current online status when component mounts or reconnects
 */
export function usePresenceSync(isSocketConnected: boolean) {
  const { token, user } = useAuth();
  const { contacts, setUserOnline, setUserOffline, setUserStatus } = useChatStore();
  const currentUserId = user?.id;
  const lastSyncRef = useRef<number>(0);
  const syncInProgressRef = useRef<boolean>(false);

  const syncPresenceStatus = async () => {
    if (!token || !contacts.length || syncInProgressRef.current) {
      return;
    }

    try {
      syncInProgressRef.current = true;
      console.log('🔄 StatusService: Syncing contact statuses...');

      // Get contact IDs (excluding self)
      const contactIds = contacts
        .map(contact => contact.contact.id)
        .filter(id => id !== currentUserId);

      if (contactIds.length === 0) {
        console.log('⏭️ No contacts to sync (excluding self)');
        return;
      }

      // Use StatusService API as SINGLE SOURCE OF TRUTH
      const response = await fetch(`${API_BASE_URL}/api/debug/contacts-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ contactIds }),
      });

      if (!response.ok) {
        throw new Error(`StatusService API failed: ${response.status}`);
      }

      const statusData: ContactStatus[] = await response.json();
      console.log('📊 StatusService: Retrieved statuses for', statusData.length, 'contacts');

      // Update frontend store directly with backend truth
      statusData.forEach(({ userId, status, isConnected }) => {
        const contact = contacts.find(c => c.contact.id === userId);
        const contactName = contact?.contact.name || userId;
        
        console.log(`📊 StatusService: ${contactName} = ${status} (connected: ${isConnected})`);
        
        // Update connection status
        if (isConnected) {
          setUserOnline(userId);
        } else {
          setUserOffline(userId);
        }
        
        // Update status (StatusService already calculated the effective status)
        setUserStatus(userId, status);
      });

      lastSyncRef.current = Date.now();
      console.log(`✅ StatusService: Synced ${statusData.length} contact statuses`);

    } catch (error) {
      console.error('❌ StatusService sync failed:', error);

      // Fallback: mark all contacts as offline
      contacts.forEach(contact => {
        if (contact.contact.id !== currentUserId) {
          setUserOffline(contact.contact.id);
          setUserStatus(contact.contact.id, 'offline');
        }
      });
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Sync when socket connects
  useEffect(() => {
    if (isSocketConnected && contacts.length > 0) {
      // Don't sync too frequently
      const timeSinceLastSync = Date.now() - lastSyncRef.current;
      const shouldSync = timeSinceLastSync > 5000; // 5 seconds cooldown for debug

      console.log('🔄 Sync trigger - Socket connected:', {
        isSocketConnected,
        contactsCount: contacts.length,
        timeSinceLastSync,
        shouldSync
      });

      if (shouldSync) {
        console.log('🚀 Triggering presence sync due to socket connection');
        syncPresenceStatus();
      } else {
        console.log('⏸️ Sync skipped - too recent');
      }
    }
  }, [isSocketConnected, contacts.length, token]);

  // Sync when contacts list changes (new contacts added)
  useEffect(() => {
    if (isSocketConnected && contacts.length > 0) {
      // Don't sync too frequently
      const timeSinceLastSync = Date.now() - lastSyncRef.current;
      const shouldSync = timeSinceLastSync > 10000; // 10 seconds cooldown

      if (shouldSync) {
        // Small delay to avoid sync during initial load
        const timeoutId = setTimeout(() => {
          syncPresenceStatus();
        }, 2000);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [contacts.map(c => c.contact.id).join(',')]);

  return {
    syncPresenceStatus,
    issyncing: syncInProgressRef.current,
    lastSync: lastSyncRef.current,
  };
}
