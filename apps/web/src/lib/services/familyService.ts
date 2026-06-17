// Family CRUD service — writes to the `family` schema (tables already exist, migration 131), RLS-isolated
// by user_id. Mirrors educationService. Used by the /api/family/* routes.
type SB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const SCHEMA = 'family';

export interface DependentInput {
  relationship?: string;
  birth_year?: number | null;
}

export async function listDependents(sb: SB, userId: string) {
  const { data, error } = await sb
    .schema(SCHEMA)
    .from('dependents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDependent(sb: SB, userId: string, input: DependentInput) {
  const row = {
    user_id: userId,
    relationship: (input.relationship || 'child').toString().slice(0, 40),
    birth_year:
      input.birth_year == null || Number.isNaN(Number(input.birth_year))
        ? null
        : Math.trunc(Number(input.birth_year)),
  };
  const { data, error } = await sb.schema(SCHEMA).from('dependents').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDependent(sb: SB, userId: string, id: string) {
  const { error } = await sb
    .schema(SCHEMA)
    .from('dependents')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

// ── Generic family-entity CRUD (emergency_contacts / beneficiaries / trusted_advisors) ──
// Slug → { table, allowed fields, optional numeric/boolean coercion, required field }. Only allow-listed
// fields are written (no arbitrary columns); numeric/boolean are coerced to match column types.
export interface EntityDef {
  table: string;
  fields: string[];
  numeric?: string[];
  boolean?: string[];
  requiredField?: string; // defaults to 'name'
}

export const FAMILY_ENTITIES: Record<string, EntityDef> = {
  'emergency-contacts': {
    table: 'emergency_contacts',
    fields: ['name', 'relationship', 'phone', 'email'],
  },
  beneficiaries: {
    table: 'beneficiaries',
    fields: ['name', 'relationship', 'account_type', 'allocation_pct'],
    numeric: ['allocation_pct'],
  },
  'trusted-advisors': {
    table: 'trusted_advisors',
    fields: ['name', 'advisor_type', 'firm', 'email', 'phone'],
  },
  members: {
    table: 'family_members',
    fields: [
      'name',
      'relationship',
      'date_of_birth',
      'age',
      'is_dependent',
      'lives_in_household',
      'school_name',
      'grade_level',
      'college_planning_status',
      'financial_dependency_level',
      'special_needs_notes',
      'emergency_priority',
      'notes',
    ],
    numeric: ['age', 'emergency_priority'],
    boolean: ['is_dependent', 'lives_in_household'],
  },
  pets: {
    table: 'pets',
    fields: [
      'name',
      'species',
      'breed',
      'age',
      'date_of_birth',
      'medical_needs',
      'medications',
      'vet_name',
      'vet_phone',
      'insurance_provider',
      'monthly_cost_estimate',
      'emergency_care_notes',
      'notes',
    ],
    numeric: ['age', 'monthly_cost_estimate'],
  },
  guardianship: {
    table: 'guardianship',
    fields: [
      'guardian_name',
      'relationship',
      'backup_guardian',
      'legal_doc_status',
      'children_covered',
      'notes',
    ],
    requiredField: 'guardian_name',
  },
};

export function resolveEntity(slug: string): EntityDef | null {
  return FAMILY_ENTITIES[slug] ?? null;
}

function coerceBool(v: unknown): boolean {
  return v === true || ['true', 'yes', 'on', '1'].includes(String(v).toLowerCase());
}

export async function listEntity(sb: SB, userId: string, table: string) {
  const { data, error } = await sb
    .schema(SCHEMA)
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createEntity(
  sb: SB,
  userId: string,
  def: EntityDef,
  body: Record<string, unknown>
) {
  const numeric = new Set(def.numeric ?? []);
  const boolean = new Set(def.boolean ?? []);
  const row: Record<string, unknown> = { user_id: userId };
  for (const f of def.fields) {
    const v = body[f];
    if (v === undefined || v === '' || v === null) continue;
    if (numeric.has(f)) {
      const n = Number(v);
      if (!Number.isNaN(n)) row[f] = n; // skip non-numeric instead of inserting NaN
    } else if (boolean.has(f)) {
      row[f] = coerceBool(v);
    } else {
      row[f] = String(v).slice(0, 500);
    }
  }
  const required = def.requiredField ?? 'name';
  if (!row[required]) throw new Error(`${required} is required`);
  const { data, error } = await sb.schema(SCHEMA).from(def.table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntity(sb: SB, userId: string, table: string, id: string) {
  const { error } = await sb.schema(SCHEMA).from(table).delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
