'use client';

// Health now uses the SHARED Domain Framework — no custom layout, no custom sidebar (replaces HealthSidebar).
import type { ReactNode } from 'react';
import { DomainLayout } from '@/components/domain/framework';
import { healthDomain } from '@/components/domain/configs/health';

export default function HealthcareLayout({ children }: { children: ReactNode }) {
  return <DomainLayout config={healthDomain}>{children}</DomainLayout>;
}
