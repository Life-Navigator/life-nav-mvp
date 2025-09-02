/**
 * McKinsey-Style Consolidated Benefit Driver Tags
 * MECE (Mutually Exclusive, Collectively Exhaustive) principle applied
 * Used by multi-agent system to understand user motivations
 */

export type BenefitCategory = 'security' | 'growth' | 'impact' | 'control' | 'achievement' | 'purpose' | 'flexibility' | 'prevention' | 'management' | 'lifestyle' | 'access';
export type Domain = 'financial' | 'career' | 'health' | 'education' | 'lifestyle';

export interface BenefitTag {
  id: string;
  domain: Domain;
  category: BenefitCategory;
  title: string;
  description: string;
  emoji: string;
  psychologicalDrivers: string[]; // Underlying psychological needs this addresses
  commonGoals: string[]; // Example goals that map to this driver
}

/**
 * Financial Domain Drivers (12 total)
 */
export const FINANCIAL_BENEFIT_TAGS: BenefitTag[] = [
  // Security Drivers (3)
  {
    id: 'fin-protection',
    domain: 'financial',
    category: 'security',
    title: 'Protection',
    description: 'Emergency fund, insurance, debt elimination',
    emoji: '🛡️',
    psychologicalDrivers: ['safety', 'control', 'peace of mind'],
    commonGoals: ['Build emergency fund', 'Get adequate insurance', 'Pay off debt']
  },
  {
    id: 'fin-stability',
    domain: 'financial',
    category: 'security',
    title: 'Stability',
    description: 'Predictable income, cash flow, basic needs',
    emoji: '🏠',
    psychologicalDrivers: ['certainty', 'routine', 'foundation'],
    commonGoals: ['Stable job', 'Monthly budget', 'Fixed expenses']
  },
  {
    id: 'fin-risk-mitigation',
    domain: 'financial',
    category: 'security',
    title: 'Risk Mitigation',
    description: 'Diversification, hedging, contingency planning',
    emoji: '⚖️',
    psychologicalDrivers: ['caution', 'preparedness', 'resilience'],
    commonGoals: ['Diversify investments', 'Multiple income streams', 'Backup plans']
  },
  
  // Growth Drivers (3)
  {
    id: 'fin-wealth-building',
    domain: 'financial',
    category: 'growth',
    title: 'Wealth Building',
    description: 'Investment returns, asset accumulation, compound growth',
    emoji: '📈',
    psychologicalDrivers: ['achievement', 'progress', 'abundance'],
    commonGoals: ['Invest in stocks', 'Real estate', 'Business ownership']
  },
  {
    id: 'fin-income-optimization',
    domain: 'financial',
    category: 'growth',
    title: 'Income Optimization',
    description: 'Multiple streams, passive income, tax efficiency',
    emoji: '💰',
    psychologicalDrivers: ['maximization', 'efficiency', 'leverage'],
    commonGoals: ['Side business', 'Dividend income', 'Tax strategies']
  },
  {
    id: 'fin-independence',
    domain: 'financial',
    category: 'growth',
    title: 'Financial Independence',
    description: 'Early retirement, F.I.R.E., self-sufficiency',
    emoji: '🎯',
    psychologicalDrivers: ['freedom', 'autonomy', 'self-reliance'],
    commonGoals: ['Retire early', 'Financial freedom', 'No debt']
  },
  
  // Impact Drivers (3)
  {
    id: 'fin-family-legacy',
    domain: 'financial',
    category: 'impact',
    title: 'Family Legacy',
    description: 'Generational wealth, education funding, inheritance',
    emoji: '👨‍👩‍👧‍👦',
    psychologicalDrivers: ['nurturing', 'providing', 'continuity'],
    commonGoals: ['College funds', 'Trust funds', 'Family business']
  },
  {
    id: 'fin-lifestyle-design',
    domain: 'financial',
    category: 'impact',
    title: 'Lifestyle Design',
    description: 'Dream purchases, experiences, geographic freedom',
    emoji: '✈️',
    psychologicalDrivers: ['enjoyment', 'experience', 'fulfillment'],
    commonGoals: ['Travel fund', 'Dream home', 'Hobbies']
  },
  {
    id: 'fin-social-contribution',
    domain: 'financial',
    category: 'impact',
    title: 'Social Contribution',
    description: 'Philanthropy, impact investing, community support',
    emoji: '🤝',
    psychologicalDrivers: ['purpose', 'giving', 'meaning'],
    commonGoals: ['Charity giving', 'Social ventures', 'Community projects']
  },
  
  // Control Drivers (3)
  {
    id: 'fin-autonomy',
    domain: 'financial',
    category: 'control',
    title: 'Autonomy',
    description: 'No boss, own schedule, decision authority',
    emoji: '🗽',
    psychologicalDrivers: ['independence', 'self-direction', 'sovereignty'],
    commonGoals: ['Start business', 'Freelance', 'Investments']
  },
  {
    id: 'fin-optionality',
    domain: 'financial',
    category: 'control',
    title: 'Optionality',
    description: 'Career flexibility, pivot ability, safety net',
    emoji: '🔄',
    psychologicalDrivers: ['flexibility', 'adaptability', 'choice'],
    commonGoals: ['F-you money', 'Career change fund', 'Sabbatical']
  },
  {
    id: 'fin-power',
    domain: 'financial',
    category: 'control',
    title: 'Power',
    description: 'Influence, access, negotiating leverage',
    emoji: '💪',
    psychologicalDrivers: ['status', 'influence', 'respect'],
    commonGoals: ['High net worth', 'Board positions', 'Angel investing']
  }
];

/**
 * Career Domain Drivers (10 total)
 */
export const CAREER_BENEFIT_TAGS: BenefitTag[] = [
  // Achievement Drivers (3)
  {
    id: 'car-mastery',
    domain: 'career',
    category: 'achievement',
    title: 'Mastery',
    description: 'Expert status, skill development, continuous learning',
    emoji: '🎓',
    psychologicalDrivers: ['competence', 'expertise', 'growth'],
    commonGoals: ['Certifications', 'Advanced degree', 'Skill mastery']
  },
  {
    id: 'car-performance',
    domain: 'career',
    category: 'achievement',
    title: 'Performance',
    description: 'High achievement, recognition, measurable impact',
    emoji: '🏆',
    psychologicalDrivers: ['excellence', 'validation', 'accomplishment'],
    commonGoals: ['Top performer', 'Awards', 'Promotions']
  },
  {
    id: 'car-advancement',
    domain: 'career',
    category: 'achievement',
    title: 'Advancement',
    description: 'Rapid promotion, leadership roles, expanded scope',
    emoji: '📊',
    psychologicalDrivers: ['ambition', 'progress', 'leadership'],
    commonGoals: ['Executive role', 'Team lead', 'Department head']
  },
  
  // Security Drivers (2)
  {
    id: 'car-stability',
    domain: 'career',
    category: 'security',
    title: 'Stability',
    description: 'Job security, industry resilience, skill relevance',
    emoji: '🔒',
    psychologicalDrivers: ['safety', 'predictability', 'consistency'],
    commonGoals: ['Permanent role', 'Union job', 'Government position']
  },
  {
    id: 'car-compensation',
    domain: 'career',
    category: 'security',
    title: 'Compensation',
    description: 'Salary growth, benefits, long-term incentives',
    emoji: '💵',
    psychologicalDrivers: ['security', 'value', 'worth'],
    commonGoals: ['Six figures', 'Stock options', 'Full benefits']
  },
  
  // Purpose Drivers (3)
  {
    id: 'car-mission',
    domain: 'career',
    category: 'purpose',
    title: 'Mission Alignment',
    description: 'Values fit, meaningful work, social impact',
    emoji: '🎯',
    psychologicalDrivers: ['meaning', 'alignment', 'contribution'],
    commonGoals: ['Non-profit work', 'Social enterprise', 'Mission-driven company']
  },
  {
    id: 'car-innovation',
    domain: 'career',
    category: 'purpose',
    title: 'Innovation',
    description: 'Cutting-edge work, problem solving, creative freedom',
    emoji: '💡',
    psychologicalDrivers: ['creativity', 'discovery', 'pioneering'],
    commonGoals: ['R&D role', 'Startup', 'Innovation lab']
  },
  {
    id: 'car-influence',
    domain: 'career',
    category: 'purpose',
    title: 'Influence',
    description: 'Thought leadership, mentorship, industry shaping',
    emoji: '🗣️',
    psychologicalDrivers: ['impact', 'legacy', 'guidance'],
    commonGoals: ['Speaking engagements', 'Published author', 'Industry expert']
  },
  
  // Flexibility Drivers (2)
  {
    id: 'car-work-life',
    domain: 'career',
    category: 'flexibility',
    title: 'Work-Life Integration',
    description: 'Remote options, schedule control, time autonomy',
    emoji: '⚖️',
    psychologicalDrivers: ['balance', 'harmony', 'wellness'],
    commonGoals: ['Remote work', 'Flexible hours', '4-day week']
  },
  {
    id: 'car-optionality',
    domain: 'career',
    category: 'flexibility',
    title: 'Growth Optionality',
    description: 'Career pivots, side projects, entrepreneurship',
    emoji: '🚀',
    psychologicalDrivers: ['exploration', 'variety', 'independence'],
    commonGoals: ['Consulting', 'Side business', 'Portfolio career']
  }
];

/**
 * Health Domain Drivers (8 total)
 */
export const HEALTH_BENEFIT_TAGS: BenefitTag[] = [
  // Prevention Drivers (2)
  {
    id: 'hea-longevity',
    domain: 'health',
    category: 'prevention',
    title: 'Longevity',
    description: 'Lifespan, healthspan, disease prevention',
    emoji: '🌱',
    psychologicalDrivers: ['survival', 'vitality', 'future'],
    commonGoals: ['Regular checkups', 'Preventive care', 'Health screening']
  },
  {
    id: 'hea-optimization',
    domain: 'health',
    category: 'prevention',
    title: 'Optimization',
    description: 'Peak performance, energy, cognitive function',
    emoji: '⚡',
    psychologicalDrivers: ['excellence', 'capability', 'sharpness'],
    commonGoals: ['Biohacking', 'Supplements', 'Performance training']
  },
  
  // Management Drivers (2)
  {
    id: 'hea-condition',
    domain: 'health',
    category: 'management',
    title: 'Condition Control',
    description: 'Chronic disease, symptoms, medication',
    emoji: '💊',
    psychologicalDrivers: ['control', 'stability', 'normalcy'],
    commonGoals: ['Treatment plan', 'Medication adherence', 'Symptom tracking']
  },
  {
    id: 'hea-recovery',
    domain: 'health',
    category: 'management',
    title: 'Recovery',
    description: 'Healing, rehabilitation, resilience',
    emoji: '🔄',
    psychologicalDrivers: ['restoration', 'comeback', 'strength'],
    commonGoals: ['Physical therapy', 'Surgery recovery', 'Mental health']
  },
  
  // Lifestyle Drivers (2)
  {
    id: 'hea-vitality',
    domain: 'health',
    category: 'lifestyle',
    title: 'Physical Vitality',
    description: 'Fitness, strength, appearance',
    emoji: '💪',
    psychologicalDrivers: ['confidence', 'attractiveness', 'capability'],
    commonGoals: ['Gym membership', 'Weight loss', 'Marathon training']
  },
  {
    id: 'hea-wellness',
    domain: 'health',
    category: 'lifestyle',
    title: 'Mental Wellness',
    description: 'Stress management, emotional balance, sleep',
    emoji: '🧠',
    psychologicalDrivers: ['peace', 'clarity', 'balance'],
    commonGoals: ['Meditation', 'Therapy', 'Work-life balance']
  },
  
  // Access Drivers (2)
  {
    id: 'hea-quality',
    domain: 'health',
    category: 'access',
    title: 'Care Quality',
    description: 'Best providers, latest treatments, second opinions',
    emoji: '🏥',
    psychologicalDrivers: ['best-in-class', 'expertise', 'trust'],
    commonGoals: ['Specialist access', 'Top hospitals', 'Concierge medicine']
  },
  {
    id: 'hea-control',
    domain: 'health',
    category: 'access',
    title: 'Care Control',
    description: 'Choice, privacy, decision autonomy',
    emoji: '🔐',
    psychologicalDrivers: ['autonomy', 'privacy', 'agency'],
    commonGoals: ['Health savings', 'Private insurance', 'Medical decisions']
  }
];

/**
 * Combined all domains
 */
export const ALL_BENEFIT_TAGS = [
  ...FINANCIAL_BENEFIT_TAGS,
  ...CAREER_BENEFIT_TAGS,
  ...HEALTH_BENEFIT_TAGS
];

/**
 * Helper functions for benefit analysis
 */
export function getBenefitsByDomain(domain: Domain): BenefitTag[] {
  return ALL_BENEFIT_TAGS.filter(tag => tag.domain === domain);
}

export function getBenefitsByCategory(category: BenefitCategory): BenefitTag[] {
  return ALL_BENEFIT_TAGS.filter(tag => tag.category === category);
}

export function getBenefitById(id: string): BenefitTag | undefined {
  return ALL_BENEFIT_TAGS.find(tag => tag.id === id);
}

/**
 * Category colors for UI
 */
export const CATEGORY_COLORS: Record<BenefitCategory, string> = {
  security: 'bg-blue-100 border-blue-300 text-blue-900',
  growth: 'bg-green-100 border-green-300 text-green-900',
  impact: 'bg-purple-100 border-purple-300 text-purple-900',
  control: 'bg-orange-100 border-orange-300 text-orange-900',
  achievement: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  purpose: 'bg-indigo-100 border-indigo-300 text-indigo-900',
  flexibility: 'bg-teal-100 border-teal-300 text-teal-900',
  prevention: 'bg-red-100 border-red-300 text-red-900',
  management: 'bg-gray-100 border-gray-300 text-gray-900',
  lifestyle: 'bg-pink-100 border-pink-300 text-pink-900',
  access: 'bg-cyan-100 border-cyan-300 text-cyan-900'
};

/**
 * Domain colors for UI
 */
export const DOMAIN_COLORS: Record<Domain, string> = {
  financial: 'bg-green-500',
  career: 'bg-blue-500',
  health: 'bg-red-500',
  education: 'bg-purple-500',
  lifestyle: 'bg-yellow-500'
};