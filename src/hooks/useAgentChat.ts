/**
 * React hook for agent chat functionality
 */
import { useState, useCallback, useEffect } from 'react';
import { agentApi, Agent, ChatMessage, ChatRequest } from '@/lib/api/agent';

interface UseAgentChatOptions {
  agentId?: string;
  onError?: (error: Error) => void;
}

interface UseAgentChatReturn {
  // State
  agent: Agent | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  sendMessage: (message: string, context?: Record<string, any>) => Promise<void>;
  setAgent: (agentId: string) => Promise<void>;
  clearMessages: () => void;
  reset: () => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const [agent, setAgentState] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agent on mount if agentId provided
  useEffect(() => {
    if (options.agentId) {
      loadAgent(options.agentId);
    }
  }, [options.agentId]);

  const loadAgent = async (agentId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const agentData = await agentApi.getAgent(agentId);
      setAgentState(agentData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load agent';
      setError(errorMsg);
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMsg));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, any>
  ) => {
    if (!agent) {
      const errorMsg = 'No agent selected';
      setError(errorMsg);
      if (options.onError) {
        options.onError(new Error(errorMsg));
      }
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      // Add user message to chat
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Send chat request
      const request: ChatRequest = {
        agent_id: agent.id,
        message,
        context,
      };

      const response = await agentApi.chat(request);

      // Add assistant response to chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMsg);
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMsg));
      }
    } finally {
      setIsSending(false);
    }
  }, [agent, options]);

  const setAgent = useCallback(async (agentId: string) => {
    await loadAgent(agentId);
    setMessages([]); // Clear messages when switching agents
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const reset = useCallback(() => {
    setAgentState(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    agent,
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    setAgent,
    clearMessages,
    reset,
  };
}

/**
 * Hook for managing available agents
 */
export function useAgents(userId: string = 'default_user') {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const agentList = await agentApi.listAgents(userId);
      setAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createAgent = useCallback(async (
    agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const newAgent = await agentApi.createAgent(agent);
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteAgent = useCallback(async (agentId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await agentApi.deleteAgent(agentId);
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    isLoading,
    error,
    reload: loadAgents,
    createAgent,
    deleteAgent,
  };
}

/**
 * Hook for streaming chat responses
 */
export function useAgentChatStream(agentId: string) {
  const [agent, setAgentState] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  const loadAgent = async () => {
    try {
      setIsLoading(true);
      const agentData = await agentApi.getAgent(agentId);
      setAgentState(agentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, any>
  ) => {
    if (!agent) {
      setError('No agent selected');
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      setStreamingMessage('');

      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Send streaming request
      await agentApi.chatStream(
        { agent_id: agent.id, message, context },
        (chunk) => {
          setStreamingMessage(prev => prev + chunk);
        },
        () => {
          // On complete, add final message
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: streamingMessage,
            timestamp: new Date().toISOString(),
          }]);
          setStreamingMessage('');
          setIsSending(false);
        },
        (err) => {
          setError(err.message);
          setIsSending(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsSending(false);
    }
  }, [agent, streamingMessage]);

  return {
    agent,
    messages,
    isLoading,
    isSending,
    streamingMessage,
    error,
    sendMessage,
    clearMessages: () => setMessages([]),
  };
}
