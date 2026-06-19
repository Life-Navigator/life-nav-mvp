'use client';

import {
  AcademicCapIcon,
  BookOpenIcon,
  DocumentCheckIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { EntityCrudSection } from '@/components/domain/EntityCrudSection';
import { period } from '@/lib/format/period';

const DEGREE_LABEL: Record<string, string> = {
  high_school: 'High School Diploma',
  associate: "Associate's",
  bachelor: "Bachelor's",
  master: "Master's",
  doctorate: 'Doctorate',
  certificate: 'Certificate',
  bootcamp: 'Bootcamp',
};

// Education → comprehensive credentials hub: degrees & diplomas, college classes,
// certificates, and licenses. Schools/issuers are picked from the global catalog (with
// logos); everything persists to the real education tables via /api/education/[entity].
export default function EducationCredentialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Education</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Degrees, diplomas, classes, certificates, and licenses — your full educational record.
        </p>
      </div>

      <EntityCrudSection
        apiBase="/api/education"
        slug="degrees"
        title="Degrees & Diplomas"
        description="High school, college, and graduate degrees"
        icon={<AcademicCapIcon className="w-5 h-5" />}
        emptyHint="Add your high school diploma and college degrees."
        fields={[
          {
            name: 'school',
            label: 'School',
            type: 'school',
            placeholder: 'Search your school or type it…',
            mapTo: { name: 'institution_name', domain: 'school_domain', logo: 'school_logo_url' },
          },
          {
            name: 'degree_type',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'high_school', label: 'High School Diploma' },
              { value: 'associate', label: "Associate's" },
              { value: 'bachelor', label: "Bachelor's" },
              { value: 'master', label: "Master's" },
              { value: 'doctorate', label: 'Doctorate' },
              { value: 'certificate', label: 'Certificate' },
              { value: 'bootcamp', label: 'Bootcamp' },
            ],
          },
          { name: 'field_of_study', label: 'Field of study', placeholder: 'e.g. Computer Science' },
          { name: 'gpa', label: 'GPA', type: 'number' },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'graduation_date', label: 'Graduation date', type: 'date' },
          {
            name: 'is_current',
            label: 'Currently enrolled',
            type: 'checkbox',
            placeholder: "I'm still studying here",
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'withdrawn', label: 'Withdrawn' },
            ],
          },
        ]}
        display={{
          title: (i) =>
            i.field_of_study
              ? `${DEGREE_LABEL[i.degree_type] || 'Degree'} · ${i.field_of_study}`
              : DEGREE_LABEL[i.degree_type] || 'Degree',
          subtitle: (i) => i.institution_name,
          logoName: (i) => i.institution_name || '?',
          logoUrl: (i) => i.school_logo_url,
          badge: (i) =>
            i.is_current
              ? { label: 'Enrolled', tone: 'green' }
              : i.status === 'completed'
                ? { label: 'Completed', tone: 'blue' }
                : undefined,
          meta: (i) => [
            period(i.start_date, i.graduation_date || i.end_date, i.is_current),
            i.gpa ? `GPA ${i.gpa}` : undefined,
          ],
        }}
      />

      <EntityCrudSection
        apiBase="/api/education"
        slug="classes"
        title="College Classes & Courses"
        description="Individual courses, online or in person"
        icon={<BookOpenIcon className="w-5 h-5" />}
        emptyHint="Add notable classes and online courses."
        fields={[
          {
            name: 'provider',
            label: 'Provider / School',
            type: 'school',
            placeholder: 'Search provider or type it…',
            mapTo: { name: 'provider' },
          },
          { name: 'course_name', label: 'Course name', placeholder: 'e.g. Machine Learning' },
          { name: 'level', label: 'Level', placeholder: 'e.g. Graduate' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'planned', label: 'Planned' },
            ],
          },
          { name: 'progress_percent', label: 'Progress %', type: 'number' },
          { name: 'url', label: 'Link', placeholder: 'https://…' },
          { name: 'completion_date', label: 'Completed on', type: 'date' },
          { name: 'cost', label: 'Cost ($)', type: 'number' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        display={{
          title: (i) => i.course_name || 'Course',
          subtitle: (i) => i.provider,
          logoName: (i) => i.provider || i.course_name || '?',
          badge: (i) =>
            i.status === 'completed' ? { label: 'Completed', tone: 'blue' } : undefined,
          meta: (i) => [
            i.level,
            i.completion_date ? period(i.completion_date) : undefined,
            i.progress_percent != null && i.status !== 'completed'
              ? `${i.progress_percent}%`
              : undefined,
          ],
        }}
      />

      <EntityCrudSection
        apiBase="/api/education"
        slug="certificates"
        title="Certificates"
        description="Professional and online certifications"
        icon={<DocumentCheckIcon className="w-5 h-5" />}
        emptyHint="Add certificates you've earned."
        fields={[
          {
            name: 'issuer',
            label: 'Issuer',
            type: 'school',
            placeholder: 'Search issuer (AWS, Google, Coursera…) or type it',
            mapTo: { name: 'issuer', domain: 'issuer_domain', logo: 'logo_url' },
          },
          { name: 'name', label: 'Certificate name', placeholder: 'e.g. AWS Solutions Architect' },
          { name: 'credential_id', label: 'Credential ID', placeholder: 'Optional' },
          { name: 'issued_date', label: 'Issued', type: 'date' },
          { name: 'expires_date', label: 'Expires', type: 'date' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'in_progress', label: 'In progress' },
            ],
          },
        ]}
        display={{
          title: (i) => i.name || 'Certificate',
          subtitle: (i) => i.issuer,
          logoName: (i) => i.issuer || i.name || '?',
          logoUrl: (i) => i.logo_url,
          badge: (i) =>
            i.status
              ? { label: i.status, tone: i.status === 'active' ? 'green' : 'slate' }
              : undefined,
          meta: (i) => [
            i.issued_date ? `Issued ${period(i.issued_date)}` : undefined,
            i.expires_date ? `Expires ${period(i.expires_date)}` : undefined,
          ],
        }}
      />

      <EntityCrudSection
        apiBase="/api/education"
        slug="licenses"
        title="Licenses"
        description="Professional and state licenses"
        icon={<IdentificationIcon className="w-5 h-5" />}
        emptyHint="Add professional or state licenses."
        fields={[
          {
            name: 'authority',
            label: 'Issuing authority',
            type: 'school',
            placeholder: 'Search authority or type it…',
            mapTo: { name: 'issuing_authority', domain: 'issuer_domain', logo: 'logo_url' },
          },
          { name: 'name', label: 'License name', placeholder: 'e.g. Registered Nurse (RN)' },
          { name: 'license_number', label: 'License #', placeholder: 'Optional' },
          { name: 'state', label: 'State / region', placeholder: 'e.g. CA' },
          { name: 'issued_date', label: 'Issued', type: 'date' },
          { name: 'expires_date', label: 'Expires', type: 'date' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'pending', label: 'Pending' },
            ],
          },
        ]}
        display={{
          title: (i) => i.name || 'License',
          subtitle: (i) => i.issuing_authority,
          logoName: (i) => i.issuing_authority || i.name || '?',
          logoUrl: (i) => i.logo_url,
          badge: (i) =>
            i.status
              ? { label: i.status, tone: i.status === 'active' ? 'green' : 'slate' }
              : undefined,
          meta: (i) => [
            i.state,
            i.issued_date ? `Issued ${period(i.issued_date)}` : undefined,
            i.expires_date ? `Expires ${period(i.expires_date)}` : undefined,
          ],
        }}
      />
    </div>
  );
}
