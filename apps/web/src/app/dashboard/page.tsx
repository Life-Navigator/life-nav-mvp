import DashboardClient from '@/components/dashboard/DashboardClient';

/**
 * Dashboard page — authentication and onboarding checks are handled by middleware.
 * If we reach this page, the user is authenticated and has completed onboarding.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
