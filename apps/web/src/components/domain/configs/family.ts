// Family domain — built on the shared framework (same model as Career/Health/Education). It previously
// had NO layout/sidebar at all — this config gives it nav parity. Base: /dashboard/family.
import type { DomainConfig } from '@/components/domain/framework';

export const familyDomain: DomainConfig = {
  key: 'family',
  label: 'Family',
  basePath: '/dashboard/family',
  tagline: 'Protection, dependents, estate & legacy — not legal advice',
  nav: [
    { label: 'Overview', href: '/dashboard/family' },
    { label: 'Members', href: '/dashboard/family/members', beta: true },
    { label: 'Dependents', href: '/dashboard/family/dependents', beta: true },
    { label: 'Goals', href: '/dashboard/family/goals', beta: true },
    { label: 'Estate', href: '/dashboard/family/estate', beta: true },
    { label: 'Beneficiaries', href: '/dashboard/family/beneficiaries', beta: true },
    { label: 'Guardianship', href: '/dashboard/family/guardianship', beta: true },
    { label: 'Trusted Advisors', href: '/dashboard/family/trusted-advisors', beta: true },
    { label: 'Emergency Contacts', href: '/dashboard/family/emergency-contacts', beta: true },
    { label: 'Documents', href: '/dashboard/family/documents', beta: true },
    { label: 'Recommendations', href: '/dashboard/family/recommendations', beta: true },
    { label: 'Reports', href: '/dashboard/family/reports', beta: true },
    { label: 'Settings', href: '/dashboard/family/settings', beta: true },
  ],
};
