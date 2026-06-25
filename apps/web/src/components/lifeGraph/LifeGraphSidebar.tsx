'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Compass,
  Sparkles,
  FileText,
  DollarSign,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Users,
  Network,
  FolderOpen,
  Database,
  Target,
  GitBranch,
  SlidersHorizontal,
  Settings,
  Plug,
  UserCircle,
} from 'lucide-react';

const GROUPS: {
  title: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Life', href: '/dashboard/my-life', icon: Compass },
      { label: 'Recommendations', href: '/dashboard/recommendations', icon: Sparkles },
      { label: 'Reports', href: '/dashboard/reports', icon: FileText },
    ],
  },
  {
    title: 'Domains',
    items: [
      { label: 'Finance', href: '/dashboard/finance/overview', icon: DollarSign },
      { label: 'Career', href: '/dashboard/career', icon: Briefcase },
      { label: 'Education', href: '/dashboard/education', icon: GraduationCap },
      { label: 'Health', href: '/dashboard/wellness', icon: HeartPulse },
      { label: 'Family', href: '/dashboard/family', icon: Users },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      { label: 'Life Graph', href: '/life-graph/explainable', icon: Network },
      { label: 'Documents', href: '/dashboard/documents', icon: FolderOpen },
      { label: 'Data Sources', href: '/dashboard/documents', icon: Database },
    ],
  },
  {
    title: 'Planning',
    items: [
      { label: 'Goals', href: '/goals/create', icon: Target },
      { label: 'Scenarios', href: '/dashboard/scenario-lab', icon: GitBranch },
      { label: 'What If Analysis', href: '/dashboard/scenario-lab', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Preferences', href: '/dashboard/settings/preferences', icon: Settings },
      { label: 'Integrations', href: '/dashboard/settings/preferences', icon: Plug },
      { label: 'Account', href: '/dashboard/profile', icon: UserCircle },
    ],
  },
];

export default function LifeGraphSidebar({ active = 'Life Graph' }: { active?: string }) {
  return (
    <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-white/5 bg-[#0a0c14]/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-white/5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
          <Network className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">LifeNavigator</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {g.title}
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const isActive = it.label === active;
                const Icon = it.icon;
                return (
                  <Link
                    key={it.label}
                    href={it.href}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-400/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${isActive ? 'text-violet-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                    />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
