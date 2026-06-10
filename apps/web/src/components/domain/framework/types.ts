// LifeNavigator Domain Framework — shared contract types.
// Every domain (Career, Health, Education, Family, future: Legal/Insurance/Estate/Business/Military)
// inherits these so the platform is ONE operating system: only the data changes, never the structure.
import type { ReactNode } from 'react';

export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type DomainStatus = 'not_started' | 'started' | 'partial' | 'complete';

export interface DomainNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  beta?: boolean;
}

/** Where a metric came from — no orphan numbers. */
export interface SourceAttribution {
  source: string; // "Plaid Sandbox Persona" | "User Uploaded Resume" | "Advisor Discovery"
  updated?: string; // "Today" | "2 days ago"
  confidence?: Confidence;
}

/** The universal coverage model every domain Overview renders. */
export interface CoverageModel {
  coverage_pct: number;
  confidence_pct?: number;
  known: string[]; // What we know
  missing: string[]; // What we still need
  unlocks?: string[]; // What providing the missing inputs unlocks
  next_action?: { label: string; href?: string } | null;
  last_updated?: string;
  source?: SourceAttribution;
  status?: DomainStatus;
}

/** Per-domain configuration that drives the shared layout + sidebar. */
export interface DomainConfig {
  key: string; // 'career'
  label: string; // 'Career'
  basePath: string; // '/dashboard/career'
  nav: DomainNavItem[];
  tagline?: string;
}
