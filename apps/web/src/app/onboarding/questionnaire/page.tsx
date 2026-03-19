'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { getSupabaseClient } from '@/lib/supabase/client';

// Domain-specific questionnaire steps
import BasicProfileQuestionnaire from '@/components/onboarding/BasicProfileQuestionnaire';
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
  BASIC_PROFILE: 1,
  EDUCATION: 2,
  CAREER: 3,
  FINANCIAL: 4,
  HEALTH: 5,
  RISK: 6,
  COMPLETE: 7,
};

function QuestionnaireContent() {
  const router = useRouter();
  const { addToast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
  const [formData, setFormData] = useState({
    basicProfile: {},
    education: {},
    career: {},
    financial: {},
    health: {},
    risk: { riskTheta: 0 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to switch to enhanced onboarding
  const switchToEnhancedOnboarding = () => {
    router.push('/onboarding/interactive');
  };

  // Get authenticated user from Supabase session
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.push('/auth/login');
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        addToast({
          title: 'Authentication Required',
          description: 'Please login to access the onboarding questionnaire.',
          type: 'error',
        });
        router.push('/auth/login');
      } else {
        setUserId(user.id);
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || null);
      }
    });
  }, [router, addToast]);

  const handleStepDataChange = (step: string, data: any) => {
    setFormData((prev) => ({
      ...prev,
      [step]: data,
    }));
  };

  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!userId) return;

    setIsSubmitting(true);

    async function postStep(url: string, body: Record<string, unknown>) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`${url} failed (${res.status}): ${msg}`);
      }
      return res;
    }

    try {
      // Submit basic profile data via onboarding route
      const basicProfile = formData.basicProfile as any;
      if (basicProfile && Object.keys(basicProfile).length > 0) {
        await postStep('/api/onboarding', {
          step: 'basic_profile',
          data: {
            name: basicProfile.name,
            phoneNumber: basicProfile.phoneNumber,
            dateOfBirth: basicProfile.dateOfBirth,
            gender: basicProfile.gender,
            city: basicProfile.city,
            state: basicProfile.state,
            country: basicProfile.country,
          },
        });
      }

      // Submit education goals
      await postStep('/api/onboarding/education-goals', { goals: formData.education });

      // Submit career goals
      await postStep('/api/onboarding/career-goals', { goals: formData.career });

      // Submit financial goals
      await postStep('/api/onboarding/financial-goals', { goals: formData.financial });

      // Submit health goals
      await postStep('/api/onboarding/health-goals', { goals: formData.health });

      // Submit risk profile
      await postStep('/api/onboarding/risk-profile', {
        riskTheta: (formData.risk as any).riskTheta,
        financialRiskTolerance: (formData.risk as any).financialRiskTolerance,
        careerRiskTolerance: (formData.risk as any).careerRiskTolerance,
        healthRiskTolerance: (formData.risk as any).healthRiskTolerance,
        educationRiskTolerance: (formData.risk as any).educationRiskTolerance,
        assessmentResponses: (formData.risk as any).responses,
      });

      // Mark user setup as complete
      await postStep('/api/onboarding/complete', {});

      // Move to completion step
      nextStep();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      addToast({
        title: 'Error',
        description: 'Failed to save your information. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case STEPS.INTRO:
        return (
          <QuestionnaireIntro
            onContinue={nextStep}
            onSwitchToEnhanced={switchToEnhancedOnboarding}
          />
        );

      case STEPS.BASIC_PROFILE:
        return (
          <BasicProfileQuestionnaire
            data={formData.basicProfile as any}
            onChange={(data: any) => handleStepDataChange('basicProfile', data)}
            onNext={nextStep}
            onBack={prevStep}
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

      case STEPS.COMPLETE:
        return (
          <QuestionnaireComplete
            onContinue={() => {
              // Redirect to dashboard after completion
              // Use window.location to force a full refresh and update the session
              window.location.href = '/dashboard';
            }}
          />
        );

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

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading questionnaire...</p>
        </div>
      </div>
    </div>
  );
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <QuestionnaireContent />
    </Suspense>
  );
}
