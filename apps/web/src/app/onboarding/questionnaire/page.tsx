'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';

// Domain-specific questionnaire steps
import EducationQuestionnaire from '@/components/onboarding/EducationQuestionnaire';
import CareerQuestionnaire from '@/components/onboarding/CareerQuestionnaire';
import FinancialQuestionnaire from '@/components/onboarding/FinancialQuestionnaire';
import HealthQuestionnaire from '@/components/onboarding/HealthQuestionnaire';
import RiskAssessment from '@/components/onboarding/RiskAssessment';
import QuestionnaireIntro from '@/components/onboarding/QuestionnaireIntro';
import QuestionnaireComplete from '@/components/onboarding/QuestionnaireComplete';

// Define all steps in the questionnaire process
const STEPS = {
  INTRO: 0,
  EDUCATION: 1,
  CAREER: 2,
  FINANCIAL: 3,
  HEALTH: 4,
  RISK: 5,
  COMPLETE: 6,
};

export default function QuestionnairePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const userName = searchParams.get('name');
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
  const [formData, setFormData] = useState({
    education: {},
    career: {},
    financial: {},
    health: {},
    risk: { riskTheta: 0 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to switch to enhanced onboarding
  const switchToEnhancedOnboarding = () => {
    router.push(`/onboarding/interactive?userId=${userId}${userName ? `&name=${userName}` : ''}`);
  };

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

  const handleStepDataChange = (step, data) => {
    setFormData(prev => ({
      ...prev,
      [step]: data,
    }));
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
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
      case STEPS.INTRO:
        return <QuestionnaireIntro
          onContinue={nextStep}
          onSwitchToEnhanced={switchToEnhancedOnboarding}
        />;
      
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
      
      case STEPS.COMPLETE:
        return <QuestionnaireComplete onContinue={() => {
          // Redirect to dashboard after completion
          // Use window.location to force a full refresh and update the session
          window.location.href = '/dashboard';
        }} />;
      
      default:
        return <QuestionnaireIntro onContinue={nextStep} />;
    }
  };

  // Calculate progress percentage
  const progress = Math.round((currentStep / (Object.keys(STEPS).length - 1)) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
        {/* Progress bar */}
        {currentStep > 0 && currentStep < STEPS.COMPLETE && (
          <div className="w-full">
            <div className="relative pt-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:bg-blue-900 dark:text-blue-200">
                    Progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">
                    {progress}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-blue-900">
                <div 
                  style={{ width: `${progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 dark:bg-blue-600 transition-all duration-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Current step */}
        {renderStep()}
      </div>
    </div>
  );
}