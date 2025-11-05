'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { AnimatePresence, motion } from 'framer-motion';

// Enhanced components
import EnhancedWelcome from '@/components/onboarding/EnhancedWelcome';
import PersonaSelection from '@/components/onboarding/PersonaSelection';
import GoalVisualization from '@/components/onboarding/GoalVisualization';
import AchievementUnlock from '@/components/onboarding/AchievementUnlock';

// Original components for domain-specific questions
import EducationQuestionnaire from '@/components/onboarding/EducationQuestionnaire';
import CareerQuestionnaire from '@/components/onboarding/CareerQuestionnaire';
import FinancialQuestionnaire from '@/components/onboarding/FinancialQuestionnaire';
import HealthQuestionnaire from '@/components/onboarding/HealthQuestionnaire';
import RiskAssessment from '@/components/onboarding/RiskAssessment';
import QuestionnaireComplete from '@/components/onboarding/QuestionnaireComplete';

// Define all steps in the enhanced questionnaire process
const STEPS = {
  WELCOME: 0,
  PERSONA: 1,
  GOALS: 2,
  EDUCATION: 3,
  CAREER: 4,
  FINANCIAL: 5,
  HEALTH: 6,
  RISK: 7,
  ACHIEVEMENTS: 8,
  COMPLETE: 9,
};

export default function InteractiveOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const userName = searchParams.get('name') || undefined;
  const { addToast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [formData, setFormData] = useState({
    persona: '',
    goals: {},
    education: {},
    career: {},
    financial: {},
    health: {},
    risk: { riskTheta: 0.5 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to login if no userId is provided or not authenticated
  useEffect(() => {
    if (!userId) {
      addToast({
        title: "Authentication Required",
        description: "Please login to access the onboarding questionnaire.",
        type: "error",
      });
      router.push('/auth/login');
    }
  }, [userId, router, addToast]);

  const handleStepDataChange = (step: string, data: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: data,
    }));
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
    // Scroll to top when changing steps
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
    // Scroll to top when changing steps
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!userId) return;
    
    setIsSubmitting(true);
    try {
      // Submit education goals
      await fetch('/api/onboarding/education-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.education }),
      });

      // Submit career goals
      await fetch('/api/onboarding/career-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.career }),
      });

      // Submit financial goals
      await fetch('/api/onboarding/financial-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.financial }),
      });

      // Submit health goals
      await fetch('/api/onboarding/health-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.health }),
      });

      // Submit persona and prioritized goals
      await fetch('/api/onboarding/persona-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          persona: formData.persona,
          prioritizedGoals: formData.goals
        }),
      });

      // Submit risk profile
      await fetch('/api/onboarding/risk-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          riskTheta: formData.risk.riskTheta,
          financialRiskTolerance: formData.risk.financialRiskTolerance,
          careerRiskTolerance: formData.risk.careerRiskTolerance,
          healthRiskTolerance: formData.risk.healthRiskTolerance,
          educationRiskTolerance: formData.risk.educationRiskTolerance,
          assessmentResponses: formData.risk.responses 
        }),
      });

      // Mark user setup as complete
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      // Move to completion step
      nextStep();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      addToast({
        title: "Error",
        description: "Failed to save your goals. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch(currentStep) {
      case STEPS.WELCOME:
        return <EnhancedWelcome onContinue={nextStep} userName={userName} />;
      
      case STEPS.PERSONA:
        return (
          <PersonaSelection
            onSelect={(persona) => {
              handleStepDataChange('persona', persona);
              nextStep();
            }}
            onBack={prevStep}
          />
        );
      
      case STEPS.GOALS:
        return (
          <GoalVisualization
            onComplete={(priorities) => {
              handleStepDataChange('goals', priorities);
              nextStep();
            }}
            onBack={prevStep}
            persona={formData.persona}
          />
        );
      
      case STEPS.EDUCATION:
        return (
          <EducationQuestionnaire 
            data={formData.education}
            onChange={(data) => handleStepDataChange('education', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      
      case STEPS.CAREER:
        return (
          <CareerQuestionnaire 
            data={formData.career}
            onChange={(data) => handleStepDataChange('career', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      
      case STEPS.FINANCIAL:
        return (
          <FinancialQuestionnaire 
            data={formData.financial}
            onChange={(data) => handleStepDataChange('financial', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      
      case STEPS.HEALTH:
        return (
          <HealthQuestionnaire 
            data={formData.health}
            onChange={(data) => handleStepDataChange('health', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      
      case STEPS.RISK:
        return (
          <RiskAssessment 
            data={formData.risk}
            onChange={(data) => handleStepDataChange('risk', data)}
            onNext={handleSubmit}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        );
      
      case STEPS.ACHIEVEMENTS:
        return (
          <AchievementUnlock
            onContinue={nextStep}
            onBack={prevStep}
          />
        );
      
      case STEPS.COMPLETE:
        return (
          <QuestionnaireComplete onContinue={() => {
            // Redirect to dashboard after completion
            // Use window.location to force a full refresh and update the session
            window.location.href = '/dashboard';
          }} />
        );
      
      default:
        return <EnhancedWelcome onContinue={nextStep} userName={userName} />;
    }
  };

  // Calculate progress percentage
  const progress = Math.round((currentStep / (Object.keys(STEPS).length - 1)) * 100);
  
  // Step labels for the progress indicator
  const stepLabels = [
    'Welcome',
    'Persona',
    'Goals',
    'Education',
    'Career',
    'Finance',
    'Health',
    'Risk',
    'Rewards',
    'Complete'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        {/* Progress indicator */}
        {currentStep > 0 && currentStep < STEPS.COMPLETE && (
          <div className="w-full">
            <div className="relative mb-6">
              {/* Visual progress bar */}
              <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-200 dark:bg-blue-900/30">
                <motion.div 
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600"
                  initial={{ width: `${(currentStep - 1) / (Object.keys(STEPS).length - 1) * 100}%` }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {/* Step markers */}
              <div className="flex justify-between text-xs mt-2">
                {stepLabels.map((label, index) => (
                  <div 
                    key={index} 
                    className={`relative ${index === stepLabels.length - 1 ? 'right-2' : index === 0 ? 'left-0' : ''}`}
                    style={{ 
                      visibility: [0, 2, 4, 6, 8, 9].includes(index) ? 'visible' : 'hidden',
                      flex: index === 0 || index === stepLabels.length - 1 ? '0 0 auto' : '1 1 0'
                    }}
                  >
                    <div className={`
                      absolute top-[-20px] left-1/2 transform -translate-x-1/2 
                      w-3 h-3 rounded-full 
                      ${currentStep >= index ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}
                    `} />
                    {[0, 2, 4, 6, 8, 9].includes(index) && (
                      <span className={`
                        absolute top-[-42px] left-1/2 transform -translate-x-1/2 whitespace-nowrap
                        font-medium text-[10px]
                        ${currentStep >= index ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'}
                      `}>
                        {label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Current step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}