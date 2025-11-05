/**
 * GraphRAG Engine for Life Navigator
 * Implements graph-based retrieval augmented generation using Azure services
 */

import { CosmosClient } from '@azure/cosmos';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { getGraphRAGConfig, getAzureCognitiveSearchConfig } from './azure-openai-config';
import { AzureOpenAIClient } from './azure-openai-client';

export interface GraphNode {
  id: string;
  type: 'user' | 'goal' | 'benefit' | 'risk' | 'action' | 'insight' | 'milestone';
  properties: Record<string, any>;
  embedding?: number[];
  timestamp: Date;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight: number;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  userId: string;
}

export interface SearchResult {
  node: GraphNode;
  relevanceScore: number;
  connectedNodes?: GraphNode[];
}

/**
 * GraphRAG Engine for managing user knowledge graphs
 */
export class GraphRAGEngine {
  private cosmosClient: CosmosClient;
  private searchClient: SearchClient<any>;
  private openAIClient: AzureOpenAIClient;
  private config: ReturnType<typeof getGraphRAGConfig>;
  private searchConfig: ReturnType<typeof getAzureCognitiveSearchConfig>;

  constructor() {
    this.config = getGraphRAGConfig();
    this.searchConfig = getAzureCognitiveSearchConfig();
    
    // Initialize Cosmos DB client for graph storage
    this.cosmosClient = new CosmosClient({
      endpoint: this.config.cosmosDbEndpoint,
      key: this.config.cosmosDbKey,
    });

    // Initialize Azure Cognitive Search client
    this.searchClient = new SearchClient(
      this.searchConfig.endpoint,
      this.searchConfig.indexName,
      new AzureKeyCredential(this.searchConfig.apiKey)
    );

    // Initialize OpenAI client for embeddings
    this.openAIClient = new AzureOpenAIClient();
  }

  /**
   * Initialize database and containers
   */
  async initialize(): Promise<void> {
    const { database } = await this.cosmosClient.databases.createIfNotExists({
      id: this.config.databaseName,
    });

    // Container for storing user knowledge
    await database.containers.createIfNotExists({
      id: this.config.containerName,
      partitionKey: { paths: ['/userId'] },
    });

    // Container for graph relationships
    await database.containers.createIfNotExists({
      id: this.config.graphContainerName,
      partitionKey: { paths: ['/userId'] },
    });
  }

  /**
   * Create or update a node in the knowledge graph
   */
  async upsertNode(userId: string, node: GraphNode): Promise<GraphNode> {
    // Generate embedding for the node
    const nodeText = this.nodeToText(node);
    const { embedding } = await this.openAIClient.getEmbedding(nodeText);
    node.embedding = embedding;

    // Store in Cosmos DB
    const database = this.cosmosClient.database(this.config.databaseName);
    const container = database.container(this.config.containerName);
    
    await container.items.upsert({
      ...node,
      userId,
      _id: node.id,
    });

    // Index in Azure Cognitive Search for vector search
    await this.indexNodeForSearch(node, userId);

    return node;
  }

  /**
   * Create an edge between two nodes
   */
  async createEdge(userId: string, edge: GraphEdge): Promise<GraphEdge> {
    const database = this.cosmosClient.database(this.config.databaseName);
    const container = database.container(this.config.graphContainerName);
    
    await container.items.upsert({
      ...edge,
      userId,
      _id: edge.id,
    });

    return edge;
  }

  /**
   * Query the knowledge graph using natural language
   */
  async queryGraph(userId: string, query: string, topK: number = 5): Promise<SearchResult[]> {
    // Generate embedding for the query
    const { embedding } = await this.openAIClient.getEmbedding(query);

    // Perform vector search
    const searchResults = await this.searchClient.search('*', {
      filter: `userId eq '${userId}'`,
      vectorQueries: [{
        kind: 'vector',
        vector: embedding,
        kNearestNeighborsCount: topK,
        fields: ['embedding'],
      }],
      select: ['id', 'type', 'properties', 'timestamp'],
      top: topK,
    });

    const results: SearchResult[] = [];
    for await (const result of searchResults.results) {
      const node: GraphNode = {
        id: result.document.id,
        type: result.document.type,
        properties: result.document.properties,
        timestamp: result.document.timestamp,
      };

      // Get connected nodes
      const connectedNodes = await this.getConnectedNodes(userId, node.id);

      results.push({
        node,
        relevanceScore: result.score || 0,
        connectedNodes,
      });
    }

    return results;
  }

  /**
   * Build user context from knowledge graph
   */
  async buildUserContext(userId: string): Promise<any> {
    const database = this.cosmosClient.database(this.config.databaseName);
    const container = database.container(this.config.containerName);

    // Get all user nodes
    const { resources: nodes } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }],
      })
      .fetchAll();

    // Organize by type
    const context: any = {
      goals: [],
      benefits: [],
      risks: [],
      insights: [],
      milestones: [],
      actions: [],
    };

    for (const node of nodes) {
      switch (node.type) {
        case 'goal':
          context.goals.push(node.properties);
          break;
        case 'benefit':
          context.benefits.push(node.properties);
          break;
        case 'risk':
          context.risks.push(node.properties);
          break;
        case 'insight':
          context.insights.push(node.properties);
          break;
        case 'milestone':
          context.milestones.push(node.properties);
          break;
        case 'action':
          context.actions.push(node.properties);
          break;
      }
    }

    // Get relationships
    const graphContainer = database.container(this.config.graphContainerName);
    const { resources: edges } = await graphContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }],
      })
      .fetchAll();

    context.relationships = edges;

    return context;
  }

  /**
   * Get nodes connected to a specific node
   */
  private async getConnectedNodes(userId: string, nodeId: string): Promise<GraphNode[]> {
    const database = this.cosmosClient.database(this.config.databaseName);
    const graphContainer = database.container(this.config.graphContainerName);

    // Find edges connected to this node
    const { resources: edges } = await graphContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId AND (c.source = @nodeId OR c.target = @nodeId)',
        parameters: [
          { name: '@userId', value: userId },
          { name: '@nodeId', value: nodeId },
        ],
      })
      .fetchAll();

    // Get connected node IDs
    const connectedIds = new Set<string>();
    for (const edge of edges) {
      if (edge.source === nodeId) {
        connectedIds.add(edge.target);
      } else {
        connectedIds.add(edge.source);
      }
    }

    // Fetch connected nodes
    const container = database.container(this.config.containerName);
    const connectedNodes: GraphNode[] = [];

    for (const id of connectedIds) {
      try {
        const { resource } = await container.item(id, userId).read();
        if (resource) {
          connectedNodes.push({
            id: resource.id,
            type: resource.type,
            properties: resource.properties,
            timestamp: resource.timestamp,
          });
        }
      } catch (error) {
        console.error(`Error fetching connected node ${id}:`, error);
      }
    }

    return connectedNodes;
  }

  /**
   * Convert node to text for embedding
   */
  private nodeToText(node: GraphNode): string {
    const parts = [`Type: ${node.type}`];
    
    for (const [key, value] of Object.entries(node.properties)) {
      if (typeof value === 'string' || typeof value === 'number') {
        parts.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(', ')}`);
      } else if (typeof value === 'object') {
        parts.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Index node in Azure Cognitive Search
   */
  private async indexNodeForSearch(node: GraphNode, userId: string): Promise<void> {
    try {
      await this.searchClient.uploadDocuments([{
        id: node.id,
        userId,
        type: node.type,
        properties: node.properties,
        embedding: node.embedding,
        timestamp: node.timestamp,
        searchText: this.nodeToText(node),
      }]);
    } catch (error) {
      console.error('Error indexing node for search:', error);
    }
  }

  /**
   * Extract insights from graph patterns
   */
  async extractInsights(userId: string): Promise<string[]> {
    const context = await this.buildUserContext(userId);
    const insights: string[] = [];

    // Analyze goal-benefit relationships
    if (context.goals.length > 0 && context.benefits.length > 0) {
      const goalTypes = new Set(context.goals.map((g: any) => g.category));
      const benefitTypes = new Set(context.benefits.map((b: any) => b.category));
      
      if (goalTypes.has('financial') && benefitTypes.has('security')) {
        insights.push('Your focus on financial goals aligns well with your desire for security.');
      }
      if (goalTypes.has('health') && benefitTypes.has('vitality')) {
        insights.push('Your health goals support your desire for increased vitality and energy.');
      }
    }

    // Analyze risk patterns
    if (context.risks.length > 0) {
      const riskLevels = context.risks.map((r: any) => r.level);
      const avgRisk = riskLevels.reduce((a: number, b: number) => a + b, 0) / riskLevels.length;
      
      if (avgRisk < 3) {
        insights.push('You tend to be risk-averse, which suggests conservative strategies may work best.');
      } else if (avgRisk > 7) {
        insights.push('You have a high risk tolerance, allowing for more aggressive growth strategies.');
      }
    }

    // Analyze action patterns
    if (context.actions.length > 0) {
      const completedActions = context.actions.filter((a: any) => a.completed).length;
      const completionRate = completedActions / context.actions.length;
      
      if (completionRate > 0.8) {
        insights.push('Your high action completion rate shows strong follow-through on commitments.');
      } else if (completionRate < 0.3) {
        insights.push('Consider breaking down actions into smaller, more manageable steps.');
      }
    }

    return insights;
  }

  /**
   * Generate recommendations based on graph analysis
   */
  async generateRecommendations(userId: string, focusArea?: string): Promise<string[]> {
    const context = await this.buildUserContext(userId);
    const insights = await this.extractInsights(userId);

    // Build prompt for recommendation generation
    const prompt = `
    Based on the following user context and insights, generate 3-5 specific, actionable recommendations${focusArea ? ` focused on ${focusArea}` : ''}:
    
    Context:
    - Goals: ${context.goals.length} goals across ${new Set(context.goals.map((g: any) => g.category)).size} categories
    - Benefits sought: ${context.benefits.map((b: any) => b.name).slice(0, 5).join(', ')}
    - Risk profile: ${context.risks.length > 0 ? 'Assessed' : 'Not assessed'}
    - Completed actions: ${context.actions.filter((a: any) => a.completed).length}
    
    Insights:
    ${insights.join('\n')}
    
    Provide recommendations that are:
    1. Specific and actionable
    2. Aligned with user's goals and benefits
    3. Appropriate for their risk profile
    4. Building on their existing progress
    `;

    const recommendations = await this.openAIClient.getChatCompletion([
      { role: 'system', content: 'You are a strategic life planning advisor.' },
      { role: 'user', content: prompt },
    ]);

    return recommendations.split('\n').filter(r => r.trim().length > 0);
  }
}