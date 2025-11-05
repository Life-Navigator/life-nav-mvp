/**
 * Azure OpenAI Multi-Agent Orchestration Engine
 * Real implementation using Azure OpenAI Service and GraphRAG
 */

import { AzureOpenAIClient, ChatMessage } from '../ai/azure-openai-client';
import { GraphRAGEngine, GraphNode } from '../ai/graphrag-engine';
import { 
  Agent, 
  AgentResponse, 
  ConversationContext,
  UserContext,
  MultiAgentResponse 
} from './types';
import { AGENT_DEFINITIONS } from './agent-factory';

export interface OrchestrationSession {
  id: string;
  userId: string;
  activeAgents: Agent[];
  conversationHistory: ChatMessage[];
  context: ConversationContext;
  graphRAG: GraphRAGEngine;
}

/**
 * Azure-based Multi-Agent Orchestration Engine
 */
export class AzureOrchestrationEngine {
  private openAIClient: AzureOpenAIClient;
  private graphRAG: GraphRAGEngine;
  private sessions: Map<string, OrchestrationSession>;

  constructor() {
    this.openAIClient = new AzureOpenAIClient();
    this.graphRAG = new GraphRAGEngine();
    this.sessions = new Map();
  }

  /**
   * Initialize the orchestration engine
   */
  async initialize(): Promise<void> {
    await this.graphRAG.initialize();
  }

  /**
   * Create a new orchestration session
   */
  async createSession(
    userId: string,
    userContext: UserContext,
    selectedAgents: string[]
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize agents
    const activeAgents = selectedAgents.map(agentType => 
      AGENT_DEFINITIONS[agentType as keyof typeof AGENT_DEFINITIONS]
    ).filter(Boolean);

    // Always include orchestrator
    if (!activeAgents.find(a => a.type === 'orchestrator')) {
      activeAgents.unshift(AGENT_DEFINITIONS.orchestrator);
    }

    // Build initial context from GraphRAG
    const graphContext = await this.graphRAG.buildUserContext(userId);
    
    const context: ConversationContext = {
      currentPhase: userContext.currentPhase || 'discovery',
      userIntent: '',
      activeTopics: [],
      emotionalState: 'neutral',
      decisionPoints: [],
      userProfile: {
        ...userContext,
        graphInsights: await this.graphRAG.extractInsights(userId),
      },
    };

    // Store user context in graph
    await this.storeUserContextInGraph(userId, userContext);

    const session: OrchestrationSession = {
      id: sessionId,
      userId,
      activeAgents,
      conversationHistory: [],
      context,
      graphRAG: this.graphRAG,
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Process a user message through the multi-agent system
   */
  async processMessage(
    sessionId: string,
    userMessage: string
  ): Promise<MultiAgentResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Update conversation history
    session.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Query GraphRAG for relevant context
    const relevantContext = await session.graphRAG.queryGraph(
      session.userId,
      userMessage,
      5
    );

    // Build enhanced context
    const enhancedContext = {
      ...session.context.userProfile,
      relevantKnowledge: relevantContext.map(r => ({
        type: r.node.type,
        properties: r.node.properties,
        relevance: r.relevanceScore,
      })),
      conversationHistory: session.conversationHistory.slice(-10), // Last 10 messages
    };

    // Get responses from all active agents using Azure OpenAI
    const agentResponses = await this.openAIClient.orchestrateMultiAgentResponse(
      userMessage,
      session.activeAgents.map(a => a.type),
      session.conversationHistory,
      enhancedContext
    );

    // Store insights in GraphRAG
    await this.storeConversationInsights(
      session.userId,
      userMessage,
      agentResponses.synthesizedResponse
    );

    // Update conversation history with synthesized response
    session.conversationHistory.push({
      role: 'assistant',
      content: agentResponses.synthesizedResponse,
    });

    // Analyze conversation for decision points and topics
    const analysis = await this.analyzeConversation(
      userMessage,
      agentResponses.synthesizedResponse,
      session.context
    );

    // Update session context
    session.context = {
      ...session.context,
      userIntent: analysis.intent,
      activeTopics: analysis.topics,
      emotionalState: analysis.emotionalState,
      decisionPoints: [...session.context.decisionPoints, ...analysis.decisionPoints],
    };

    // Generate recommendations based on conversation
    const recommendations = await session.graphRAG.generateRecommendations(
      session.userId,
      analysis.topics[0] // Focus on primary topic
    );

    // Format agent responses
    const formattedResponses: AgentResponse[] = [];
    agentResponses.agentResponses.forEach((response, agentType) => {
      const agent = session.activeAgents.find(a => a.type === agentType);
      if (agent) {
        formattedResponses.push({
          agent,
          message: response,
          confidence: 0.85, // Could be calculated based on response analysis
          suggestedActions: this.extractActions(response),
          insights: this.extractInsights(response),
        });
      }
    });

    return {
      responses: formattedResponses,
      synthesizedResponse: agentResponses.synthesizedResponse,
      nextSteps: recommendations,
      context: session.context,
    };
  }

  /**
   * Store user context in GraphRAG
   */
  private async storeUserContextInGraph(
    userId: string,
    userContext: UserContext
  ): Promise<void> {
    // Store user profile as a node
    await this.graphRAG.upsertNode(userId, {
      id: `user_${userId}`,
      type: 'user',
      properties: {
        name: userContext.name,
        age: userContext.age,
        location: userContext.location,
        currentPhase: userContext.currentPhase,
      },
      timestamp: new Date(),
    });

    // Store benefits as nodes
    if (userContext.selectedBenefits) {
      for (const benefit of userContext.selectedBenefits) {
        const benefitNode = await this.graphRAG.upsertNode(userId, {
          id: `benefit_${benefit.id}`,
          type: 'benefit',
          properties: {
            name: benefit.label,
            category: benefit.category,
            importance: benefit.importance || 'medium',
          },
          timestamp: new Date(),
        });

        // Create edge between user and benefit
        await this.graphRAG.createEdge(userId, {
          id: `edge_user_benefit_${benefit.id}`,
          source: `user_${userId}`,
          target: benefitNode.id,
          relationship: 'desires',
          weight: benefit.importance === 'high' ? 0.9 : 0.7,
        });
      }
    }

    // Store goals as nodes
    if (userContext.goals) {
      for (const goal of userContext.goals) {
        const goalNode = await this.graphRAG.upsertNode(userId, {
          id: `goal_${goal.id}`,
          type: 'goal',
          properties: {
            title: goal.title,
            category: goal.category,
            targetAge: goal.targetAge,
            priority: goal.priority,
            estimatedCost: goal.estimatedCost,
          },
          timestamp: new Date(),
        });

        // Create edge between user and goal
        await this.graphRAG.createEdge(userId, {
          id: `edge_user_goal_${goal.id}`,
          source: `user_${userId}`,
          target: goalNode.id,
          relationship: 'pursues',
          weight: goal.priority === 'critical' ? 1.0 : 0.8,
        });
      }
    }

    // Store risk profile as node
    if (userContext.riskProfile) {
      await this.graphRAG.upsertNode(userId, {
        id: `risk_${userId}`,
        type: 'risk',
        properties: userContext.riskProfile,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Store conversation insights in GraphRAG
   */
  private async storeConversationInsights(
    userId: string,
    userMessage: string,
    agentResponse: string
  ): Promise<void> {
    // Extract key insights from the conversation
    const insightPrompt = `
    Extract 1-3 key insights from this conversation exchange:
    User: ${userMessage}
    Assistant: ${agentResponse}
    
    Format as JSON array with each insight having: type, content, importance (high/medium/low)
    `;

    const insightsResponse = await this.openAIClient.getChatCompletion([
      { role: 'system', content: 'You are an insight extraction specialist. Return only valid JSON.' },
      { role: 'user', content: insightPrompt },
    ]);

    try {
      const insights = JSON.parse(insightsResponse);
      
      for (const insight of insights) {
        await this.graphRAG.upsertNode(userId, {
          id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'insight',
          properties: {
            content: insight.content,
            insightType: insight.type,
            importance: insight.importance,
            source: 'conversation',
            timestamp: new Date(),
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Error parsing insights:', error);
    }
  }

  /**
   * Analyze conversation for intent, topics, and emotional state
   */
  private async analyzeConversation(
    userMessage: string,
    agentResponse: string,
    currentContext: ConversationContext
  ): Promise<{
    intent: string;
    topics: string[];
    emotionalState: string;
    decisionPoints: string[];
  }> {
    const analysisPrompt = `
    Analyze this conversation exchange:
    User: ${userMessage}
    Assistant: ${agentResponse}
    
    Current context: ${JSON.stringify(currentContext.activeTopics)}
    
    Extract:
    1. User's primary intent (one sentence)
    2. Main topics discussed (up to 3)
    3. User's emotional state (positive/neutral/concerned/frustrated)
    4. Any decision points mentioned (things user needs to decide)
    
    Format as JSON with keys: intent, topics (array), emotionalState, decisionPoints (array)
    `;

    const analysisResponse = await this.openAIClient.getChatCompletion([
      { role: 'system', content: 'You are a conversation analyst. Return only valid JSON.' },
      { role: 'user', content: analysisPrompt },
    ]);

    try {
      return JSON.parse(analysisResponse);
    } catch (error) {
      console.error('Error parsing conversation analysis:', error);
      return {
        intent: '',
        topics: [],
        emotionalState: 'neutral',
        decisionPoints: [],
      };
    }
  }

  /**
   * Extract suggested actions from agent response
   */
  private extractActions(response: string): string[] {
    // Simple extraction - could be enhanced with AI
    const actionPatterns = [
      /(?:should|recommend|suggest|try|consider)\s+([^.!?]+)/gi,
      /(?:next step[s]?|action[s]?):\s*([^.!?]+)/gi,
    ];

    const actions: string[] = [];
    for (const pattern of actionPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actions.push(match[1].trim());
        }
      }
    }

    return actions.slice(0, 3); // Limit to 3 actions
  }

  /**
   * Extract insights from agent response
   */
  private extractInsights(response: string): string[] {
    // Simple extraction - could be enhanced with AI
    const insightPatterns = [
      /(?:notice|observe|see that|appears? that|seems? that)\s+([^.!?]+)/gi,
      /(?:pattern|trend|tendency):\s*([^.!?]+)/gi,
    ];

    const insights: string[] = [];
    for (const pattern of insightPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          insights.push(match[1].trim());
        }
      }
    }

    return insights.slice(0, 2); // Limit to 2 insights
  }

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): ConversationContext | undefined {
    return this.sessions.get(sessionId)?.context;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId)?.conversationHistory || [];
  }

  /**
   * End session
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}