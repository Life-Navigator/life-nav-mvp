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
