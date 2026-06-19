'use client';

import { BriefcaseIcon, HeartIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { EntityCrudSection } from '@/components/domain/EntityCrudSection';
import { period } from '@/lib/format/period';

// Career → Experience: employment history (current + previous), volunteer work, and side
// projects. All persist to the real career.* tables via /api/career/[entity].
export default function CareerExperiencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Experience</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Your work, volunteering, and side projects — the full picture of what you&apos;ve done.
        </p>
      </div>

      <EntityCrudSection
        apiBase="/api/career"
        slug="experience"
        title="Employment"
        description="Current and previous jobs"
        icon={<BriefcaseIcon className="w-5 h-5" />}
        emptyHint="Add your current role and past positions."
        fields={[
          {
            name: 'employer',
            label: 'Employer',
            type: 'school',
            placeholder: 'Search employer or type your own…',
            mapTo: { name: 'employer', domain: 'employer_domain', logo: 'employer_logo_url' },
          },
          { name: 'title', label: 'Job title', placeholder: 'e.g. Senior Product Manager' },
          { name: 'industry', label: 'Industry', placeholder: 'e.g. Technology' },
          { name: 'location', label: 'Location', placeholder: 'e.g. San Francisco, CA' },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          {
            name: 'is_current',
            label: 'Current role',
            type: 'checkbox',
            placeholder: 'I currently work here',
          },
          {
            name: 'responsibilities',
            label: 'What you did',
            type: 'textarea',
            placeholder: 'Key responsibilities and impact…',
          },
        ]}
        display={{
          title: (i) => i.title || i.employer || 'Role',
          subtitle: (i) => i.employer,
          logoName: (i) => i.employer || i.title || '?',
          logoUrl: (i) => i.employer_logo_url,
          badge: (i) => (i.is_current ? { label: 'Current', tone: 'green' } : undefined),
          meta: (i) => [period(i.start_date, i.end_date, i.is_current), i.location, i.industry],
        }}
      />

      <EntityCrudSection
        apiBase="/api/career"
        slug="volunteer"
        title="Volunteer work"
        description="Causes and organizations you give time to"
        icon={<HeartIcon className="w-5 h-5" />}
        emptyHint="Add volunteer roles and the causes you support."
        fields={[
          { name: 'organization', label: 'Organization', placeholder: 'e.g. Habitat for Humanity' },
          { name: 'role', label: 'Role', placeholder: 'e.g. Mentor' },
          { name: 'cause_area', label: 'Cause area', placeholder: 'e.g. Education' },
          { name: 'hours_per_month', label: 'Hours / month', type: 'number' },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          {
            name: 'is_current',
            label: 'Ongoing',
            type: 'checkbox',
            placeholder: "I'm still involved",
          },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]}
        display={{
          title: (i) => i.role || i.organization || 'Volunteer',
          subtitle: (i) => i.organization,
          logoName: (i) => i.organization || '?',
          badge: (i) => (i.is_current ? { label: 'Ongoing', tone: 'green' } : undefined),
          meta: (i) => [
            period(i.start_date, i.end_date, i.is_current),
            i.cause_area,
            i.hours_per_month ? `${i.hours_per_month} hrs/mo` : undefined,
          ],
        }}
      />

      <EntityCrudSection
        apiBase="/api/career"
        slug="side-projects"
        title="Side jobs & projects"
        description="Freelance, side businesses, and personal projects"
        icon={<RocketLaunchIcon className="w-5 h-5" />}
        emptyHint="Add freelance work, side businesses, or notable projects."
        fields={[
          { name: 'name', label: 'Name', placeholder: 'e.g. Indie iOS app' },
          { name: 'role', label: 'Your role', placeholder: 'e.g. Founder' },
          {
            name: 'project_type',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'freelance', label: 'Freelance' },
              { value: 'side_business', label: 'Side business' },
              { value: 'open_source', label: 'Open source' },
              { value: 'personal', label: 'Personal project' },
              { value: 'other', label: 'Other' },
            ],
          },
          { name: 'url', label: 'Link', placeholder: 'https://…' },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          { name: 'is_active', label: 'Active', type: 'checkbox', placeholder: "It's still going" },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]}
        display={{
          title: (i) => i.name || 'Project',
          subtitle: (i) => i.role || i.project_type,
          logoName: (i) => i.name || '?',
          badge: (i) => (i.is_active ? { label: 'Active', tone: 'blue' } : undefined),
          meta: (i) => [period(i.start_date, i.end_date, i.is_active), i.url],
        }}
      />
    </div>
  );
}
