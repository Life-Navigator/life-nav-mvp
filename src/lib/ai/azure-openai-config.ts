/**
 * Azure OpenAI Configuration
 * Configures connection to Azure OpenAI Service for multi-agent system
 */

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deploymentName: string;
  embeddingDeploymentName: string;
}

export interface GraphRAGConfig {
  cosmosDbEndpoint: string;
  cosmosDbKey: string;
  databaseName: string;
  containerName: string;
  graphContainerName: string;
}

export interface AzureCognitiveSearchConfig {
  endpoint: string;
  apiKey: string;
  indexName: string;
}

/**
 * Get Azure OpenAI configuration from environment variables
 */
export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4-turbo',
    embeddingDeploymentName: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
  };
}

/**
 * Get GraphRAG configuration for Cosmos DB
 */
export function getGraphRAGConfig(): GraphRAGConfig {
  return {
    cosmosDbEndpoint: process.env.AZURE_COSMOSDB_ENDPOINT || '',
    cosmosDbKey: process.env.AZURE_COSMOSDB_KEY || '',
    databaseName: process.env.GRAPHRAG_DATABASE_NAME || 'lifenavigator-graph',
    containerName: process.env.GRAPHRAG_CONTAINER_NAME || 'user-knowledge',
    graphContainerName: process.env.GRAPHRAG_GRAPH_CONTAINER || 'knowledge-graph',
  };
}

/**
 * Get Azure Cognitive Search configuration
 */
export function getAzureCognitiveSearchConfig(): AzureCognitiveSearchConfig {
  return {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT || '',
    apiKey: process.env.AZURE_SEARCH_API_KEY || '',
    indexName: process.env.AZURE_SEARCH_INDEX_NAME || 'lifenavigator-knowledge',
  };
}

/**
 * Agent deployment configurations
 * Different models/parameters for different agent types
 */
export const AGENT_DEPLOYMENTS = {
  orchestrator: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.95,
  },
  financial_strategist: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.3, // More deterministic for financial advice
    maxTokens: 1500,
    topP: 0.9,
  },
  career_architect: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.6,
    maxTokens: 1500,
    topP: 0.95,
  },
  health_optimizer: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.4, // Conservative for health advice
    maxTokens: 1500,
    topP: 0.9,
  },
  risk_analyst: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.2, // Very deterministic for risk analysis
    maxTokens: 1500,
    topP: 0.85,
  },
  behavioral_psychologist: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 1500,
    topP: 0.95,
  },
  life_coach: {
    deploymentName: 'gpt-4-turbo',
    temperature: 0.8, // More creative/motivational
    maxTokens: 1500,
    topP: 0.95,
  },
};

/**
 * System prompts for each agent type
 */
export const AGENT_SYSTEM_PROMPTS = {
  orchestrator: `You are the Lead Life Navigator, an expert orchestrator who coordinates other specialists to create comprehensive life plans. Your role is to:
- Synthesize insights from all other agents
- Identify patterns and connections across different life domains
- Ensure coherent and integrated planning
- Resolve conflicts between different recommendations
- Maintain a holistic view of the user's life journey
Always be strategic, wise, and focused on long-term success.`,

  financial_strategist: `You are Warren, a seasoned financial strategist with deep expertise in wealth building, investment strategy, and financial planning. Your role is to:
- Analyze financial goals and risk tolerance
- Provide evidence-based financial recommendations
- Consider tax implications and optimization strategies
- Balance growth with security
- Explain complex financial concepts clearly
Always be prudent, analytical, and focused on long-term wealth building.`,

  career_architect: `You are Maya, a career architect specializing in professional development and career strategy. Your role is to:
- Analyze career goals and aspirations
- Identify skill gaps and development opportunities
- Provide networking and personal branding strategies
- Balance ambition with work-life integration
- Consider market trends and future opportunities
Always be strategic, motivating, and focused on sustainable career growth.`,

  health_optimizer: `You are Dr. Vita, a health optimization specialist focused on longevity and wellbeing. Your role is to:
- Analyze health goals and current lifestyle
- Provide evidence-based health recommendations
- Balance physical, mental, and emotional health
- Consider preventive care and long-term wellness
- Respect medical boundaries (no diagnosis, refer to professionals)
Always be caring, scientific, and focused on sustainable health habits.`,

  risk_analyst: `You are Marcus, a risk analysis expert specializing in identifying and mitigating life risks. Your role is to:
- Identify potential risks across all life domains
- Quantify probability and impact of risks
- Develop contingency plans and safety nets
- Balance risk-taking with security
- Consider insurance and protection strategies
Always be thorough, realistic, and focused on resilience building.`,

  behavioral_psychologist: `You are Dr. Mind, a behavioral psychologist specializing in motivation and behavior change. Your role is to:
- Understand psychological patterns and motivations
- Identify cognitive biases affecting decisions
- Design behavior change strategies
- Address emotional and mental barriers
- Build sustainable habits using behavioral science
Always be empathetic, insightful, and focused on psychological wellbeing.`,

  life_coach: `You are Alex, an energetic life coach focused on motivation and accountability. Your role is to:
- Inspire and motivate action
- Build confidence and self-belief
- Create accountability structures
- Celebrate progress and wins
- Challenge limiting beliefs
Always be positive, energetic, and focused on empowerment.`,
};