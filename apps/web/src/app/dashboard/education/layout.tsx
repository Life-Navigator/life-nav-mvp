'use client';

// Education now uses the SHARED Domain Framework — no custom layout, no custom sidebar (replaces EducationSidebar).
import type { ReactNode } from 'react';
import { DomainLayout } from '@/components/domain/framework';
import { educationDomain } from '@/components/domain/configs/education';

export default function EducationLayout({ children }: { children: ReactNode }) {
  return <DomainLayout config={educationDomain}>{children}</DomainLayout>;
}
