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
// Slug → { table, allowed fields }. Only allow-listed fields are written (no arbitrary columns).
export const FAMILY_ENTITIES: Record<string, { table: string; fields: string[] }> = {
  'emergency-contacts': {
    table: 'emergency_contacts',
    fields: ['name', 'relationship', 'phone', 'email'],
  },
  beneficiaries: {
    table: 'beneficiaries',
    fields: ['name', 'relationship', 'account_type', 'allocation_pct'],
  },
  'trusted-advisors': {
    table: 'trusted_advisors',
    fields: ['name', 'advisor_type', 'firm', 'email', 'phone'],
  },
};

export function resolveEntity(slug: string) {
  return FAMILY_ENTITIES[slug] ?? null;
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
  table: string,
  fields: string[],
  body: Record<string, unknown>
) {
  const row: Record<string, unknown> = { user_id: userId };
  for (const f of fields) {
    if (body[f] === undefined || body[f] === '') continue;
    row[f] = f === 'allocation_pct' ? Number(body[f]) : String(body[f]).slice(0, 200);
  }
  if (!row.name) throw new Error('name is required');
  const { data, error } = await sb.schema(SCHEMA).from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntity(sb: SB, userId: string, table: string, id: string) {
  const { error } = await sb.schema(SCHEMA).from(table).delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
