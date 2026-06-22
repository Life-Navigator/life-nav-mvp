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
    { label: 'Family Members', href: '/dashboard/family/members' },
    { label: 'Pets', href: '/dashboard/family/pets' },
    { label: 'Dependents', href: '/dashboard/family/dependents' },
    { label: 'Beneficiaries', href: '/dashboard/family/beneficiaries' },
    { label: 'Guardianship', href: '/dashboard/family/guardianship' },
    { label: 'Emergency Contacts', href: '/dashboard/family/emergency-contacts' },
    { label: 'Trusted Advisors', href: '/dashboard/family/trusted-advisors' },
    { label: 'Documents', href: '/dashboard/family/documents' },
    { label: 'Recommendations', href: '/dashboard/family/recommendations' },
    { label: 'Goals', href: '/dashboard/family/goals', beta: true },
    { label: 'Estate & Family Office', href: '/dashboard/family/estate' },
    { label: 'Reports', href: '/dashboard/family/reports', beta: true },
    { label: 'Settings', href: '/dashboard/family/settings', beta: true },
  ],
};
