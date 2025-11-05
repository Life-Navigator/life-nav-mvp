/**
 * Azure OpenAI Client
 * Handles communication with Azure OpenAI Service
 */

import { 
  AzureOpenAIConfig, 
  AGENT_DEPLOYMENTS, 
  AGENT_SYSTEM_PROMPTS,
  getAzureOpenAIConfig 
} from './azure-openai-config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string; // For multi-agent conversations
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface EmbeddingResponse {
  embedding: number[];
  text: string;
}

/**
 * Azure OpenAI Client for multi-agent communication
 */
export class AzureOpenAIClient {
  private config: AzureOpenAIConfig;
  private baseUrl: string;

  constructor(config?: AzureOpenAIConfig) {
    this.config = config || getAzureOpenAIConfig();
    this.baseUrl = `${this.config.endpoint}/openai/deployments`;
  }

  /**
   * Send a chat completion request to Azure OpenAI
   */
  async getChatCompletion(
    messages: ChatMessage[],
    agentType?: string,
    options?: ChatCompletionOptions
  ): Promise<string> {
    const deployment = agentType 
      ? AGENT_DEPLOYMENTS[agentType as keyof typeof AGENT_DEPLOYMENTS]
      : AGENT_DEPLOYMENTS.orchestrator;

    const url = `${this.baseUrl}/${deployment.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

    const requestBody = {
      messages,
      temperature: options?.temperature ?? deployment.temperature,
      max_tokens: options?.maxTokens ?? deployment.maxTokens,
      top_p: options?.topP ?? deployment.topP,
      frequency_penalty: options?.frequencyPenalty ?? 0,
      presence_penalty: options?.presencePenalty ?? 0,
      stop: options?.stop,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error calling Azure OpenAI:', error);
      throw error;
    }
  }

  /**
   * Get chat completion with agent persona
   */
  async getAgentResponse(
    agentType: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    context?: string
  ): Promise<string> {
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType as keyof typeof AGENT_SYSTEM_PROMPTS];
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt + (context ? `\n\nContext:\n${context}` : ''),
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    return this.getChatCompletion(messages, agentType);
  }

  /**
   * Get embeddings for text
   */
  async getEmbedding(text: string): Promise<EmbeddingResponse> {
    const url = `${this.baseUrl}/${this.config.embeddingDeploymentName}/embeddings?api-version=${this.config.apiVersion}`;

    const requestBody = {
      input: text,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure OpenAI Embedding API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        embedding: data.data[0]?.embedding || [],
        text,
      };
    } catch (error) {
      console.error('Error getting embedding:', error);
      throw error;
    }
  }

  /**
   * Multi-agent conversation orchestration
   */
  async orchestrateMultiAgentResponse(
    userMessage: string,
    activeAgents: string[],
    conversationHistory: ChatMessage[],
    userContext: any
  ): Promise<{
    agentResponses: Map<string, string>;
    synthesizedResponse: string;
  }> {
    const agentResponses = new Map<string, string>();

    // Get responses from each active agent in parallel
    const agentPromises = activeAgents.map(async (agentType) => {
      const context = this.buildAgentContext(agentType, userContext);
      const response = await this.getAgentResponse(
        agentType,
        userMessage,
        conversationHistory,
        context
      );
      return { agentType, response };
    });

    const results = await Promise.all(agentPromises);
    results.forEach(({ agentType, response }) => {
      agentResponses.set(agentType, response);
    });

    // Orchestrator synthesizes all agent responses
    const synthesisPrompt = this.buildSynthesisPrompt(userMessage, agentResponses);
    const synthesizedResponse = await this.getAgentResponse(
      'orchestrator',
      synthesisPrompt,
      conversationHistory,
      JSON.stringify(userContext)
    );

    return {
      agentResponses,
      synthesizedResponse,
    };
  }

  /**
   * Build context for specific agent type
   */
  private buildAgentContext(agentType: string, userContext: any): string {
    const contextParts: string[] = [];

    // Add relevant context based on agent type
    switch (agentType) {
      case 'financial_strategist':
        if (userContext.financialGoals) {
          contextParts.push(`Financial Goals: ${JSON.stringify(userContext.financialGoals)}`);
        }
        if (userContext.riskProfile?.financial) {
          contextParts.push(`Financial Risk Tolerance: ${userContext.riskProfile.financial}`);
        }
        break;

      case 'career_architect':
        if (userContext.careerGoals) {
          contextParts.push(`Career Goals: ${JSON.stringify(userContext.careerGoals)}`);
        }
        if (userContext.skills) {
          contextParts.push(`Current Skills: ${userContext.skills.join(', ')}`);
        }
        break;

      case 'health_optimizer':
        if (userContext.healthGoals) {
          contextParts.push(`Health Goals: ${JSON.stringify(userContext.healthGoals)}`);
        }
        if (userContext.healthMetrics) {
          contextParts.push(`Health Metrics: ${JSON.stringify(userContext.healthMetrics)}`);
        }
        break;

      case 'risk_analyst':
        if (userContext.riskProfile) {
          contextParts.push(`Risk Profile: ${JSON.stringify(userContext.riskProfile)}`);
        }
        if (userContext.constraints) {
          contextParts.push(`Constraints: ${JSON.stringify(userContext.constraints)}`);
        }
        break;

      case 'behavioral_psychologist':
        if (userContext.motivations) {
          contextParts.push(`Primary Motivations: ${userContext.motivations.join(', ')}`);
        }
        if (userContext.behavioralPatterns) {
          contextParts.push(`Behavioral Patterns: ${userContext.behavioralPatterns.join(', ')}`);
        }
        break;

      case 'life_coach':
        if (userContext.values) {
          contextParts.push(`Core Values: ${userContext.values.join(', ')}`);
        }
        if (userContext.aspirations) {
          contextParts.push(`Aspirations: ${userContext.aspirations.join(', ')}`);
        }
        break;
    }

    return contextParts.join('\n');
  }

  /**
   * Build synthesis prompt for orchestrator
   */
  private buildSynthesisPrompt(
    userMessage: string,
    agentResponses: Map<string, string>
  ): string {
    let prompt = `User asked: "${userMessage}"\n\n`;
    prompt += 'Here are the perspectives from different specialists:\n\n';

    agentResponses.forEach((response, agentType) => {
      const agentName = agentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      prompt += `${agentName}:\n${response}\n\n`;
    });

    prompt += 'Please synthesize these perspectives into a coherent, actionable response that:';
    prompt += '\n1. Integrates insights from all specialists';
    prompt += '\n2. Resolves any conflicts or contradictions';
    prompt += '\n3. Provides clear, prioritized recommendations';
    prompt += '\n4. Maintains a holistic view of the user\'s journey';

    return prompt;
  }

  /**
   * Stream chat completion (for real-time responses)
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    agentType?: string,
    options?: ChatCompletionOptions
  ): AsyncGenerator<string> {
    const deployment = agentType 
      ? AGENT_DEPLOYMENTS[agentType as keyof typeof AGENT_DEPLOYMENTS]
      : AGENT_DEPLOYMENTS.orchestrator;

    const url = `${this.baseUrl}/${deployment.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

    const requestBody = {
      messages,
      temperature: options?.temperature ?? deployment.temperature,
      max_tokens: options?.maxTokens ?? deployment.maxTokens,
      top_p: options?.topP ?? deployment.topP,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Azure OpenAI API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from Azure OpenAI:', error);
      throw error;
    }
  }
}