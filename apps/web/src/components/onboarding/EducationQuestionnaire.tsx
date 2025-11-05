'use client';

import React, { useState, useEffect } from 'react';

interface EducationGoals {
  currentEducation?: string;
  highestDegree?: string;
  fieldOfStudy?: string;
  shortTermGoals?: string[];
  longTermGoals?: string[];
  preferredLearningStyle?: string;
  timeCommitment?: string;
  certificationInterests?: string[];
  currentChallenges?: string[];
}

interface EducationQuestionnaireProps {
  data: EducationGoals;
  onChange: (data: EducationGoals) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function EducationQuestionnaire({ 
  data, 
  onChange, 
  onNext, 
  onBack 
}: EducationQuestionnaireProps) {
  const [formData, setFormData] = useState<EducationGoals>(data || {});
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

  // Possible options for multi-select fields
  const shortTermGoalOptions = [
    'Complete a specific course',
    'Learn a new skill',
    'Improve grades',
    'Get a certification',
    'Change field of study',
    'Expand knowledge in current field'
  ];

  const longTermGoalOptions = [
    'Complete undergraduate degree',
    'Complete graduate degree',
    'Become an expert in my field',
    'Career advancement through education',
    'Personal enrichment',
    'Switch to a new field'
  ];

  const learningStyleOptions = [
    'Visual',
    'Auditory',
    'Reading/Writing',
    'Kinesthetic (Hands-on)',
    'Mixed approach'
  ];

  const certificationInterestOptions = [
    'Technology',
    'Business',
    'Healthcare',
    'Education',
    'Finance',
    'Design',
    'Engineering',
    'Other'
  ];

  const challengeOptions = [
    'Time management',
    'Financial constraints',
    'Difficulty understanding material',
    'Lack of motivation',
    'Work-life-study balance',
    'Access to resources'
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Current Education Status
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current education level
                </label>
                <select
                  name="currentEducation"
                  value={formData.currentEducation || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select your current education</option>
                  <option value="high_school">High school</option>
                  <option value="associate">Associate's degree (in progress)</option>
                  <option value="bachelor">Bachelor's degree (in progress)</option>
                  <option value="master">Master's degree (in progress)</option>
                  <option value="doctorate">Doctorate (in progress)</option>
                  <option value="self_study">Self-study</option>
                  <option value="not_studying">Not currently studying</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Highest degree completed
                </label>
                <select
                  name="highestDegree"
                  value={formData.highestDegree || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select highest degree completed</option>
                  <option value="high_school">High school diploma</option>
                  <option value="associate">Associate's degree</option>
                  <option value="bachelor">Bachelor's degree</option>
                  <option value="master">Master's degree</option>
                  <option value="doctorate">Doctorate</option>
                  <option value="none">None</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field of study
                </label>
                <input
                  type="text"
                  name="fieldOfStudy"
                  value={formData.fieldOfStudy || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="E.g., Computer Science, Business, etc."
                />
              </div>
            </div>
          </>
        );
      
      case 1:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Educational Goals
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Short-term educational goals (next 1-2 years)
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
                  Long-term educational goals (next 3-5+ years)
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
              Learning Preferences and Challenges
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred learning style
                </label>
                <select
                  name="preferredLearningStyle"
                  value={formData.preferredLearningStyle || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select your preferred learning style</option>
                  {learningStyleOptions.map(option => (
                    <option key={option} value={option.toLowerCase()}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weekly time commitment for learning
                </label>
                <select
                  name="timeCommitment"
                  value={formData.timeCommitment || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select time commitment</option>
                  <option value="0-5">0-5 hours per week</option>
                  <option value="5-10">5-10 hours per week</option>
                  <option value="10-20">10-20 hours per week</option>
                  <option value="20-30">20-30 hours per week</option>
                  <option value="30+">30+ hours per week</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Certification interests
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {certificationInterestOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`cert-${option}`}
                        checked={(formData.certificationInterests || []).includes(option)}
                        onChange={() => handleMultiSelectChange('certificationInterests', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`cert-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Current educational challenges
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {challengeOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`challenge-${option}`}
                        checked={(formData.currentChallenges || []).includes(option)}
                        onChange={() => handleMultiSelectChange('currentChallenges', option)}
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
        Education Goals
      </h2>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Tell us about your educational background and aspirations to help us create a tailored learning roadmap.
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
          {currentStep < 2 ? 'Continue' : 'Next: Career Goals'}
        </button>
      </div>
    </div>
  );
}