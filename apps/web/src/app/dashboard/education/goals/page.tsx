'use client';

import { FlagIcon } from '@heroicons/react/24/outline';
import { EntityCrudSection } from '@/components/domain/EntityCrudSection';
import { period } from '@/lib/format/period';

// Education → Goals: degrees, certificates, or programs the user WANTS to do in the future
// (education.education_goals).
export default function EducationGoalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Education Goals</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Degrees, certificates, and programs you want to pursue.
        </p>
      </div>

      <EntityCrudSection
        apiBase="/api/education"
        slug="goals"
        title="Future learning goals"
        description="What you want to study or earn next"
        icon={<FlagIcon className="w-5 h-5" />}
        emptyHint="Add a degree, certificate, or program you want to pursue."
        fields={[
          { name: 'title', label: 'Goal', placeholder: 'e.g. Executive education at Harvard' },
          {
            name: 'goal_type',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'degree', label: 'Degree' },
              { value: 'credential', label: 'Certificate / credential' },
              { value: 'license', label: 'License' },
              { value: 'program', label: 'Program / course' },
              { value: 'skill', label: 'Skill' },
            ],
          },
          { name: 'target_role', label: 'Why / target', placeholder: 'e.g. CEO readiness' },
          { name: 'target_date', label: 'Target date', type: 'date' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'planned', label: 'Planned' },
              { value: 'achieved', label: 'Achieved' },
            ],
          },
        ]}
        display={{
          title: (i) => i.title || 'Goal',
          subtitle: (i) => i.target_role,
          logoName: (i) => i.title || '?',
          badge: (i) =>
            i.goal_type
              ? { label: String(i.goal_type).replace(/_/g, ' '), tone: 'amber' }
              : undefined,
          meta: (i) => [i.target_date ? `Target ${period(i.target_date)}` : undefined],
        }}
      />
    </div>
  );
}
