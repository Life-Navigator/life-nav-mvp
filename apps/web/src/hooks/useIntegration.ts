// hooks/useIntegration.ts
import { useState } from 'react';
import { initiateOAuth } from '../lib/api/integrations';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export function useIntegration() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  
  const initOAuthFlow = async (providerId: string) => {
    try {
      setConnectionStatus('connecting');
      const authUrl = await initiateOAuth(providerId);
      
      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'oauth-popup',
        'width=600,height=700,left=200,top=100'
      );
      
      if (!popup) {
        throw new Error('Failed to open OAuth popup. Please disable popup blockers.');
      }
      
      // Set up message listener for OAuth callback
      const handleOAuthCallback = (event: MessageEvent) => {
        // Make sure the message is from our expected origin
        if (event.origin !== window.location.origin) return;
        
        // Handle the OAuth response
        if (event.data?.type === 'oauth-success') {
          setConnectionStatus('connected');
          window.removeEventListener('message', handleOAuthCallback);
        } else if (event.data?.type === 'oauth-error') {
          setConnectionStatus('failed');
          window.removeEventListener('message', handleOAuthCallback);
        }
      };
      
      window.addEventListener('message', handleOAuthCallback);
      
      // Cleanup if popup closes without sending a message
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleOAuthCallback);
          setConnectionStatus('idle');
        }
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setConnectionStatus('failed');
      return false;
    }
  };
  
  return {
    connectionStatus,
    initOAuthFlow,
  };
}