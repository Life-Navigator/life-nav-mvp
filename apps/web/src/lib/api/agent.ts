/**
 * Agent/MCP Server API Client
 * Connects to Maverick AI backend at localhost:8080
 */

const AGENT_API_BASE_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8080';

// Types
export interface Agent {
  id: string;
  name: string;
  description: string;
  agent_type: 'research' | 'financial' | 'health' | 'education' | 'career' | 'general';
  capabilities: string[];
  system_prompt: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  agent_id: string;
  message: string;
  context?: Record<string, any>;
  stream?: boolean;
}

export interface ChatResponse {
  message: string;
  agent_id: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface TaskRequest {
  agent_id: string;
  task_type: string;
  parameters: Record<string, any>;
}

export interface TaskResponse {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  databases: {
    postgres: string;
    redis: string;
    neo4j: string;
    qdrant: string;
  };
  plugins: Record<string, any>;
}

/**
 * Agent API Client
 */
export const agentApi = {
  /**
   * Check API health status
   */
  health: async (): Promise<HealthResponse> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * List all agents for a user
   */
  listAgents: async (userId: string = 'default_user'): Promise<Agent[]> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/agents?user_id=${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }
    const data = await response.json();
    return data.agents || [];  // Extract agents array from response
  },

  /**
   * Get a specific agent by ID
   */
  getAgent: async (agentId: string): Promise<Agent> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/agents/${agentId}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Create a new agent
   */
  createAgent: async (agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agent),
    });
    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Update an existing agent
   */
  updateAgent: async (agentId: string, updates: Partial<Agent>): Promise<Agent> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/agents/${agentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`Failed to update agent: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Delete an agent
   */
  deleteAgent: async (agentId: string): Promise<void> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/agents/${agentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete agent: ${response.statusText}`);
    }
  },

  /**
   * Chat with an agent (main interaction endpoint)
   * Uses Next.js proxy to connect to agent service on port 8081
   */
  chat: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Chat request failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Chat with streaming response
   */
  chatStream: async (
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    try {
      const response = await fetch(`${AGENT_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Chat stream failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            onChunk(line);
          }
        }
      }

      if (buffer.trim()) {
        onChunk(buffer);
      }

      onComplete();
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  },

  /**
   * Execute a task with an agent
   */
  executeTask: async (request: TaskRequest): Promise<TaskResponse> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Task execution failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get task status
   */
  getTaskStatus: async (taskId: string): Promise<TaskResponse> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Direct model inference (for advanced use)
   */
  inference: async (prompt: string, context?: Record<string, any>): Promise<{ response: string }> => {
    const response = await fetch(`${AGENT_API_BASE_URL}/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, context }),
    });
    if (!response.ok) {
      throw new Error(`Inference failed: ${response.statusText}`);
    }
    return response.json();
  },
};

/**
 * Utility function to create a default agent for a specific domain
 */
export const createDomainAgent = async (
  domain: Agent['agent_type'],
  userId: string = 'default_user'
): Promise<Agent> => {
  const agentConfigs: Record<Agent['agent_type'], Omit<Agent, 'id' | 'created_at' | 'updated_at'>> = {
    financial: {
      name: 'Financial Advisor',
      description: 'AI assistant for financial planning and analysis',
      agent_type: 'financial',
      capabilities: ['financial_analysis', 'budgeting', 'investment_advice'],
      system_prompt: 'You are a knowledgeable financial advisor specializing in personal finance, budgeting, and investment strategies. Provide clear, actionable advice.',
      user_id: userId,
    },
    health: {
      name: 'Health Assistant',
      description: 'AI assistant for health and wellness guidance',
      agent_type: 'health',
      capabilities: ['health_tracking', 'wellness_advice', 'medical_research'],
      system_prompt: 'You are a helpful health assistant providing wellness guidance, fitness advice, and health information. Always recommend consulting healthcare professionals for medical decisions.',
      user_id: userId,
    },
    education: {
      name: 'Learning Coach',
      description: 'AI assistant for educational guidance and skill development',
      agent_type: 'education',
      capabilities: ['learning_paths', 'skill_recommendations', 'course_suggestions'],
      system_prompt: 'You are an educational coach helping users learn new skills, find courses, and create personalized learning paths.',
      user_id: userId,
    },
    career: {
      name: 'Career Advisor',
      description: 'AI assistant for career development and job search',
      agent_type: 'career',
      capabilities: ['career_advice', 'resume_review', 'interview_prep'],
      system_prompt: 'You are a career advisor providing guidance on professional development, job search strategies, and career transitions.',
      user_id: userId,
    },
    research: {
      name: 'Research Assistant',
      description: 'AI assistant for research and information gathering',
      agent_type: 'research',
      capabilities: ['research', 'data_analysis', 'information_synthesis'],
      system_prompt: 'You are a research assistant helping users gather, analyze, and synthesize information on various topics.',
      user_id: userId,
    },
    general: {
      name: 'General Assistant',
      description: 'AI assistant for general tasks and questions',
      agent_type: 'general',
      capabilities: ['general_assistance', 'conversation', 'task_help'],
      system_prompt: 'You are a helpful AI assistant ready to assist with a wide range of tasks and questions.',
      user_id: userId,
    },
  };

  return agentApi.createAgent(agentConfigs[domain]);
};
