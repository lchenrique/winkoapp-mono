import { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/stores/chatStore';

export type UserStatus = 'online' | 'busy' | 'away' | 'offline';

interface UseUserStatusReturn {
  currentStatus: UserStatus;
  isLoading: boolean;
  error: string | null;
  updateStatus: (status: UserStatus) => Promise<void>;
}

export function useUserStatus(): UseUserStatusReturn {
  const { user, isAuthenticated } = useAuth();
  const { getUserStatus, setUserStatus } = useChatStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentUserId = user?.id;
  const currentStatus = currentUserId ? getUserStatus(currentUserId) : 'online';
  
  console.log('🔍 useUserStatus: Debug state:', {
    currentUserId,
    currentStatus,
    isAuthenticated,
    user: user ? { id: user.id, userStatus: (user as any).userStatus } : null
  });

  // Initialize status from user data when authenticated
  useEffect(() => {
    console.log('🔍 useUserStatus: Initializing status...', { isAuthenticated, user, currentUserId });
    if (isAuthenticated && user && currentUserId) {
      // Get status from user data if available, otherwise default to 'online'
      const userStatus = (user as any).userStatus || 'online';
      console.log('📊 useUserStatus: Setting initial status in store to:', userStatus);
      setUserStatus(currentUserId, userStatus);
    }
  }, [user, isAuthenticated, currentUserId, setUserStatus]);

  const updateStatus = useCallback(async (newStatus: UserStatus): Promise<void> => {
    if (!isAuthenticated || !currentUserId) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 useUserStatus: Starting status update:', {
      currentStatus,
      newStatus,
      userId: currentUserId
    });

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 useUserStatus: Making API call to update status to:', newStatus);
      const result = await usersAPI.updateStatus(newStatus);
      console.log('📡 useUserStatus: API response:', result);
      
      // Update status in store immediately
      setUserStatus(currentUserId, result.userStatus);

      // Update user data in localStorage to persist status
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        userData.userStatus = result.userStatus;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('💾 useUserStatus: Updated localStorage with new status:', result.userStatus);
      }

      console.log(`✅ Status updated to: ${result.userStatus}`);
    } catch (updateError) {
      console.error('❌ Failed to update status:', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Failed to update status');
      throw updateError;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUserId, setUserStatus]);

  // Auto-status management: when user comes back to tab, set to online if not manually set to offline
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentStatus !== 'offline') {
        // Only auto-set to online if user isn't manually offline
        if (currentStatus === 'away') {
          console.log('👁️ useUserStatus: Auto-setting status back to online');
          updateStatus('online').catch(console.error);
        }
      } else if (document.visibilityState === 'hidden' && currentStatus === 'online') {
        // Auto-set to away after some time when tab is hidden
        setTimeout(() => {
          if (document.visibilityState === 'hidden' && currentStatus === 'online') {
            console.log('🕐 useUserStatus: Auto-setting status to away due to inactivity');
            updateStatus('away').catch(console.error);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, currentUserId, currentStatus, updateStatus]);

  return {
    currentStatus,
    isLoading,
    error,
    updateStatus,
  };
}
