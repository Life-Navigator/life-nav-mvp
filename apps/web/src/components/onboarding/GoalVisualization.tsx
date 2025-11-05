'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Goal {
  id: string;
  domain: 'financial' | 'career' | 'education' | 'health';
  title: string;
  description: string;
  icon: string;
  timeframe: 'short' | 'medium' | 'long';
}

interface GoalVisualizationProps {
  onComplete: (priorities: Record<string, number>) => void;
  onBack: () => void;
  persona: string;
}

export default function GoalVisualization({ onComplete, onBack, persona }: GoalVisualizationProps) {
  // Sample goals based on persona
  const getGoalsByPersona = (persona: string): Goal[] => {
    const commonGoals: Goal[] = [
      {
        id: 'emergency_fund',
        domain: 'financial',
        title: 'Build Emergency Fund',
        description: 'Save 3-6 months of expenses for unexpected emergencies',
        icon: '💰',
        timeframe: 'short'
      },
      {
        id: 'retirement',
        domain: 'financial',
        title: 'Retirement Planning',
        description: 'Build a robust retirement fund to ensure future financial security',
        icon: '🏖️',
        timeframe: 'long'
      },
      {
        id: 'fitness',
        domain: 'health',
        title: 'Regular Exercise Routine',
        description: 'Establish and maintain a consistent fitness regimen',
        icon: '🏃',
        timeframe: 'short'
      }
    ];
    
    // Persona-specific goals
    const personaGoals: Record<string, Goal[]> = {
      professional: [
        {
          id: 'promotion',
          domain: 'career',
          title: 'Career Advancement',
          description: 'Get promoted or secure a higher position within 2 years',
          icon: '📈',
          timeframe: 'medium'
        },
        {
          id: 'networking',
          domain: 'career',
          title: 'Expand Professional Network',
          description: 'Grow network by attending events and connecting with industry leaders',
          icon: '🤝',
          timeframe: 'medium'
        },
        {
          id: 'skill_development',
          domain: 'education',
          title: 'Professional Skill Development',
          description: 'Acquire certifications or skills that enhance career prospects',
          icon: '🧠',
          timeframe: 'short'
        }
      ],
      learner: [
        {
          id: 'degree',
          domain: 'education',
          title: 'Advanced Degree or Certification',
          description: 'Pursue higher education or specialized certification',
          icon: '🎓',
          timeframe: 'medium'
        },
        {
          id: 'languages',
          domain: 'education',
          title: 'Learn New Languages',
          description: 'Become conversational in a new language',
          icon: '🗣️',
          timeframe: 'medium'
        },
        {
          id: 'research',
          domain: 'career',
          title: 'Research or Publication',
          description: 'Contribute to your field through research or published work',
          icon: '📚',
          timeframe: 'long'
        }
      ],
      balanced: [
        {
          id: 'work_life',
          domain: 'career',
          title: 'Work-Life Balance',
          description: 'Create clear boundaries between work and personal life',
          icon: '⚖️',
          timeframe: 'short'
        },
        {
          id: 'nutrition',
          domain: 'health',
          title: 'Balanced Nutrition',
          description: 'Establish healthy, sustainable eating habits',
          icon: '🥗',
          timeframe: 'short'
        },
        {
          id: 'hobbies',
          domain: 'health',
          title: 'Meaningful Hobbies',
          description: 'Develop and maintain engaging personal interests',
          icon: '🎨',
          timeframe: 'medium'
        }
      ],
      investor: [
        {
          id: 'passive_income',
          domain: 'financial',
          title: 'Build Passive Income Streams',
          description: 'Develop multiple sources of income that require minimal active effort',
          icon: '💵',
          timeframe: 'medium'
        },
        {
          id: 'investment_portfolio',
          domain: 'financial',
          title: 'Diversified Investment Portfolio',
          description: 'Create a well-balanced portfolio across different asset classes',
          icon: '📊',
          timeframe: 'medium'
        },
        {
          id: 'real_estate',
          domain: 'financial',
          title: 'Real Estate Investment',
          description: 'Purchase investment property or REITs for long-term growth',
          icon: '🏠',
          timeframe: 'long'
        }
      ],
      wellness: [
        {
          id: 'preventive_care',
          domain: 'health',
          title: 'Preventive Healthcare',
          description: 'Maintain regular check-ups and preventive health practices',
          icon: '⚕️',
          timeframe: 'short'
        },
        {
          id: 'mental_health',
          domain: 'health',
          title: 'Mental Wellbeing',
          description: 'Establish habits that support psychological health and stress management',
          icon: '🧘',
          timeframe: 'short'
        },
        {
          id: 'nutrition_education',
          domain: 'education',
          title: 'Nutrition & Health Education',
          description: 'Expand knowledge around nutrition and holistic health practices',
          icon: '🍎',
          timeframe: 'medium'
        }
      ]
    };
    
    // Combine common goals with persona-specific goals
    return [...commonGoals, ...(personaGoals[persona] || [])];
  };
  
  const allGoals = getGoalsByPersona(persona);
  const [prioritizedGoals, setPrioritizedGoals] = useState<Record<string, number>>({});
  const [step, setStep] = useState(1);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedAnimation, setCompletedAnimation] = useState(false);
  
  // Initialize goals with order 0
  useEffect(() => {
    const initialPriorities: Record<string, number> = {};
    allGoals.forEach(goal => {
      initialPriorities[goal.id] = 0;
    });
    setPrioritizedGoals(initialPriorities);
  }, [allGoals]);
  
  // Set priority for a goal
  const setPriority = (goalId: string, priority: number) => {
    setPrioritizedGoals(prev => ({
      ...prev,
      [goalId]: priority
    }));
    
    // Move to next goal
    if (currentGoalIndex < allGoals.length - 1) {
      setTimeout(() => {
        setCurrentGoalIndex(currentGoalIndex + 1);
      }, 300);
    } else {
      // All goals prioritized, move to next step
      setStep(2);
    }
  };
  
  const handleComplete = () => {
    setCompletedAnimation(true);
    setTimeout(() => {
      onComplete(prioritizedGoals);
    }, 1500);
  };
  
  // Group goals by domain for the review step
  const groupedGoals = allGoals.reduce((acc, goal) => {
    if (!acc[goal.domain]) {
      acc[goal.domain] = [];
    }
    acc[goal.domain].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);
  
  // Domain labels
  const domainLabels = {
    financial: 'Financial',
    career: 'Career',
    education: 'Education',
    health: 'Health & Wellness'
  };
  
  // Domain colors
  const domainColors = {
    financial: 'from-emerald-500 to-teal-500',
    career: 'from-blue-500 to-indigo-500',
    education: 'from-purple-500 to-pink-500',
    health: 'from-rose-500 to-red-500'
  };
  
  // Priority labels
  const getPriorityLabel = (priority: number) => {
    switch(priority) {
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'High';
      case 4: return 'Critical';
      default: return 'Not Selected';
    }
  };
  
  // Priority colors
  const getPriorityColor = (priority: number) => {
    switch(priority) {
      case 1: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 2: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 3: return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 4: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };
  
  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Your Life Goals
      </h2>
      
      {step === 1 && (
        <>
          <div className="text-center mb-6">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              Rate each goal's importance to you
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              These priorities will help us customize your roadmap
            </p>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentGoalIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {currentGoalIndex + 1} of {allGoals.length}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                  ${domainColors[allGoals[currentGoalIndex].domain].split(' ')[0] === 'from-emerald-500' 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : domainColors[allGoals[currentGoalIndex].domain].split(' ')[0] === 'from-blue-500'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : domainColors[allGoals[currentGoalIndex].domain].split(' ')[0] === 'from-purple-500'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
                  }`}
                >
                  {domainLabels[allGoals[currentGoalIndex].domain]}
                </span>
              </div>
              
              <div className="text-center mb-8">
                <div className="text-4xl mb-4">{allGoals[currentGoalIndex].icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {allGoals[currentGoalIndex].title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {allGoals[currentGoalIndex].description}
                </p>
              </div>
              
              <div className="space-y-3">
                <p className="text-center font-medium text-gray-700 dark:text-gray-300 mb-4">
                  How important is this goal to you?
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPriority(allGoals[currentGoalIndex].id, 1)}
                    className="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                    hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <span className="block text-lg mb-1">👍</span>
                    Nice to Have
                  </button>
                  
                  <button
                    onClick={() => setPriority(allGoals[currentGoalIndex].id, 2)}
                    className="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                    hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors text-sm font-medium
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <span className="block text-lg mb-1">💡</span>
                    Want to Achieve
                  </button>
                  
                  <button
                    onClick={() => setPriority(allGoals[currentGoalIndex].id, 3)}
                    className="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                    hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm font-medium
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    <span className="block text-lg mb-1">🔥</span>
                    Very Important
                  </button>
                  
                  <button
                    onClick={() => setPriority(allGoals[currentGoalIndex].id, 4)}
                    className="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                    hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <span className="block text-lg mb-1">⭐</span>
                    Must Accomplish
                  </button>
                </div>
                
                <button
                  onClick={() => setPriority(allGoals[currentGoalIndex].id, 0)}
                  className="w-full mt-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Skip this goal
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}
      
      {step === 2 && !completedAnimation && (
        <>
          <div className="text-center mb-6">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              Review your prioritized goals
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can still make changes before finalizing
            </p>
          </div>
          
          <div className="space-y-8">
            {Object.entries(groupedGoals).map(([domain, goals]) => (
              <motion.div 
                key={domain}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden"
              >
                <div className={`bg-gradient-to-r ${domainColors[domain as keyof typeof domainColors]} px-6 py-4`}>
                  <h3 className="text-lg font-semibold text-white">
                    {domainLabels[domain as keyof typeof domainLabels]} Goals
                  </h3>
                </div>
                
                <div className="p-6">
                  <ul className="space-y-4">
                    {goals
                      .sort((a, b) => (prioritizedGoals[b.id] || 0) - (prioritizedGoals[a.id] || 0))
                      .map(goal => (
                        <li key={goal.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{goal.icon}</span>
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {goal.title}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {goal.timeframe === 'short' ? 'Short-term' : 
                                 goal.timeframe === 'medium' ? 'Medium-term' : 'Long-term'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <select
                              value={prioritizedGoals[goal.id] || 0}
                              onChange={(e) => setPrioritizedGoals(prev => ({
                                ...prev,
                                [goal.id]: parseInt(e.target.value)
                              }))}
                              className="pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 rounded-md 
                              focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 
                              text-gray-900 dark:text-white"
                            >
                              <option value="0">Not Selected</option>
                              <option value="1">Low Priority</option>
                              <option value="2">Medium Priority</option>
                              <option value="3">High Priority</option>
                              <option value="4">Critical Priority</option>
                            </select>
                          </div>
                        </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
      
      {step === 2 && completedAnimation && (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 150, damping: 10 }}
            className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600 dark:text-green-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.div>
          
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Goals Successfully Prioritized!
          </h3>
          
          <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
            We're using your priorities to create your personalized life roadmap. Please wait while we finalize everything...
          </p>
        </motion.div>
      )}
      
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
          text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          disabled={completedAnimation}
        >
          Back
        </button>
        
        {step === 2 && !completedAnimation && (
          <button
            onClick={handleComplete}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
            text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
            focus:ring-blue-500 transition-colors"
          >
            Confirm & Continue
          </button>
        )}
      </div>
    </motion.div>
  );
}