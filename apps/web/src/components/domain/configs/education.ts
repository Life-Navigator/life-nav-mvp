// Education domain — built on the shared framework (same model as Career/Health). Base: /dashboard/education.
import type { DomainConfig } from '@/components/domain/framework';

export const educationDomain: DomainConfig = {
  key: 'education',
  label: 'Education',
  basePath: '/dashboard/education',
  tagline: 'Degrees, credentials, and the ROI of learning',
  nav: [
    { label: 'Overview', href: '/dashboard/education' },
    { label: 'My Education', href: '/dashboard/education/degrees' },
    { label: 'Certifications', href: '/dashboard/education/certifications' },
    { label: 'Courses', href: '/dashboard/education/courses' },
    { label: 'Skills', href: '/dashboard/education/skills', beta: true },
    { label: 'Career Alignment', href: '/dashboard/education/career-alignment', beta: true },
    { label: 'ROI Analysis', href: '/dashboard/education/roi-analysis', beta: true },
    { label: 'Documents', href: '/dashboard/education/documents', beta: true },
    { label: 'Recommendations', href: '/dashboard/education/recommendations', beta: true },
    { label: 'Goals', href: '/dashboard/education/goals' },
    { label: 'Reports', href: '/dashboard/education/reports', beta: true },
    { label: 'Settings', href: '/dashboard/education/settings', beta: true },
  ],
};
