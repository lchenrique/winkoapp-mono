import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = 'http://localhost:3000';

/**
 * Hook para detectar fechamento de janela/aba e notificar o servidor
 * Implementa múltiplas estratégias para garantir que o servidor seja notificado
 */
export function useWindowCloseDetection() {
  const { token, user } = useAuth();
  const isUnloadingRef = useRef(false);
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    if (!token || !user) return;

    const notifyServerOffline = (method: 'fetch' | 'beacon' = 'fetch') => {
      if (isUnloadingRef.current) return; // Evita múltiplas notificações
      isUnloadingRef.current = true;

      console.log(`🚪 Notifying server about user going offline (method: ${method})`);

      const url = `${API_BASE_URL}/api/users/offline`;
      const data = JSON.stringify({ 
        userId: user.id,
        timestamp: Date.now(),
        method 
      });

      if (method === 'beacon' && navigator.sendBeacon) {
        // Método mais confiável para notificação durante o fechamento
        const blob = new Blob([data], { type: 'application/json' });
        const success = navigator.sendBeacon(url, blob);
        console.log(`📡 Beacon notification sent: ${success}`);
        return success;
      } else {
        // Fallback usando fetch com keepalive
        try {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: data,
            keepalive: true, // Importante: mantém a requisição ativa mesmo após fechar a página
          }).catch(error => {
            console.warn('Failed to notify server via fetch:', error);
          });
        } catch (error) {
          console.warn('Failed to send offline notification:', error);
        }
      }
    };

    // Estratégia 1: beforeunload - Detecta quando a página está sendo fechada
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log('🔔 Page is unloading...');
      notifyServerOffline('beacon');
    };

    // Estratégia 2: pagehide - Mais confiável que beforeunload
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📄 Page hidden (going to bfcache)');
      } else {
        console.log('📄 Page hidden (unloading)');
        notifyServerOffline('beacon');
      }
    };

    // Estratégia 3: visibilitychange - Detecta quando a aba fica inativa
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('👁️ Page visibility changed to hidden');
        
        // Se a página ficou oculta há mais de 30 segundos sem heartbeat,
        // pode ser que o usuário fechou a aba
        const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
        if (timeSinceLastHeartbeat > 30000) {
          notifyServerOffline('beacon');
        }
      }
    };

    // Estratégia 4: unload - último recurso
    const handleUnload = () => {
      console.log('🚪 Page is unloading');
      notifyServerOffline('beacon');
    };

    // Registrar todos os event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('unload', handleUnload);

    // Monitor heartbeat para detectar inatividade
    const heartbeatInterval = setInterval(() => {
      lastHeartbeatRef.current = Date.now();
    }, 15000); // A cada 15 segundos

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('unload', handleUnload);
      clearInterval(heartbeatInterval);
      isUnloadingRef.current = false;
    };
  }, [token, user]);

  // Método manual para notificar offline (útil para logout)
  const notifyOffline = () => {
    if (token && user) {
      const url = `${API_BASE_URL}/api/users/offline`;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          userId: user.id,
          timestamp: Date.now(),
          method: 'manual'
        }),
      });
    }
  };

  return {
    notifyOffline,
  };
}
