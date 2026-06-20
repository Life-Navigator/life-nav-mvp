/**
 * Command Center agent catalog (frontend mirror of core-api advisor_agents).
 *
 * The live roster comes from GET /api/chat/agents; AGENT_FALLBACK keeps the selector populated when the
 * backend is unreachable so the UI is never empty. Keep ids in sync with app/services/advisor_agents.py.
 */
export const RELATIONSHIP_MANAGER = 'relationship_manager';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  domains: string[];
  capabilities: string[];
  groundingSources?: string[];
  mode: 'relationship_manager' | 'direct';
  isOrchestrator: boolean;
}

export const AGENT_FALLBACK: AgentInfo[] = [
  {
    id: RELATIONSHIP_MANAGER,
    name: 'Relationship Manager',
    description: 'Coordinates every domain advisor for broad questions and your next best action.',
    icon: 'compass',
    domains: [],
    capabilities: ['cross-domain synthesis', 'next best action', 'prioritization'],
    mode: 'relationship_manager',
    isOrchestrator: true,
  },
  {
    id: 'finance_advisor',
    name: 'Finance Advisor',
    description: 'Cash flow, debt, savings, affordability.',
    icon: 'banknote',
    domains: ['finance'],
    capabilities: ['affordability', 'debt', 'savings'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'career_advisor',
    name: 'Career Advisor',
    description: 'Roles, promotions, skills, trajectory.',
    icon: 'briefcase',
    domains: ['career'],
    capabilities: ['promotion readiness', 'skills gap'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'education_advisor',
    name: 'Education Advisor',
    description: 'Degrees, certifications, schooling ROI.',
    icon: 'graduation-cap',
    domains: ['education'],
    capabilities: ['credential ROI', 'degree decisions'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'health_advisor',
    name: 'Health Advisor',
    description: 'Wellness and coverage (general guidance).',
    icon: 'heart-pulse',
    domains: ['health'],
    capabilities: ['wellness goals'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'family_advisor',
    name: 'Family Advisor',
    description: 'Household, dependents, guardianship.',
    icon: 'users',
    domains: ['family'],
    capabilities: ['dependents', 'guardianship'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'document_advisor',
    name: 'Document Intelligence Advisor',
    description: 'What your uploaded documents say.',
    icon: 'file-text',
    domains: ['documents'],
    capabilities: ['document facts'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'scenario_planner',
    name: 'Scenario Planner',
    description: 'Compare options and trade-offs.',
    icon: 'git-branch',
    domains: ['career', 'education', 'finance'],
    capabilities: ['option comparison'],
    mode: 'direct',
    isOrchestrator: false,
  },
  {
    id: 'report_advisor',
    name: 'Report Advisor',
    description: 'Explains your readiness scores.',
    icon: 'bar-chart',
    domains: ['career', 'education', 'finance', 'health', 'family'],
    capabilities: ['score explanation'],
    mode: 'direct',
    isOrchestrator: false,
  },
];

export function agentName(
  id: string | null | undefined,
  roster: AgentInfo[] = AGENT_FALLBACK
): string {
  if (!id) return 'Relationship Manager';
  return (
    roster.find((a) => a.id === id)?.name ??
    AGENT_FALLBACK.find((a) => a.id === id)?.name ??
    'Advisor'
  );
}
