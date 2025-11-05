/**
 * Life Navigator - API Export
 *
 * Elite-level centralized API exports
 * NO MOCK DATA - All endpoints call real backend
 */

export { default as api } from './client';
export * as authApi from './auth';
export * as financeApi from './finance';
export * as healthcareApi from './healthcare';
export * as careerApi from './career';
export * as familyApi from './family';
export * as goalsApi from './goals';
export * as agentApi from './agent';

export default {
  auth: require('./auth').default,
  finance: require('./finance').default,
  healthcare: require('./healthcare').default,
  career: require('./career').default,
  family: require('./family').default,
  goals: require('./goals').default,
  agent: require('./agent').default,
};
