/**
 * Roadmap Generator Tests
 *
 * Tests for deterministic correctness:
 * - Same inputs → same phases/tasks
 * - Emergency + insurance tasks always included
 * - Max task cap enforced
 */

import { generateRoadmap, type GenerateRoadmapInput } from '../generator';
import type { ScenarioInput } from '../../types';

describe('Roadmap Generator', () => {
  describe('generateRoadmap', () => {
    it('should produce same roadmap for same inputs (deterministic)', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'tuition',
            field_value: '20000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'scholarship',
            field_value: '5000',
            confidence: 0.7,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap1 = generateRoadmap(input);
      const roadmap2 = generateRoadmap(input);

      expect(roadmap1.phases.length).toBe(roadmap2.phases.length);
      expect(roadmap1.tasks.length).toBe(roadmap2.tasks.length);

      // Verify phase names are identical
      roadmap1.phases.forEach((phase, idx) => {
        expect(phase.name).toBe(roadmap2.phases[idx].name);
        expect(phase.phase_number).toBe(roadmap2.phases[idx].phase_number);
      });

      // Verify task titles are identical
      roadmap1.tasks.forEach((task, idx) => {
        expect(task.title).toBe(roadmap2.tasks[idx].title);
        expect(task.phase_number).toBe(roadmap2.tasks[idx].phase_number);
      });
    });

    it('should always include emergency fund task', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const emergencyTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('emergency fund')
      );

      expect(emergencyTask).toBeDefined();
      expect(emergencyTask?.priority).toBe('P0');
      expect(emergencyTask?.phase_number).toBe(1);
    });

    it('should always include insurance review task', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const insuranceTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('insurance')
      );

      expect(insuranceTask).toBeDefined();
      expect(insuranceTask?.priority).toBe('P1');
      expect(insuranceTask?.phase_number).toBe(1);
    });

    it('should always include monthly review task in last phase', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const reviewTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('monthly progress')
      );

      const lastPhase = Math.max(...roadmap.phases.map(p => p.phase_number));

      expect(reviewTask).toBeDefined();
      expect(reviewTask?.phase_number).toBe(lastPhase);
      expect(reviewTask?.category).toBe('ops');
    });
  });

  describe('Path Detection', () => {
    it('should detect education path from tuition inputs', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'College Path',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'tuition',
            field_value: '20000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'fees',
            field_value: '2000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      // Education path has 5 phases
      expect(roadmap.phases.length).toBe(5);
      expect(roadmap.phases[0].name).toBe('Admissions & Funding');
      expect(roadmap.phases[4].name).toBe('Graduation & Transition');
    });

    it('should detect career path from salary inputs', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Career Path',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '80000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'bonus',
            field_value: '10000',
            confidence: 0.7,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      // Career path has 4 phases
      expect(roadmap.phases.length).toBe(4);
      expect(roadmap.phases[0].name).toBe('Skills Gap Analysis');
      expect(roadmap.phases[3].name).toBe('Interview & Negotiation');
    });

    it('should detect financial path from loan/mortgage inputs', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Financial Path',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'loan_principal',
            field_value: '50000',
            confidence: 0.95,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'monthly_payment',
            field_value: '500',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      // Financial path has 4 phases
      expect(roadmap.phases.length).toBe(4);
      expect(roadmap.phases[0].name).toBe('Baseline & Budget');
      expect(roadmap.phases[2].name).toBe('Insurance & Risk Management');
    });

    it('should use mixed path for ambiguous inputs', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Mixed Path',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'custom_field',
            field_value: '10000',
            confidence: 0.8,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      // Mixed path has 3 generic phases
      expect(roadmap.phases.length).toBe(3);
      expect(roadmap.phases[0].name).toBe('Foundation');
      expect(roadmap.phases[1].name).toBe('Execution');
      expect(roadmap.phases[2].name).toBe('Optimization');
    });
  });

  describe('Simulation-Based Task Generation', () => {
    it('should generate risk mitigation tasks from simulation results', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
        simulationResults: {
          goals: [
            {
              goal_id: 'g1',
              top_drivers: [],
              top_risks: [
                { factor: 'job_security', impact: 0.8 },
                { factor: 'market_volatility', impact: 0.6 },
              ],
            },
          ],
        },
      };

      const roadmap = generateRoadmap(input);

      const riskTasks = roadmap.tasks.filter(t =>
        t.title.toLowerCase().includes('mitigate risk')
      );

      expect(riskTasks.length).toBeGreaterThan(0);
      expect(riskTasks.some(t => t.title.includes('job_security'))).toBe(true);
    });

    it('should generate driver strengthening tasks from simulation results', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
        simulationResults: {
          goals: [
            {
              goal_id: 'g1',
              top_drivers: [
                { factor: 'skills', impact: 0.9 },
                { factor: 'experience', impact: 0.7 },
              ],
              top_risks: [],
            },
          ],
        },
      };

      const roadmap = generateRoadmap(input);

      const driverTasks = roadmap.tasks.filter(t =>
        t.title.toLowerCase().includes('strengthen driver')
      );

      expect(driverTasks.length).toBeGreaterThan(0);
      expect(driverTasks.some(t => t.title.includes('skills'))).toBe(true);
    });

    it('should cap simulation-derived tasks at 6', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
        simulationResults: {
          goals: [
            {
              goal_id: 'g1',
              top_drivers: [
                { factor: 'd1', impact: 0.9 },
                { factor: 'd2', impact: 0.8 },
                { factor: 'd3', impact: 0.7 },
                { factor: 'd4', impact: 0.6 },
              ],
              top_risks: [
                { factor: 'r1', impact: 0.9 },
                { factor: 'r2', impact: 0.8 },
                { factor: 'r3', impact: 0.7 },
                { factor: 'r4', impact: 0.6 },
              ],
            },
          ],
        },
      };

      const roadmap = generateRoadmap(input);

      const simTasks = roadmap.tasks.filter(
        t =>
          t.title.toLowerCase().includes('mitigate risk') ||
          t.title.toLowerCase().includes('strengthen driver')
      );

      // Should be capped at 6
      expect(simTasks.length).toBeLessThanOrEqual(6);
    });
  });

  describe('Input-Based Task Generation', () => {
    it('should generate scholarship task when tuition is present', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'tuition',
            field_value: '20000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const scholarshipTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('scholarship')
      );

      expect(scholarshipTask).toBeDefined();
      expect(scholarshipTask?.priority).toBe('P0');
      expect(scholarshipTask?.category).toBe('education');
    });

    it('should generate loan automation task when loan is present', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'student_loan',
            field_value: '30000',
            confidence: 0.95,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const loanTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('loan payment')
      );

      expect(loanTask).toBeDefined();
      expect(loanTask?.priority).toBe('P0');
      expect(loanTask?.category).toBe('finance');
    });

    it('should generate salary negotiation task when salary is present', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '60000',
            confidence: 0.8,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const salaryTask = roadmap.tasks.find(t =>
        t.title.toLowerCase().includes('salary') ||
        t.title.toLowerCase().includes('negotiate')
      );

      expect(salaryTask).toBeDefined();
      expect(salaryTask?.category).toBe('career');
    });
  });

  describe('Task Structure Validation', () => {
    it('should assign sequential task numbers', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const taskNumbers = roadmap.tasks.map(t => t.task_number);

      // Verify sequential ordering
      for (let i = 0; i < taskNumbers.length - 1; i++) {
        expect(taskNumbers[i + 1]).toBe(taskNumbers[i] + 1);
      }

      // Verify starts at 1
      expect(taskNumbers[0]).toBe(1);
    });

    it('should have valid phase numbers for all tasks', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      const validPhaseNumbers = roadmap.phases.map(p => p.phase_number);

      roadmap.tasks.forEach(task => {
        expect(validPhaseNumbers).toContain(task.phase_number);
      });
    });

    it('should have required fields for all tasks', () => {
      const input: GenerateRoadmapInput = {
        scenarioName: 'Test Scenario',
        inputs: [
          {
            id: '1',
            version_id: 'v1',
            goal_id: 'g1',
            field_name: 'salary',
            field_value: '50000',
            confidence: 0.9,
            created_at: '2024-01-01',
          },
        ] as ScenarioInput[],
      };

      const roadmap = generateRoadmap(input);

      roadmap.tasks.forEach(task => {
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.category).toMatch(/^(education|career|finance|health|ops)$/);
        expect(task.priority).toMatch(/^(P0|P1|P2)$/);
        expect(task.status).toMatch(/^(todo|in_progress|done|blocked)$/);
      });
    });
  });
});
