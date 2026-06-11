'use client';

// Family had NO layout/sidebar — this adds nav parity via the SHARED Domain Framework (no custom layout).
import type { ReactNode } from 'react';
import { DomainLayout } from '@/components/domain/framework';
import { familyDomain } from '@/components/domain/configs/family';

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return <DomainLayout config={familyDomain}>{children}</DomainLayout>;
}
