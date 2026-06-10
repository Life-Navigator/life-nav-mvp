// Career domain — the FIRST config built on the shared framework. A domain is now just a config +
// the shared components: no custom layout, no custom navigation. This is the template every other
// domain (Health, Education, Family, future Legal/Insurance/Estate/Business/Military) copies.
import type { DomainConfig } from '@/components/domain/framework';

export const careerDomain: DomainConfig = {
  key: 'career',
  label: 'Career',
  basePath: '/dashboard/career',
  tagline: 'Your work, trajectory, and earning power',
  nav: [
    { label: 'Overview', href: '/dashboard/career' },
    { label: 'Experience', href: '/dashboard/career/experience', beta: true },
    { label: 'Skills', href: '/dashboard/career/skills' },
    { label: 'Certifications', href: '/dashboard/career/certifications', beta: true },
    { label: 'Opportunities', href: '/dashboard/career/opportunities' },
    { label: 'Networking', href: '/dashboard/career/networking' },
    { label: 'Compensation', href: '/dashboard/career/compensation', beta: true },
    { label: 'Documents', href: '/dashboard/career/documents', beta: true },
    { label: 'Analysis', href: '/dashboard/career/analysis', beta: true },
    { label: 'Recommendations', href: '/dashboard/career/recommendations', beta: true },
    { label: 'Goals', href: '/dashboard/career/goals', beta: true },
    { label: 'Reports', href: '/dashboard/career/reports', beta: true },
    { label: 'Settings', href: '/dashboard/career/settings', beta: true },
  ],
};
