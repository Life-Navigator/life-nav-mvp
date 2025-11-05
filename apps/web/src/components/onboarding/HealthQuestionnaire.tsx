'use client';

import React, { useState, useEffect } from 'react';

interface HealthGoals {
  currentHealth?: string;
  height?: string;
  weight?: string;
  exerciseFrequency?: string;
  sleepQuality?: string;
  stressLevel?: string;
  dietQuality?: string;
  medicalConditions?: string[];
  shortTermGoals?: string[];
  longTermGoals?: string[];
  challenges?: string[];
  wellnessInterests?: string[];
}

interface HealthQuestionnaireProps {
  data: HealthGoals;
  onChange: (data: HealthGoals) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function HealthQuestionnaire(props: HealthQuestionnaireProps) {
  const { data, onChange, onNext, onBack } = props;
  const [formData, setFormData] = useState<HealthGoals>(data || {});
  const [currentStep, setCurrentStep] = useState(0);

  // Update parent component when form data changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMultiSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const currentValues = prev[name as keyof HealthGoals] || [];
      if (Array.isArray(currentValues)) {
        // Toggle selection
        if (currentValues.includes(value)) {
          return {
            ...prev,
            [name]: currentValues.filter(v => v !== value),
          };
        } else {
          return {
            ...prev,
            [name]: [...currentValues, value],
          };
        }
      }
      return prev;
    });
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      onNext();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  // Option lists for multi-select fields
  const medicalConditionOptions = [
    'None',
    'High blood pressure',
    'High cholesterol',
    'Diabetes',
    'Heart disease',
    'Asthma/respiratory',
    'Arthritis',
    'Depression/anxiety',
    'Obesity',
    'Cancer',
    'Other'
  ];

  const shortTermGoalOptions = [
    'Lose weight',
    'Gain muscle',
    'Improve flexibility',
    'Improve sleep',
    'Reduce stress',
    'Eat healthier',
    'Start exercising regularly',
    'Reduce pain',
    'Manage chronic condition'
  ];

  const longTermGoalOptions = [
    'Maintain healthy weight',
    'Build exercise habit',
    'Improve mental health',
    'Prevent chronic diseases',
    'Increase longevity',
    'Improve mobility/flexibility',
    'Reduce medications',
    'Complete physical challenge (marathon, etc.)'
  ];

  const wellnessInterestOptions = [
    'Nutrition',
    'Fitness',
    'Mental health',
    'Meditation/mindfulness',
    'Yoga',
    'Sleep optimization',
    'Preventive care',
    'Alternative medicine',
    'Supplements',
    'Digital health tracking'
  ];

  const challengeOptions = [
    'Lack of time',
    'Low motivation',
    'Physical limitations',
    'Stress',
    'Sleep issues',
    'Diet consistency',
    'Limited access to resources',
    'Medical conditions',
    'Financial constraints'
  ];

  // Content for each step
  let stepContent;

  if (currentStep === 0) {
    stepContent = React.createElement('div', null, [
      React.createElement('h3', { 
        key: 'title',
        className: "text-xl font-semibold text-gray-900 dark:text-white mb-6" 
      }, "Current Health Status"),
      
      React.createElement('div', { key: 'content', className: "space-y-4" }, [
        // Health rating
        React.createElement('div', { key: 'health-rating' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          }, "How would you rate your overall health?"),
          React.createElement('select', {
            key: 'select',
            name: "currentHealth",
            value: formData.currentHealth || '',
            onChange: handleInputChange,
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          }, [
            React.createElement('option', { key: 'default', value: "" }, "Select rating"),
            React.createElement('option', { key: 'excellent', value: "excellent" }, "Excellent"),
            React.createElement('option', { key: 'very_good', value: "very_good" }, "Very good"),
            React.createElement('option', { key: 'good', value: "good" }, "Good"),
            React.createElement('option', { key: 'fair', value: "fair" }, "Fair"),
            React.createElement('option', { key: 'poor', value: "poor" }, "Poor")
          ])
        ]),
        
        // Height/Weight section
        React.createElement('div', { key: 'measurements', className: "grid grid-cols-1 md:grid-cols-2 gap-4" }, [
          // Height
          React.createElement('div', { key: 'height' }, [
            React.createElement('label', {
              key: 'label',
              className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            }, "Height (optional)"),
            React.createElement('input', {
              key: 'input',
              type: "text",
              name: "height",
              value: formData.height || '',
              onChange: handleInputChange,
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
              placeholder: "E.g., 5'10\" or 178 cm"
            })
          ]),
          
          // Weight
          React.createElement('div', { key: 'weight' }, [
            React.createElement('label', {
              key: 'label',
              className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            }, "Weight (optional)"),
            React.createElement('input', {
              key: 'input',
              type: "text",
              name: "weight",
              value: formData.weight || '',
              onChange: handleInputChange,
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
              placeholder: "E.g., 160 lbs or 73 kg"
            })
          ])
        ]),
        
        // Exercise frequency
        React.createElement('div', { key: 'exercise' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          }, "How often do you exercise?"),
          React.createElement('select', {
            key: 'select',
            name: "exerciseFrequency",
            value: formData.exerciseFrequency || '',
            onChange: handleInputChange,
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          }, [
            React.createElement('option', { key: 'default', value: "" }, "Select frequency"),
            React.createElement('option', { key: 'never', value: "never" }, "Never"),
            React.createElement('option', { key: 'rarely', value: "rarely" }, "Rarely (few times a month)"),
            React.createElement('option', { key: 'sometimes', value: "sometimes" }, "Sometimes (1-2 times a week)"),
            React.createElement('option', { key: 'often', value: "often" }, "Often (3-4 times a week)"),
            React.createElement('option', { key: 'daily', value: "daily" }, "Daily")
          ])
        ]),
        
        // Medical conditions
        React.createElement('div', { key: 'conditions' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          }, "Do you have any ongoing medical conditions? (Select all that apply)"),
          React.createElement('div', { key: 'options', className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
            medicalConditionOptions.map(option => 
              React.createElement('div', { key: option, className: "flex items-center" }, [
                React.createElement('input', {
                  key: 'checkbox',
                  type: "checkbox",
                  id: `condition-${option}`,
                  checked: (formData.medicalConditions || []).includes(option),
                  onChange: () => handleMultiSelectChange('medicalConditions', option),
                  className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                }),
                React.createElement('label', {
                  key: 'label',
                  htmlFor: `condition-${option}`,
                  className: "ml-2 block text-sm text-gray-700 dark:text-gray-300"
                }, option)
              ])
            )
          )
        ])
      ])
    ]);
  } else if (currentStep === 1) {
    stepContent = React.createElement('div', null, [
      React.createElement('h3', { 
        key: 'title',
        className: "text-xl font-semibold text-gray-900 dark:text-white mb-6" 
      }, "Lifestyle Factors"),
      
      React.createElement('div', { key: 'content', className: "space-y-4" }, [
        // Sleep quality
        React.createElement('div', { key: 'sleep' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          }, "How would you rate your sleep quality?"),
          React.createElement('select', {
            key: 'select',
            name: "sleepQuality",
            value: formData.sleepQuality || '',
            onChange: handleInputChange,
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          }, [
            React.createElement('option', { key: 'default', value: "" }, "Select rating"),
            React.createElement('option', { key: 'excellent', value: "excellent" }, "Excellent"),
            React.createElement('option', { key: 'good', value: "good" }, "Good"),
            React.createElement('option', { key: 'fair', value: "fair" }, "Fair"),
            React.createElement('option', { key: 'poor', value: "poor" }, "Poor"),
            React.createElement('option', { key: 'very_poor', value: "very_poor" }, "Very poor")
          ])
        ]),
        
        // Stress level
        React.createElement('div', { key: 'stress' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          }, "How would you rate your overall stress level?"),
          React.createElement('select', {
            key: 'select',
            name: "stressLevel",
            value: formData.stressLevel || '',
            onChange: handleInputChange,
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          }, [
            React.createElement('option', { key: 'default', value: "" }, "Select level"),
            React.createElement('option', { key: 'very_low', value: "very_low" }, "Very low"),
            React.createElement('option', { key: 'low', value: "low" }, "Low"),
            React.createElement('option', { key: 'moderate', value: "moderate" }, "Moderate"),
            React.createElement('option', { key: 'high', value: "high" }, "High"),
            React.createElement('option', { key: 'very_high', value: "very_high" }, "Very high")
          ])
        ]),
        
        // Diet quality
        React.createElement('div', { key: 'diet' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          }, "How would you rate your diet?"),
          React.createElement('select', {
            key: 'select',
            name: "dietQuality",
            value: formData.dietQuality || '',
            onChange: handleInputChange,
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          }, [
            React.createElement('option', { key: 'default', value: "" }, "Select rating"),
            React.createElement('option', { key: 'excellent', value: "excellent" }, "Excellent (whole foods, balanced)"),
            React.createElement('option', { key: 'good', value: "good" }, "Good (mostly healthy)"),
            React.createElement('option', { key: 'fair', value: "fair" }, "Fair (mix of healthy and unhealthy)"),
            React.createElement('option', { key: 'poor', value: "poor" }, "Poor (mostly processed foods)"),
            React.createElement('option', { key: 'very_poor', value: "very_poor" }, "Very poor (fast food, highly processed)")
          ])
        ])
      ])
    ]);
  } else if (currentStep === 2) {
    stepContent = React.createElement('div', null, [
      React.createElement('h3', { 
        key: 'title',
        className: "text-xl font-semibold text-gray-900 dark:text-white mb-6" 
      }, "Health Goals and Interests"),
      
      React.createElement('div', { key: 'content', className: "space-y-6" }, [
        // Short-term goals
        React.createElement('div', { key: 'short-term' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          }, "Short-term health goals (next 1-2 years)"),
          React.createElement('div', { key: 'options', className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
            shortTermGoalOptions.map(option => 
              React.createElement('div', { key: option, className: "flex items-center" }, [
                React.createElement('input', {
                  key: 'checkbox',
                  type: "checkbox",
                  id: `short-term-${option}`,
                  checked: (formData.shortTermGoals || []).includes(option),
                  onChange: () => handleMultiSelectChange('shortTermGoals', option),
                  className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                }),
                React.createElement('label', {
                  key: 'label',
                  htmlFor: `short-term-${option}`,
                  className: "ml-2 block text-sm text-gray-700 dark:text-gray-300"
                }, option)
              ])
            )
          )
        ]),
        
        // Long-term goals
        React.createElement('div', { key: 'long-term' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          }, "Long-term health goals (next 3-5+ years)"),
          React.createElement('div', { key: 'options', className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
            longTermGoalOptions.map(option => 
              React.createElement('div', { key: option, className: "flex items-center" }, [
                React.createElement('input', {
                  key: 'checkbox',
                  type: "checkbox",
                  id: `long-term-${option}`,
                  checked: (formData.longTermGoals || []).includes(option),
                  onChange: () => handleMultiSelectChange('longTermGoals', option),
                  className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                }),
                React.createElement('label', {
                  key: 'label',
                  htmlFor: `long-term-${option}`,
                  className: "ml-2 block text-sm text-gray-700 dark:text-gray-300"
                }, option)
              ])
            )
          )
        ]),
        
        // Wellness interests
        React.createElement('div', { key: 'wellness' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          }, "Wellness and health interests"),
          React.createElement('div', { key: 'options', className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
            wellnessInterestOptions.map(option => 
              React.createElement('div', { key: option, className: "flex items-center" }, [
                React.createElement('input', {
                  key: 'checkbox',
                  type: "checkbox",
                  id: `wellness-${option}`,
                  checked: (formData.wellnessInterests || []).includes(option),
                  onChange: () => handleMultiSelectChange('wellnessInterests', option),
                  className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                }),
                React.createElement('label', {
                  key: 'label',
                  htmlFor: `wellness-${option}`,
                  className: "ml-2 block text-sm text-gray-700 dark:text-gray-300"
                }, option)
              ])
            )
          )
        ]),
        
        // Health challenges
        React.createElement('div', { key: 'challenges' }, [
          React.createElement('label', {
            key: 'label',
            className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          }, "Health challenges"),
          React.createElement('div', { key: 'options', className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
            challengeOptions.map(option => 
              React.createElement('div', { key: option, className: "flex items-center" }, [
                React.createElement('input', {
                  key: 'checkbox',
                  type: "checkbox",
                  id: `challenge-${option}`,
                  checked: (formData.challenges || []).includes(option),
                  onChange: () => handleMultiSelectChange('challenges', option),
                  className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                }),
                React.createElement('label', {
                  key: 'label',
                  htmlFor: `challenge-${option}`,
                  className: "ml-2 block text-sm text-gray-700 dark:text-gray-300"
                }, option)
              ])
            )
          )
        ])
      ])
    ]);
  }

  // Main render
  return React.createElement('div', { className: "space-y-6" }, [
    // Title
    React.createElement('h2', { 
      key: 'main-title',
      className: "text-2xl font-bold text-center text-gray-900 dark:text-white"
    }, "Health Goals"),
    
    // Info box
    React.createElement('div', { 
      key: 'info-box',
      className: "bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-6" 
    }, 
      React.createElement('p', { 
        className: "text-sm text-blue-700 dark:text-blue-300" 
      }, "Tell us about your health status and wellness goals to help create your personalized health roadmap.")
    ),
    
    // Step content
    React.createElement('div', { key: 'step-content', className: "space-y-6" }, stepContent),
    
    // Navigation buttons
    React.createElement('div', { key: 'nav-buttons', className: "flex justify-between pt-6" }, [
      // Back button
      React.createElement('button', {
        key: 'back-btn',
        onClick: prevStep,
        className: "px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      }, "Back"),
      
      // Next/Continue button
      React.createElement('button', {
        key: 'next-btn',
        onClick: nextStep,
        className: "px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      }, currentStep < 2 ? 'Continue' : 'Next: Risk Profile')
    ])
  ]);
}