// Health domain — built on the shared framework (same model as Career). Canonical route: /dashboard/healthcare.
import type { DomainConfig } from '@/components/domain/framework';

export const healthDomain: DomainConfig = {
  key: 'health',
  label: 'Health',
  basePath: '/dashboard/healthcare',
  tagline: 'Organize your health for planning — not medical advice',
  nav: [
    { label: 'Overview', href: '/dashboard/healthcare' },
    { label: 'Biometrics', href: '/dashboard/healthcare/biometrics', beta: true },
    { label: 'Fitness', href: '/dashboard/healthcare/fitness', beta: true },
    { label: 'Nutrition', href: '/dashboard/healthcare/nutrition', beta: true },
    { label: 'Labs', href: '/dashboard/healthcare/labs', beta: true },
    { label: 'Medications', href: '/dashboard/healthcare/medications', beta: true },
    { label: 'Insurance', href: '/dashboard/healthcare/insurance' },
    { label: 'Documents', href: '/dashboard/healthcare/documents', beta: true },
    { label: 'Analysis', href: '/dashboard/healthcare/analysis', beta: true },
    { label: 'Recommendations', href: '/dashboard/healthcare/recommendations', beta: true },
    { label: 'Goals', href: '/dashboard/healthcare/goals', beta: true },
    { label: 'Reports', href: '/dashboard/healthcare/reports', beta: true },
    { label: 'Settings', href: '/dashboard/healthcare/settings' },
  ],
};
