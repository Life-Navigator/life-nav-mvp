'use client';

import React, { useState, useEffect } from 'react';

interface CareerGoals {
  currentStatus?: string;
  industry?: string;
  currentRole?: string;
  yearsExperience?: string;
  salaryRange?: string;
  shortTermGoals?: string[];
  longTermGoals?: string[];
  skillsToAcquire?: string[];
  workValues?: string[];
  challenges?: string[];
}

interface CareerQuestionnaireProps {
  data: CareerGoals;
  onChange: (data: CareerGoals) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CareerQuestionnaire({ 
  data, 
  onChange, 
  onNext, 
  onBack 
}: CareerQuestionnaireProps) {
  const [formData, setFormData] = useState<CareerGoals>(data || {});
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
      const currentValues = prev[name] || [];
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
  const shortTermGoalOptions = [
    'Get promoted',
    'Switch roles within my company',
    'Change companies',
    'Improve work-life balance',
    'Increase salary',
    'Gain new skills',
    'Network more effectively'
  ];

  const longTermGoalOptions = [
    'Reach executive/leadership position',
    'Change career field completely',
    'Start my own business',
    'Become an expert/thought leader',
    'Work remotely/location independence',
    'Semi-retirement/part-time work',
    'Full retirement planning'
  ];

  const skillsOptions = [
    'Technical skills',
    'Leadership',
    'Public speaking',
    'Project management',
    'Financial literacy',
    'Marketing',
    'Data analysis',
    'Coding/programming',
    'Languages',
    'Communication'
  ];

  const workValueOptions = [
    'High salary',
    'Work-life balance',
    'Job security',
    'Remote work options',
    'Career advancement',
    'Meaningful work',
    'Collaborative environment',
    'Independence/autonomy',
    'Learning opportunities',
    'Recognition'
  ];

  const challengeOptions = [
    'Skill gaps',
    'Work-life balance',
    'Lack of connections/network',
    'Limited growth opportunities',
    'Job market competition',
    'Unclear career path',
    'Burnout/stress',
    'Insufficient compensation'
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Current Career Status
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employment status
                </label>
                <select
                  name="currentStatus"
                  value={formData.currentStatus || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select your current status</option>
                  <option value="employed_full">Employed full-time</option>
                  <option value="employed_part">Employed part-time</option>
                  <option value="self_employed">Self-employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="E.g., Technology, Healthcare, Finance, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current role or title
                </label>
                <input
                  type="text"
                  name="currentRole"
                  value={formData.currentRole || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="E.g., Software Engineer, Marketing Manager, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Years of professional experience
                </label>
                <select
                  name="yearsExperience"
                  value={formData.yearsExperience || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select experience level</option>
                  <option value="0-1">Less than 1 year</option>
                  <option value="1-3">1-3 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10-15">10-15 years</option>
                  <option value="15+">15+ years</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current annual salary range
                </label>
                <select
                  name="salaryRange"
                  value={formData.salaryRange || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select salary range</option>
                  <option value="0-30k">$0 - $30,000</option>
                  <option value="30k-50k">$30,000 - $50,000</option>
                  <option value="50k-75k">$50,000 - $75,000</option>
                  <option value="75k-100k">$75,000 - $100,000</option>
                  <option value="100k-150k">$100,000 - $150,000</option>
                  <option value="150k-200k">$150,000 - $200,000</option>
                  <option value="200k+">$200,000+</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </>
        );
      
      case 1:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Career Goals
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Short-term career goals (next 1-2 years)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shortTermGoalOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`short-term-${option}`}
                        checked={(formData.shortTermGoals || []).includes(option)}
                        onChange={() => handleMultiSelectChange('shortTermGoals', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`short-term-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Long-term career goals (next 3-5+ years)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {longTermGoalOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`long-term-${option}`}
                        checked={(formData.longTermGoals || []).includes(option)}
                        onChange={() => handleMultiSelectChange('longTermGoals', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`long-term-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      
      case 2:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Skills and Values
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Skills you'd like to develop
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {skillsOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`skill-${option}`}
                        checked={(formData.skillsToAcquire || []).includes(option)}
                        onChange={() => handleMultiSelectChange('skillsToAcquire', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`skill-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What do you value most in your work?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workValueOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`value-${option}`}
                        checked={(formData.workValues || []).includes(option)}
                        onChange={() => handleMultiSelectChange('workValues', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`value-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Current career challenges
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {challengeOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`challenge-${option}`}
                        checked={(formData.challenges || []).includes(option)}
                        onChange={() => handleMultiSelectChange('challenges', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`challenge-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Career Goals
      </h2>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Tell us about your professional experience and career aspirations to help build your personalized roadmap.
        </p>
      </div>
      
      <div className="space-y-6">
        {renderStep()}
      </div>
      
      <div className="flex justify-between pt-6">
        <button
          onClick={prevStep}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
          text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={nextStep}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
          text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
          focus:ring-blue-500 transition-colors"
        >
          {currentStep < 2 ? 'Continue' : 'Next: Financial Goals'}
        </button>
      </div>
    </div>
  );
}