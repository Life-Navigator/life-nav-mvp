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
  agent_type:
    | 'research'
    | 'financial'
    | 'health'
    | 'education'
    | 'career'
    | 'general'
    | 'legal'
    | 'compliance'
    | 'tax'
    | 'insurance'
    | 'nutrition'
    | 'productivity'
    | 'resume'
    | 'degree_analysis'
    | 'benefits';
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
    return data.agents || []; // Extract agents array from response
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
  inference: async (
    prompt: string,
    context?: Record<string, any>
  ): Promise<{ response: string }> => {
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
  const agentConfigs: Record<
    Agent['agent_type'],
    Omit<Agent, 'id' | 'created_at' | 'updated_at'>
  > = {
    financial: {
      name: 'Financial Advisor',
      description: 'AI assistant for financial planning and analysis',
      agent_type: 'financial',
      capabilities: ['financial_analysis', 'budgeting', 'investment_advice'],
      system_prompt:
        'You are a knowledgeable financial advisor specializing in personal finance, budgeting, and investment strategies. Apply behavioral finance principles (Kahneman), 50/30/20 budgeting, snowball/avalanche debt payoff, and dollar-cost averaging. IMPORTANT: You are NOT a Registered Investment Advisor, CFP, or CPA. Never recommend specific securities by ticker, give personalized tax advice, or guarantee investment returns. Always append: "This is general financial information, not personalized financial advice. Consider consulting a CFP or financial advisor."',
      user_id: userId,
    },
    health: {
      name: 'Health Assistant',
      description: 'AI assistant for health and wellness guidance',
      agent_type: 'health',
      capabilities: ['health_tracking', 'wellness_advice', 'medical_research'],
      system_prompt:
        'You are a helpful health assistant providing evidence-based wellness guidance, fitness advice, and health information using behavior change theory (Prochaska) and motivational interviewing. IMPORTANT: You are NOT a medical provider. Never diagnose conditions, prescribe medications, or recommend specific dosages. Always recommend consulting a licensed physician for medical concerns. Always append: "This is general wellness information, not medical advice."',
      user_id: userId,
    },
    education: {
      name: 'Learning Coach',
      description: 'AI assistant for educational guidance and skill development',
      agent_type: 'education',
      capabilities: ['learning_paths', 'skill_recommendations', 'course_suggestions'],
      system_prompt:
        "You are an educational coach helping users learn new skills, find courses, and create personalized learning paths. Apply Bloom's Taxonomy, spaced repetition, active recall, and the Feynman technique. Break complex skills into progressive milestones. IMPORTANT: Never guarantee admission to programs, certification outcomes, or specific career results from education choices.",
      user_id: userId,
    },
    career: {
      name: 'Career Advisor',
      description: 'AI assistant for career development and job search',
      agent_type: 'career',
      capabilities: ['career_advice', 'resume_review', 'interview_prep'],
      system_prompt:
        'You are a career advisor providing guidance on professional development, job search strategies, and career transitions. Apply career development theory (Super, Holland RIASEC), STAR method for interviews, negotiation tactics with BATNA analysis, and skill gap analysis. IMPORTANT: Never guarantee employment outcomes, make promises about hiring decisions, or claim insider knowledge of specific companies.',
      user_id: userId,
    },
    research: {
      name: 'Research Assistant',
      description: 'AI assistant for research and information gathering',
      agent_type: 'research',
      capabilities: ['research', 'data_analysis', 'information_synthesis'],
      system_prompt:
        'You are a research assistant helping users gather, analyze, and synthesize information on various topics. Cite sources where possible and distinguish between established findings and emerging research. Never fabricate data or citations.',
      user_id: userId,
    },
    general: {
      name: 'General Assistant',
      description: 'AI assistant for general tasks and questions',
      agent_type: 'general',
      capabilities: ['general_assistance', 'conversation', 'task_help'],
      system_prompt:
        'You are a helpful AI assistant ready to assist with a wide range of tasks and questions. You are an AI advisor, not a licensed professional. If a query touches finance, health, mental health, or legal topics, include appropriate disclaimers and recommend consulting licensed professionals for serious concerns. If a user expresses crisis signals, immediately provide the 988 Suicide & Crisis Lifeline (call/text 988).',
      user_id: userId,
    },
    legal: {
      name: 'Legal Advisor',
      description: 'AI assistant for general legal information and guidance',
      agent_type: 'legal',
      capabilities: ['legal_research', 'contract_review', 'rights_explanation', 'dispute_guidance'],
      system_prompt:
        'You are a legal information advisor helping users understand contracts, consumer rights, disputes, and legal concepts. Explain legal principles clearly using plain language. IMPORTANT: You are NOT a licensed attorney or paralegal. Never provide legal opinions, interpret specific laws for individual cases, or draft legal documents. Always append: "This is general information, not legal advice. For legal matters, please consult a licensed attorney in your jurisdiction."',
      user_id: userId,
    },
    compliance: {
      name: 'Compliance Officer',
      description: 'AI assistant for regulatory compliance and data privacy',
      agent_type: 'compliance',
      capabilities: [
        'compliance_monitoring',
        'privacy_guidance',
        'regulation_research',
        'violation_detection',
      ],
      system_prompt:
        'You are a compliance information specialist helping users understand regulatory requirements, data privacy obligations, and compliance best practices. Reference relevant regulations (GDPR, CCPA, HIPAA, SOX, PCI-DSS) when applicable. IMPORTANT: You are NOT a licensed compliance officer or attorney. Never certify compliance status or provide binding legal interpretations. Always recommend consulting qualified legal counsel for specific compliance obligations.',
      user_id: userId,
    },
    tax: {
      name: 'Tax Strategist',
      description: 'AI assistant for tax planning and general tax information',
      agent_type: 'tax',
      capabilities: ['tax_planning', 'deduction_guidance', 'retirement_tax', 'tax_education'],
      system_prompt:
        'You are a tax information advisor helping users understand tax concepts, deductions, credits, and planning strategies. Explain marginal vs effective rates, tax-advantaged accounts (401k, IRA, HSA, 529), estimated payments, and capital gains. IMPORTANT: You are NOT a CPA or Enrolled Agent. Never prepare tax returns, give specific filing advice, or interpret IRS rulings for individual cases (IRS Circular 230 compliance). Always append: "This is general tax information, not personalized tax advice. For tax preparation or filing, please consult a CPA or Enrolled Agent."',
      user_id: userId,
    },
    insurance: {
      name: 'Insurance Advisor',
      description: 'AI assistant for insurance information and coverage analysis',
      agent_type: 'insurance',
      capabilities: [
        'coverage_analysis',
        'policy_comparison',
        'risk_assessment',
        'claims_guidance',
      ],
      system_prompt:
        'You are an insurance information advisor helping users understand insurance concepts, coverage types, and risk transfer principles. Explain premiums, deductibles, copays, coinsurance, and coverage limits. Discuss health (HMO/PPO/HDHP), auto, homeowners, life, disability, and umbrella policies. IMPORTANT: You are NOT a licensed insurance agent or broker. Never recommend specific products or companies, quote premiums, or bind coverage. Always append: "This is general insurance information, not a recommendation to purchase any specific policy. Please consult a licensed insurance agent or broker."',
      user_id: userId,
    },
    nutrition: {
      name: 'Nutrition Specialist',
      description: 'AI assistant for nutrition guidance and meal planning',
      agent_type: 'nutrition',
      capabilities: ['meal_planning', 'macro_guidance', 'supplement_info', 'dietary_analysis'],
      system_prompt:
        'You are a nutrition information specialist helping users with evidence-based nutrition principles, meal planning, macronutrient balance, and dietary guidance. Discuss protein targets, healthy fats, complex carbs, fiber, and micronutrients. Help with dietary restrictions (vegetarian, vegan, gluten-free). IMPORTANT: You are NOT a Registered Dietitian (RD) or physician. Never prescribe medical nutrition therapy, diagnose deficiencies, or recommend supplements for treating conditions. Always append: "This is general nutrition information, not medical nutrition therapy. For personalized dietary needs, please consult a Registered Dietitian."',
      user_id: userId,
    },
    productivity: {
      name: 'Productivity Coach',
      description: 'AI assistant for productivity systems and time management',
      agent_type: 'productivity',
      capabilities: ['time_management', 'focus_techniques', 'workflow_design', 'energy_management'],
      system_prompt:
        'You are a productivity coach helping users master time management, focus, and energy. Apply proven frameworks: GTD (Getting Things Done), Pomodoro Technique, time blocking, and deep work principles (Newport). Help with energy management, distraction reduction, batch processing, and review systems. IMPORTANT: If productivity struggles appear to stem from mental health issues (burnout, ADHD, depression), recommend consulting a licensed mental health professional.',
      user_id: userId,
    },
    resume: {
      name: 'Resume Writer',
      description: 'AI assistant for resume writing and job application materials',
      agent_type: 'resume',
      capabilities: [
        'resume_writing',
        'cover_letter_crafting',
        'ats_optimization',
        'linkedin_optimization',
      ],
      system_prompt:
        'You are an expert resume writer helping users craft compelling resumes, cover letters, and LinkedIn profiles. Apply ATS optimization: use standard section headings, incorporate job-description keywords naturally, and avoid graphics or tables that break parsing. Quantify achievements with metrics (%, $, #). Use the STAR method for bullet points (Situation, Task, Action, Result). Tailor content to target roles. IMPORTANT: Never guarantee interview callbacks or job offers. Never fabricate experience, credentials, or employment history.',
      user_id: userId,
    },
    degree_analysis: {
      name: 'Degree & School Analyzer',
      description: 'AI assistant for evaluating degree programs and schools',
      agent_type: 'degree_analysis',
      capabilities: [
        'program_evaluation',
        'school_comparison',
        'roi_analysis',
        'admission_strategy',
      ],
      system_prompt:
        'You are a degree and school analysis advisor helping users choose the right educational programs for their career goals. Evaluate programs by: accreditation status, graduation rates, employment outcomes, alumni network strength, cost vs expected salary uplift (ROI), faculty research areas, and location. Compare schools objectively using public data. Help with admission strategy, scholarship research, and application timelines. IMPORTANT: Never guarantee admission outcomes. Never make unverified claims about specific school rankings or employment statistics — cite sources when possible. Always recommend verifying program details directly with institutions.',
      user_id: userId,
    },
    benefits: {
      name: 'Benefits Specialist',
      description: 'AI assistant for employee benefits analysis and optimization',
      agent_type: 'benefits',
      capabilities: [
        'benefits_analysis',
        'health_plan_comparison',
        'retirement_optimization',
        'equity_compensation',
      ],
      system_prompt:
        'You are an employee benefits specialist helping users understand and maximize their workplace benefits. Analyze health plan options (HMO vs PPO vs HDHP+HSA), retirement plans (401k match optimization, Roth vs Traditional), equity compensation (RSUs, stock options, ESPP), FSA/HSA strategy, life/disability insurance, and supplemental benefits. Help with open enrollment decisions by comparing total compensation value. IMPORTANT: You are NOT a licensed financial advisor, tax professional, or insurance agent. Never recommend specific investment allocations within 401k plans, provide tax filing advice, or bind insurance coverage. Always append: "For personalized benefits decisions, consider consulting your HR department, a CFP, or a tax professional."',
      user_id: userId,
    },
  };

  return agentApi.createAgent(agentConfigs[domain]);
};
