'use client';

import { FlagIcon } from '@heroicons/react/24/outline';
import { EntityCrudSection } from '@/components/domain/EntityCrudSection';
import { period } from '@/lib/format/period';

// Career → Goals: aspirational jobs/careers the user is working toward (career.career_goals).
export default function CareerGoalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Career Goals</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          The roles and careers you&apos;re working toward.
        </p>
      </div>

      <EntityCrudSection
        apiBase="/api/career"
        slug="goals"
        title="Goal jobs & careers"
        description="Where you want your career to go"
        icon={<FlagIcon className="w-5 h-5" />}
        emptyHint="Add a target role or career you're aiming for."
        fields={[
          { name: 'title', label: 'Goal', placeholder: 'e.g. Become a CEO' },
          {
            name: 'target_role',
            label: 'Target role',
            placeholder: 'e.g. Chief Executive Officer',
          },
          {
            name: 'goal_type',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'advancement', label: 'Advancement / promotion' },
              { value: 'transition', label: 'Career change' },
              { value: 'entrepreneurship', label: 'Start a business' },
              { value: 'skill', label: 'Skill / specialization' },
            ],
          },
          { name: 'target_total_comp', label: 'Target comp ($)', type: 'number' },
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
          logoName: (i) => i.target_role || i.title || '?',
          badge: (i) =>
            i.goal_type
              ? { label: String(i.goal_type).replace(/_/g, ' '), tone: 'amber' }
              : undefined,
          meta: (i) => [
            i.target_date ? `Target ${period(i.target_date)}` : undefined,
            i.target_total_comp ? `$${Number(i.target_total_comp).toLocaleString()}` : undefined,
          ],
        }}
      />
    </div>
  );
}
