/**
 * Roadmap Generation Engine
 *
 * Deterministic roadmap generation from scenario inputs and simulation results
 * Phases + tasks derived from goal types, timeline inputs, and risk/driver analysis
 */

import type { ScenarioInput } from '../types';

export interface RoadmapPhase {
  phase_number: number;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface RoadmapTask {
  phase_number: number;
  task_number: number;
  title: string;
  description: string;
  category: 'education' | 'career' | 'finance' | 'health' | 'ops';
  priority: 'P0' | 'P1' | 'P2';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  estimated_hours: number | null;
  blocking_dependencies: number[] | null;
  confidence: number | null;
  rationale: string | null;
}

export interface GenerateRoadmapInput {
  scenarioName: string;
  inputs: ScenarioInput[];
  simulationResults?: {
    goals: Array<{
      goal_id: string;
      top_drivers: Array<{ factor: string; impact: number }>;
      top_risks: Array<{ factor: string; impact: number }>;
    }>;
  };
}

export interface GeneratedRoadmap {
  phases: RoadmapPhase[];
  tasks: RoadmapTask[];
}

/**
 * Main roadmap generation function
 */
export function generateRoadmap(input: GenerateRoadmapInput): GeneratedRoadmap {
  const { inputs, simulationResults } = input;

  // Analyze inputs to determine primary path
  const pathType = determinePrimaryPath(inputs);

  // Generate phases based on path type
  const phases = generatePhases(pathType, inputs);

  // Generate tasks based on phases, inputs, and simulation results
  const tasks = generateTasks(phases, inputs, simulationResults);

  return { phases, tasks };
}

/**
 * Determine primary path from inputs
 */
function determinePrimaryPath(inputs: ScenarioInput[]): 'education' | 'career' | 'financial' | 'mixed' {
  const fieldCounts = {
    education: 0,
    career: 0,
    financial: 0,
  };

  const educationFields = ['tuition', 'fees', 'scholarship', 'grant', 'student_loan', 'graduation_date'];
  const careerFields = ['salary', 'hourly_wage', 'bonus', 'start_date', 'annual_income'];
  const financialFields = ['loan_principal', 'apr', 'monthly_payment', 'emergency_fund', 'rent', 'mortgage'];

  for (const input of inputs) {
    const fieldLower = input.field_name.toLowerCase();

    if (educationFields.some(f => fieldLower.includes(f))) {
      fieldCounts.education++;
    }
    if (careerFields.some(f => fieldLower.includes(f))) {
      fieldCounts.career++;
    }
    if (financialFields.some(f => fieldLower.includes(f))) {
      fieldCounts.financial++;
    }
  }

  const maxCount = Math.max(fieldCounts.education, fieldCounts.career, fieldCounts.financial);

  if (maxCount === 0) return 'mixed';
  if (fieldCounts.education === maxCount) return 'education';
  if (fieldCounts.career === maxCount) return 'career';
  if (fieldCounts.financial === maxCount) return 'financial';

  return 'mixed';
}

/**
 * Generate phases based on path type
 */
function generatePhases(pathType: string, inputs: ScenarioInput[]): RoadmapPhase[] {
  const now = new Date();

  switch (pathType) {
    case 'education':
      return [
        {
          phase_number: 1,
          name: 'Admissions & Funding',
          description: 'Apply for programs, secure financial aid and scholarships',
          start_date: now.toISOString(),
          end_date: addMonths(now, 3).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 2,
          name: 'Enrollment & Foundation',
          description: 'Complete enrollment, set up finances, establish routines',
          start_date: addMonths(now, 3).toISOString(),
          end_date: addMonths(now, 6).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 3,
          name: 'Academic Execution',
          description: 'Complete coursework, build skills, maintain financial stability',
          start_date: addMonths(now, 6).toISOString(),
          end_date: addMonths(now, 18).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 4,
          name: 'Career Preparation',
          description: 'Internships, portfolio building, job search preparation',
          start_date: addMonths(now, 18).toISOString(),
          end_date: addMonths(now, 24).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 5,
          name: 'Graduation & Transition',
          description: 'Graduate, secure employment, transition to career',
          start_date: addMonths(now, 24).toISOString(),
          end_date: addMonths(now, 27).toISOString(),
          status: 'pending' as const,
        },
      ];

    case 'career':
      return [
        {
          phase_number: 1,
          name: 'Skills Gap Analysis',
          description: 'Identify skill requirements and create learning plan',
          start_date: now.toISOString(),
          end_date: addMonths(now, 1).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 2,
          name: 'Skill Development',
          description: 'Complete courses, certifications, and build portfolio',
          start_date: addMonths(now, 1).toISOString(),
          end_date: addMonths(now, 4).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 3,
          name: 'Network & Application',
          description: 'Build network, apply for positions, prepare for interviews',
          start_date: addMonths(now, 4).toISOString(),
          end_date: addMonths(now, 7).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 4,
          name: 'Interview & Negotiation',
          description: 'Interview rounds, offer negotiation, transition planning',
          start_date: addMonths(now, 7).toISOString(),
          end_date: addMonths(now, 9).toISOString(),
          status: 'pending' as const,
        },
      ];

    case 'financial':
      return [
        {
          phase_number: 1,
          name: 'Baseline & Budget',
          description: 'Establish current financial state and create budget',
          start_date: now.toISOString(),
          end_date: addMonths(now, 1).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 2,
          name: 'Emergency Fund & Debt',
          description: 'Build emergency fund and address high-interest debt',
          start_date: addMonths(now, 1).toISOString(),
          end_date: addMonths(now, 6).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 3,
          name: 'Insurance & Risk Management',
          description: 'Review and optimize insurance coverage',
          start_date: addMonths(now, 6).toISOString(),
          end_date: addMonths(now, 7).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 4,
          name: 'Investing & Optimization',
          description: 'Begin investing and optimize financial systems',
          start_date: addMonths(now, 7).toISOString(),
          end_date: addMonths(now, 12).toISOString(),
          status: 'pending' as const,
        },
      ];

    default:
      return [
        {
          phase_number: 1,
          name: 'Foundation',
          description: 'Establish baseline and initial planning',
          start_date: now.toISOString(),
          end_date: addMonths(now, 2).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 2,
          name: 'Execution',
          description: 'Implement primary actions',
          start_date: addMonths(now, 2).toISOString(),
          end_date: addMonths(now, 6).toISOString(),
          status: 'pending' as const,
        },
        {
          phase_number: 3,
          name: 'Optimization',
          description: 'Refine and optimize systems',
          start_date: addMonths(now, 6).toISOString(),
          end_date: addMonths(now, 9).toISOString(),
          status: 'pending' as const,
        },
      ];
  }
}

/**
 * Generate tasks based on phases and inputs
 */
function generateTasks(
  phases: RoadmapPhase[],
  inputs: ScenarioInput[],
  simulationResults?: GenerateRoadmapInput['simulationResults']
): RoadmapTask[] {
  const tasks: RoadmapTask[] = [];
  let taskCounter = 1;

  // Always include foundational tasks (Phase 1)
  tasks.push({
    phase_number: 1,
    task_number: taskCounter++,
    title: 'Set emergency fund target',
    description: 'Calculate 3-6 months of expenses and create savings plan',
    category: 'finance',
    priority: 'P0',
    status: 'todo',
    due_date: addDays(new Date(), 7).toISOString(),
    estimated_hours: 2,
    blocking_dependencies: null,
    confidence: 0.9,
    rationale: 'Financial safety net reduces risk across all goals',
  });

  tasks.push({
    phase_number: 1,
    task_number: taskCounter++,
    title: 'Review insurance coverage',
    description: 'Verify health, auto, and other necessary insurance is adequate',
    category: 'finance',
    priority: 'P1',
    status: 'todo',
    due_date: addDays(new Date(), 14).toISOString(),
    estimated_hours: 3,
    blocking_dependencies: null,
    confidence: 0.85,
    rationale: 'Prevents catastrophic financial setbacks',
  });

  // Generate tasks from inputs
  const inputTasks = generateInputBasedTasks(inputs, phases);
  tasks.push(...inputTasks.map(t => ({ ...t, task_number: taskCounter++ })));

  // Generate tasks from simulation results (drivers & risks)
  if (simulationResults) {
    const simTasks = generateSimulationBasedTasks(simulationResults, phases);
    tasks.push(...simTasks.map(t => ({ ...t, task_number: taskCounter++ })));
  }

  // Always include recurring review task (last phase)
  const lastPhase = phases[phases.length - 1];
  tasks.push({
    phase_number: lastPhase.phase_number,
    task_number: taskCounter++,
    title: 'Monthly progress check-in',
    description: 'Review roadmap progress, update tasks, adjust as needed',
    category: 'ops',
    priority: 'P1',
    status: 'todo',
    due_date: addMonths(new Date(), 1).toISOString(),
    estimated_hours: 1,
    blocking_dependencies: null,
    confidence: 1.0,
    rationale: 'Regular review ensures plan stays aligned with reality',
  });

  return tasks;
}

/**
 * Generate tasks from scenario inputs
 */
function generateInputBasedTasks(inputs: ScenarioInput[], phases: RoadmapPhase[]): Omit<RoadmapTask, 'task_number'>[] {
  const tasks: Omit<RoadmapTask, 'task_number'>[] = [];

  // Analyze inputs for common patterns
  const hasTuition = inputs.some(i => i.field_name.toLowerCase().includes('tuition'));
  const hasScholarship = inputs.some(i => i.field_name.toLowerCase().includes('scholarship'));
  const hasLoan = inputs.some(i => i.field_name.toLowerCase().includes('loan'));
  const hasSalary = inputs.some(i => i.field_name.toLowerCase().includes('salary'));

  if (hasTuition) {
    tasks.push({
      phase_number: 1,
      title: 'Apply for scholarships and grants',
      description: 'Research and apply for all eligible scholarships to reduce tuition burden',
      category: 'education',
      priority: 'P0',
      status: 'todo',
      due_date: addDays(new Date(), 30).toISOString(),
      estimated_hours: 10,
      blocking_dependencies: null,
      confidence: 0.75,
      rationale: 'Reduces financial burden and improves goal probability',
    });
  }

  if (hasLoan) {
    const loanInput = inputs.find(i => i.field_name.toLowerCase().includes('loan'));
    tasks.push({
      phase_number: 2,
      title: 'Set up loan payment automation',
      description: `Automate minimum payments for ${loanInput?.field_name || 'loans'} to avoid penalties`,
      category: 'finance',
      priority: 'P0',
      status: 'todo',
      due_date: addDays(new Date(), 14).toISOString(),
      estimated_hours: 1,
      blocking_dependencies: null,
      confidence: 0.95,
      rationale: 'Prevents missed payments and credit damage',
    });
  }

  if (hasSalary) {
    tasks.push({
      phase_number: phases.length > 2 ? 3 : 2,
      title: 'Negotiate salary or raise',
      description: 'Research market rates and prepare negotiation strategy',
      category: 'career',
      priority: 'P1',
      status: 'todo',
      due_date: addMonths(new Date(), 3).toISOString(),
      estimated_hours: 8,
      blocking_dependencies: null,
      confidence: 0.6,
      rationale: 'Salary increase is a high-leverage driver for financial goals',
    });
  }

  return tasks;
}

/**
 * Generate tasks from simulation results (drivers & risks)
 */
function generateSimulationBasedTasks(
  simulationResults: NonNullable<GenerateRoadmapInput['simulationResults']>,
  phases: RoadmapPhase[]
): Omit<RoadmapTask, 'task_number'>[] {
  const tasks: Omit<RoadmapTask, 'task_number'>[] = [];

  for (const goal of simulationResults.goals) {
    // Convert top risks into mitigation tasks
    for (let i = 0; i < Math.min(2, goal.top_risks.length); i++) {
      const risk = goal.top_risks[i];
      tasks.push({
        phase_number: 2,
        title: `Mitigate risk: ${risk.factor}`,
        description: `Address ${risk.factor} which is a top risk factor for goal success`,
        category: 'ops',
        priority: 'P1',
        status: 'todo',
        due_date: addDays(new Date(), 21).toISOString(),
        estimated_hours: 4,
        blocking_dependencies: null,
        confidence: 0.7,
        rationale: `Top ${i + 1} risk factor with impact ${risk.impact.toFixed(2)}`,
      });
    }

    // Convert top drivers into reinforcement tasks
    for (let i = 0; i < Math.min(2, goal.top_drivers.length); i++) {
      const driver = goal.top_drivers[i];
      tasks.push({
        phase_number: phases.length > 2 ? 3 : 2,
        title: `Strengthen driver: ${driver.factor}`,
        description: `Optimize ${driver.factor} which is a key success driver`,
        category: 'ops',
        priority: 'P2',
        status: 'todo',
        due_date: addMonths(new Date(), 2).toISOString(),
        estimated_hours: 3,
        blocking_dependencies: null,
        confidence: 0.8,
        rationale: `Top ${i + 1} driver with impact ${driver.impact.toFixed(2)}`,
      });
    }
  }

  return tasks.slice(0, 6); // Cap simulation-derived tasks at 6
}

/**
 * Helper: Add months to date
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Helper: Add days to date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
