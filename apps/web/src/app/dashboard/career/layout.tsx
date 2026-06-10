'use client';

// Career now uses the SHARED Domain Framework — no custom layout, no custom sidebar. A domain is just
// a DomainConfig + DomainLayout. (Replaces the old CareerSidebar/bespoke layout.)
import type { ReactNode } from 'react';
import { DomainLayout } from '@/components/domain/framework';
import { careerDomain } from '@/components/domain/configs/career';

export default function CareerLayout({ children }: { children: ReactNode }) {
  return <DomainLayout config={careerDomain}>{children}</DomainLayout>;
}
