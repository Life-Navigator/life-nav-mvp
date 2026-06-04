import SampleFinancialProfile from '@/components/onboarding/SampleFinancialProfile';

export const dynamic = 'force-dynamic';

/**
 * Onboarding step: Choose Sample Financial Profile.
 * Flow: Registration → Basic profile → Choose Sample Financial Profile
 *       → Activate Financial Profile → Dashboard
 */
export default function FinancialProfileOnboardingPage() {
  return <SampleFinancialProfile />;
}
