'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { getSupabaseClient } from '@/lib/supabase/client';
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

function InteractiveOnboardingContent() {
  const router = useRouter();
  const { addToast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [formData, setFormData] = useState<{
    persona: string;
    goals: any;
    education: any;
    career: any;
    financial: any;
    health: any;
    risk: any;
  }>({
    persona: '',
    goals: {},
    education: {},
    career: {},
    financial: {},
    health: {},
    risk: { riskTheta: 0.5 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get userId from Supabase session
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.push('/auth/login');
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUserId(user.id);
      setUserName(user.user_metadata?.name);
    });
  }, [router]);

  const handleStepDataChange = (step: string, data: any) => {
    setFormData((prev) => ({ ...prev, [step]: data }));
  };

  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/onboarding/education-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.education }),
      });

      await fetch('/api/onboarding/career-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.career }),
      });

      await fetch('/api/onboarding/financial-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.financial }),
      });

      await fetch('/api/onboarding/health-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals: formData.health }),
      });

      await fetch('/api/onboarding/persona-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          persona: formData.persona,
          prioritizedGoals: formData.goals,
        }),
      });

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
          assessmentResponses: formData.risk.responses,
        }),
      });

      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      nextStep();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      addToast({
        title: 'Error',
        description: 'Failed to save your goals. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
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
            onChange={(data: any) => handleStepDataChange('education', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case STEPS.CAREER:
        return (
          <CareerQuestionnaire
            data={formData.career}
            onChange={(data: any) => handleStepDataChange('career', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case STEPS.FINANCIAL:
        return (
          <FinancialQuestionnaire
            data={formData.financial}
            onChange={(data: any) => handleStepDataChange('financial', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case STEPS.HEALTH:
        return (
          <HealthQuestionnaire
            data={formData.health}
            onChange={(data: any) => handleStepDataChange('health', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case STEPS.RISK:
        return (
          <RiskAssessment
            data={formData.risk}
            onChange={(data: any) => handleStepDataChange('risk', data)}
            onNext={handleSubmit}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        );
      case STEPS.ACHIEVEMENTS:
        return <AchievementUnlock onContinue={nextStep} onBack={prevStep} />;
      case STEPS.COMPLETE:
        return (
          <QuestionnaireComplete
            onContinue={() => {
              router.push('/dashboard');
              router.refresh();
            }}
          />
        );
      default:
        return <EnhancedWelcome onContinue={nextStep} userName={userName} />;
    }
  };

  const progress = Math.round((currentStep / (Object.keys(STEPS).length - 1)) * 100);

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
    'Complete',
  ];

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        {currentStep > 0 && currentStep < STEPS.COMPLETE && (
          <div className="w-full">
            <div className="relative mb-6">
              <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-200 dark:bg-blue-900/30">
                <motion.div
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600"
                  initial={{
                    width: `${((currentStep - 1) / (Object.keys(STEPS).length - 1)) * 100}%`,
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2">
                {stepLabels.map((label, index) => (
                  <div
                    key={index}
                    className={`relative ${index === stepLabels.length - 1 ? 'right-2' : index === 0 ? 'left-0' : ''}`}
                    style={{
                      visibility: [0, 2, 4, 6, 8, 9].includes(index) ? 'visible' : 'hidden',
                      flex: index === 0 || index === stepLabels.length - 1 ? '0 0 auto' : '1 1 0',
                    }}
                  >
                    <div
                      className={`
                      absolute top-[-20px] left-1/2 transform -translate-x-1/2
                      w-3 h-3 rounded-full
                      ${currentStep >= index ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}
                    `}
                    />
                    {[0, 2, 4, 6, 8, 9].includes(index) && (
                      <span
                        className={`
                        absolute top-[-42px] left-1/2 transform -translate-x-1/2 whitespace-nowrap
                        font-medium text-[10px]
                        ${currentStep >= index ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'}
                      `}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function InteractiveOnboardingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <InteractiveOnboardingContent />
    </Suspense>
  );
}
