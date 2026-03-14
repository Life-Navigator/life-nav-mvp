/**
 * Monte Carlo Simulation Engine
 *
 * Runs probabilistic simulations to calculate goal success probabilities
 * Provides explainable outputs (top drivers, risks, confidence bands)
 */

import { supabaseAdmin } from '../supabase-client';
import type {
  ScenarioInput,
  SimulatorConfig as SimulationConfig,
  SimulatorResult as SimulationResult,
} from '../types';

// Seeded random number generator (for reproducibility)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  // Normal distribution (Box-Muller transform)
  normal(mean: number, stdDev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  // Uniform distribution
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Run Monte Carlo simulation for a scenario version
 */
export async function runSimulation(
  versionId: string,
  config: SimulationConfig
): Promise<SimulationResult> {
  const startTime = Date.now();

  // Fetch inputs
  const { data: inputs, error: inputsError } = await (supabaseAdmin as any)
    .from('scenario_inputs')
    .select('*')
    .eq('version_id', versionId);

  if (inputsError || !inputs) {
    throw new Error(`Failed to fetch inputs: ${inputsError?.message}`);
  }

  if (inputs.length === 0) {
    throw new Error('No inputs found for simulation');
  }

  // Group inputs by goal_id
  const inputsByGoal = groupInputsByGoal(inputs as ScenarioInput[]);

  // Run simulations for each goal
  const goalResults = [];

  for (const [goalId, goalInputs] of Object.entries(inputsByGoal)) {
    const result = await simulateGoal(goalId, goalInputs, config);
    goalResults.push(result);
  }

  const duration = Date.now() - startTime;

  return {
    version_id: versionId,
    iterations: config.iterations,
    seed: config.seed,
    model_version: '1.0',
    duration_ms: duration,
    goals: goalResults,
  };
}

/**
 * Simulate a single goal
 */
async function simulateGoal(goalId: string, inputs: ScenarioInput[], config: SimulationConfig) {
  const rng = new SeededRandom(config.seed + parseInt(goalId.slice(-8), 16));
  const iterations = config.iterations;

  // Parse inputs into variables
  const variables: Record<string, number> = {};
  for (const input of inputs) {
    const value = parseFloat(String(input.field_value));
    if (!isNaN(value)) {
      variables[String(input.field_name)] = value;
    }
  }

  // Run iterations
  const successCounts: number[] = [];
  const iterationResults: Array<{ success: boolean; value: number }> = [];

  for (let i = 0; i < iterations; i++) {
    // Sample from distributions
    const sampledVars: Record<string, number> = {};

    for (const [key, value] of Object.entries(variables)) {
      // Apply uncertainty (assume ±10% normal distribution)
      const stdDev = value * 0.1;
      sampledVars[key] = rng.normal(value, stdDev);
    }

    // Simple goal success logic (placeholder - can be enhanced)
    const goalValue = calculateGoalValue(sampledVars);
    const success = goalValue >= (variables.target || 0);

    iterationResults.push({ success, value: goalValue });
    successCounts.push(success ? 1 : 0);
  }

  // Calculate probability
  const successRate = successCounts.reduce((a, b) => a + b, 0) / iterations;

  // Calculate percentiles
  const sortedValues = iterationResults.map((r) => r.value).sort((a, b) => a - b);
  const p10 = sortedValues[Math.floor(iterations * 0.1)];
  const p50 = sortedValues[Math.floor(iterations * 0.5)];
  const p90 = sortedValues[Math.floor(iterations * 0.9)];

  // Identify top drivers and risks (sensitivity analysis)
  const { drivers, risks } = identifyDriversAndRisks(inputs, variables);

  // Classify status
  const status = classifyStatus(successRate);

  return {
    goal_id: goalId,
    probability: successRate,
    p10,
    p50,
    p90,
    status,
    top_drivers: drivers.slice(0, 3),
    top_risks: risks.slice(0, 3),
  };
}

/**
 * Calculate goal value (simplified logic)
 * In production, this would use actual goal formulas
 */
function calculateGoalValue(variables: Record<string, number>): number {
  // Placeholder: Sum of all positive variables
  // Real implementation would use goal-specific formulas
  let total = 0;
  for (const [key, value] of Object.entries(variables)) {
    if (key !== 'target' && value > 0) {
      total += value;
    }
  }
  return total;
}

/**
 * Identify top drivers (positive factors) and risks (negative factors)
 */
function identifyDriversAndRisks(inputs: ScenarioInput[], variables: Record<string, number>) {
  const factors = inputs.map((input) => {
    const value = parseFloat(String(input.field_value));
    const confidence = input.confidence || 1.0;

    // Simple impact score (higher value * confidence = stronger driver)
    const impact = Math.abs(value) * confidence;

    return {
      field_name: input.field_name,
      impact,
      is_positive: value > 0,
    };
  });

  // Sort by impact
  factors.sort((a, b) => b.impact - a.impact);

  const drivers = factors
    .filter((f) => f.is_positive)
    .map((f) => ({ factor: f.field_name, impact: f.impact }));

  const risks = factors
    .filter((f) => !f.is_positive)
    .map((f) => ({ factor: f.field_name, impact: f.impact }));

  return { drivers, risks };
}

/**
 * Classify goal status based on probability
 */
function classifyStatus(probability: number): string {
  if (probability >= 0.8) return 'ahead';
  if (probability >= 0.6) return 'on_track';
  if (probability >= 0.4) return 'behind';
  return 'at_risk';
}

/**
 * Group inputs by goal_id
 */
function groupInputsByGoal(inputs: ScenarioInput[]): Record<string, ScenarioInput[]> {
  const grouped: Record<string, ScenarioInput[]> = {};

  for (const input of inputs) {
    if (!grouped[input.goal_id]) {
      grouped[input.goal_id] = [];
    }
    grouped[input.goal_id].push(input);
  }

  return grouped;
}

/**
 * Calculate inputs hash for reproducibility tracking
 */
export function calculateInputsHash(inputs: ScenarioInput[]): string {
  // Simple hash: concatenate all field values and hash
  const inputString = inputs
    .sort((a, b) => a.field_name.localeCompare(b.field_name))
    .map((i) => `${i.field_name}:${i.field_value}`)
    .join('|');

  // Simple hash function (for production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < inputString.length; i++) {
    const char = inputString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}
