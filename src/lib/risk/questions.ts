/**
 * Risk Assessment Questions Library
 * Based on validated psychometric risk assessment methodologies
 */

import { RiskQuestion, RiskDomain } from './types';

/**
 * Financial Risk Questions
 */
export const FINANCIAL_RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'fin_scenario_1',
    domain: 'financial',
    type: 'scenario',
    responseType: 'single_choice',
    title: 'Investment Opportunity',
    scenario: 'You have $10,000 to invest. A friend offers you a business opportunity with these possible outcomes after 1 year:',
    options: [
      {
        id: 'a',
        label: 'Guaranteed $10,500',
        description: '5% return, no risk',
        value: 'guaranteed',
        riskScore: -75,
      },
      {
        id: 'b',
        label: '50% chance of $12,000 or $10,000',
        description: 'Moderate risk, moderate reward',
        value: 'moderate',
        riskScore: 0,
      },
      {
        id: 'c',
        label: '25% chance of $20,000 or $8,000',
        description: 'High risk, high reward',
        value: 'high_risk',
        riskScore: 50,
      },
      {
        id: 'd',
        label: '10% chance of $50,000 or $5,000',
        description: 'Very high risk, very high reward',
        value: 'very_high_risk',
        riskScore: 90,
      },
    ],
    weight: 1.0,
    category: 'pure_risk_tolerance',
    measuresTraits: ['conservative', 'moderate', 'aggressive'],
  },
  
  {
    id: 'fin_loss_1',
    domain: 'financial',
    type: 'loss_aversion',
    responseType: 'single_choice',
    title: 'Market Downturn',
    scenario: 'Your retirement portfolio worth $100,000 drops to $70,000 in a market crash. What do you do?',
    options: [
      {
        id: 'a',
        label: 'Sell everything immediately',
        description: 'Cut losses and move to cash',
        value: 'panic_sell',
        riskScore: -90,
      },
      {
        id: 'b',
        label: 'Sell half, keep half',
        description: 'Reduce exposure but stay partially invested',
        value: 'partial_sell',
        riskScore: -30,
      },
      {
        id: 'c',
        label: 'Hold and wait',
        description: 'Ride out the volatility',
        value: 'hold',
        riskScore: 20,
      },
      {
        id: 'd',
        label: 'Buy more at lower prices',
        description: 'See it as a buying opportunity',
        value: 'buy_more',
        riskScore: 80,
      },
    ],
    weight: 1.2,
    category: 'loss_aversion',
    measuresTraits: ['loss_sensitive', 'uncertainty_tolerant'],
  },
  
  {
    id: 'fin_time_1',
    domain: 'financial',
    type: 'time_horizon',
    responseType: 'single_choice',
    title: 'Bonus Decision',
    scenario: 'You receive a $5,000 bonus. Which option appeals most to you?',
    options: [
      {
        id: 'a',
        label: 'Spend it on something fun now',
        description: 'Immediate gratification',
        value: 'spend_now',
        riskScore: 40,
      },
      {
        id: 'b',
        label: 'Save for a vacation next year',
        description: 'Short-term saving',
        value: 'save_short',
        riskScore: -10,
      },
      {
        id: 'c',
        label: 'Invest for 5-10 years',
        description: 'Medium-term growth',
        value: 'invest_medium',
        riskScore: -40,
      },
      {
        id: 'd',
        label: 'Add to retirement (30+ years)',
        description: 'Long-term planning',
        value: 'retire_long',
        riskScore: -70,
      },
    ],
    weight: 0.8,
    category: 'time_preference',
    measuresTraits: ['planning_oriented', 'spontaneous'],
  },
  
  {
    id: 'fin_allocation_1',
    domain: 'financial',
    type: 'tradeoff',
    responseType: 'allocation',
    title: 'Portfolio Allocation',
    scenario: 'How would you allocate $100,000 across these investment options?',
    options: [
      {
        id: 'cash',
        label: 'Cash/Savings',
        description: 'No risk, low return',
        value: 'cash',
        riskScore: -100,
        allocationPercentage: 0,
      },
      {
        id: 'bonds',
        label: 'Bonds',
        description: 'Low risk, moderate return',
        value: 'bonds',
        riskScore: -40,
        allocationPercentage: 0,
      },
      {
        id: 'stocks',
        label: 'Stocks',
        description: 'Moderate risk, good return',
        value: 'stocks',
        riskScore: 30,
        allocationPercentage: 0,
      },
      {
        id: 'crypto',
        label: 'Cryptocurrency',
        description: 'High risk, high potential',
        value: 'crypto',
        riskScore: 90,
        allocationPercentage: 0,
      },
    ],
    weight: 1.1,
    category: 'pure_risk_tolerance',
    measuresTraits: ['conservative', 'aggressive'],
  },
];

/**
 * Career Risk Questions
 */
export const CAREER_RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'career_scenario_1',
    domain: 'career',
    type: 'scenario',
    responseType: 'single_choice',
    title: 'Job Opportunity',
    scenario: 'You receive two job offers. Your current job pays $80,000/year with good stability.',
    options: [
      {
        id: 'a',
        label: 'Stay at current job',
        description: 'Keep stability and known environment',
        value: 'stay',
        riskScore: -80,
      },
      {
        id: 'b',
        label: 'Established company: $90,000',
        description: '12% raise, similar stability',
        value: 'established',
        riskScore: -20,
      },
      {
        id: 'c',
        label: 'Growing startup: $85,000 + equity',
        description: 'Potential for growth, some risk',
        value: 'startup',
        riskScore: 40,
      },
      {
        id: 'd',
        label: 'Start your own business',
        description: 'Unlimited potential, high risk',
        value: 'entrepreneur',
        riskScore: 90,
      },
    ],
    weight: 1.0,
    category: 'pure_risk_tolerance',
    measuresTraits: ['conservative', 'aggressive', 'independent'],
  },
  
  {
    id: 'career_change_1',
    domain: 'career',
    type: 'tradeoff',
    responseType: 'single_choice',
    title: 'Career Pivot',
    scenario: 'At 35, you consider switching to a completely different career field that interests you more.',
    options: [
      {
        id: 'a',
        label: 'Too risky, stay in current field',
        description: 'Protect existing expertise',
        value: 'no_change',
        riskScore: -70,
      },
      {
        id: 'b',
        label: 'Gradual transition over 2-3 years',
        description: 'Minimize risk with slow change',
        value: 'gradual',
        riskScore: -10,
      },
      {
        id: 'c',
        label: 'Take 6 months off to retrain',
        description: 'Invest in education',
        value: 'retrain',
        riskScore: 30,
      },
      {
        id: 'd',
        label: 'Quit immediately and figure it out',
        description: 'Jump in with both feet',
        value: 'immediate',
        riskScore: 85,
      },
    ],
    weight: 0.9,
    category: 'ambiguity_aversion',
    measuresTraits: ['uncertainty_tolerant', 'planning_oriented'],
  },
];

/**
 * Health Risk Questions
 */
export const HEALTH_RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'health_scenario_1',
    domain: 'health',
    type: 'scenario',
    responseType: 'single_choice',
    title: 'Medical Treatment',
    scenario: 'You have a non-life-threatening condition with these treatment options:',
    options: [
      {
        id: 'a',
        label: 'Conservative management',
        description: 'Lifestyle changes only, slow improvement',
        value: 'conservative',
        riskScore: -60,
      },
      {
        id: 'b',
        label: 'Standard medication',
        description: 'Proven treatment, minor side effects',
        value: 'standard',
        riskScore: 0,
      },
      {
        id: 'c',
        label: 'New treatment',
        description: 'Better results, less studied',
        value: 'new',
        riskScore: 40,
      },
      {
        id: 'd',
        label: 'Experimental therapy',
        description: 'Cutting edge, unknown risks',
        value: 'experimental',
        riskScore: 80,
      },
    ],
    weight: 0.9,
    category: 'pure_risk_tolerance',
    measuresTraits: ['conservative', 'gain_seeking'],
  },
  
  {
    id: 'health_prevention_1',
    domain: 'health',
    type: 'tradeoff',
    responseType: 'single_choice',
    title: 'Preventive Care',
    scenario: 'How much would you invest annually in preventive health measures?',
    options: [
      {
        id: 'a',
        label: 'Minimum - Basic checkups only',
        description: '$200-500/year',
        value: 'minimum',
        riskScore: 50,
      },
      {
        id: 'b',
        label: 'Moderate - Regular screenings',
        description: '$500-1500/year',
        value: 'moderate',
        riskScore: 0,
      },
      {
        id: 'c',
        label: 'Comprehensive - Full health optimization',
        description: '$1500-5000/year',
        value: 'comprehensive',
        riskScore: -40,
      },
      {
        id: 'd',
        label: 'Maximum - Cutting-edge prevention',
        description: '$5000+/year',
        value: 'maximum',
        riskScore: -70,
      },
    ],
    weight: 0.8,
    category: 'time_preference',
    measuresTraits: ['planning_oriented', 'loss_sensitive'],
  },
];

/**
 * Social Risk Questions
 */
export const SOCIAL_RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'social_scenario_1',
    domain: 'social',
    type: 'scenario',
    responseType: 'single_choice',
    title: 'Social Situation',
    scenario: 'At a professional conference where you know nobody:',
    options: [
      {
        id: 'a',
        label: 'Stay quiet, observe',
        description: 'Minimal interaction',
        value: 'observe',
        riskScore: -70,
      },
      {
        id: 'b',
        label: 'Talk to a few people',
        description: 'Selective networking',
        value: 'selective',
        riskScore: -10,
      },
      {
        id: 'c',
        label: 'Actively network',
        description: 'Meet many people',
        value: 'active',
        riskScore: 30,
      },
      {
        id: 'd',
        label: 'Give impromptu presentation',
        description: 'Maximum visibility',
        value: 'present',
        riskScore: 85,
      },
    ],
    weight: 0.7,
    category: 'social_risk',
    measuresTraits: ['peer_influenced', 'independent'],
  },
];

/**
 * General Risk Questions
 */
export const GENERAL_RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'general_regret_1',
    domain: 'general',
    type: 'regret',
    responseType: 'single_choice',
    title: 'Life Regrets',
    scenario: 'Looking back on your life, what would you regret more?',
    options: [
      {
        id: 'a',
        label: 'Taking risks that didn\'t work out',
        description: 'Failure from trying',
        value: 'action_regret',
        riskScore: -60,
      },
      {
        id: 'b',
        label: 'Not taking risks when you could have',
        description: 'Missing opportunities',
        value: 'inaction_regret',
        riskScore: 60,
      },
    ],
    weight: 1.0,
    category: 'regret_aversion',
    measuresTraits: ['conservative', 'aggressive'],
  },
  
  {
    id: 'general_probability_1',
    domain: 'general',
    type: 'probability',
    responseType: 'single_choice',
    title: 'Probability Preference',
    scenario: 'You must choose between two options:',
    options: [
      {
        id: 'a',
        label: '100% chance of winning $3,000',
        description: 'Guaranteed outcome',
        value: 'certain',
        riskScore: -80,
      },
      {
        id: 'b',
        label: '80% chance of winning $4,000',
        description: 'Higher expected value',
        value: 'probable',
        riskScore: 0,
      },
      {
        id: 'c',
        label: '50% chance of winning $7,000',
        description: 'High risk, high reward',
        value: 'gamble',
        riskScore: 50,
      },
      {
        id: 'd',
        label: '20% chance of winning $20,000',
        description: 'Lottery-like odds',
        value: 'lottery',
        riskScore: 90,
      },
    ],
    weight: 0.9,
    category: 'pure_risk_tolerance',
    measuresTraits: ['conservative', 'gain_seeking'],
  },
];

/**
 * Combine all questions for complete assessment
 */
export const ALL_RISK_QUESTIONS: RiskQuestion[] = [
  ...FINANCIAL_RISK_QUESTIONS,
  ...CAREER_RISK_QUESTIONS,
  ...HEALTH_RISK_QUESTIONS,
  ...SOCIAL_RISK_QUESTIONS,
  ...GENERAL_RISK_QUESTIONS,
];

/**
 * Get adaptive question path based on user profile
 */
export function getAdaptiveQuestions(
  domain?: RiskDomain,
  quickAssessment: boolean = false
): RiskQuestion[] {
  let questions: RiskQuestion[] = [];
  
  if (domain) {
    // Domain-specific assessment
    switch (domain) {
      case 'financial':
        questions = FINANCIAL_RISK_QUESTIONS;
        break;
      case 'career':
        questions = CAREER_RISK_QUESTIONS;
        break;
      case 'health':
        questions = HEALTH_RISK_QUESTIONS;
        break;
      case 'social':
        questions = SOCIAL_RISK_QUESTIONS;
        break;
      default:
        questions = GENERAL_RISK_QUESTIONS;
    }
  } else {
    // Comprehensive assessment
    if (quickAssessment) {
      // Select 2 questions from each domain for quick assessment
      questions = [
        ...FINANCIAL_RISK_QUESTIONS.slice(0, 2),
        ...CAREER_RISK_QUESTIONS.slice(0, 1),
        ...HEALTH_RISK_QUESTIONS.slice(0, 1),
        ...GENERAL_RISK_QUESTIONS.slice(0, 2),
      ];
    } else {
      questions = ALL_RISK_QUESTIONS;
    }
  }
  
  return questions;
}

/**
 * Get follow-up questions based on responses
 */
export function getFollowUpQuestions(
  responses: Record<string, any>,
  answeredQuestions: string[]
): RiskQuestion[] {
  const followUps: RiskQuestion[] = [];
  
  // Example: If user shows high financial risk tolerance, add more nuanced questions
  const finScenarioResponse = responses['fin_scenario_1'];
  if (finScenarioResponse?.riskScore > 50 && !answeredQuestions.includes('fin_advanced_1')) {
    // Add advanced financial risk questions (would be defined elsewhere)
  }
  
  return followUps;
}