/**
 * Generic, schema-scoped CRUD for domain entities (career, education, …).
 *
 * Mirrors the Family CRUD pattern but parameterized by schema, so each domain just
 * declares an entity registry. Fields are allow-listed (a save can never fail with
 * "column does not exist"), numeric/boolean coerced, required field enforced. All
 * writes go through the user session (RLS: auth.uid() = user_id).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface EntityDef {
  schema: string;
  table: string;
  fields: string[];
  numeric?: string[];
  boolean?: string[];
  requiredField?: string; // defaults to 'name'
}

function coerceBool(v: unknown): boolean {
  return v === true || ['true', 'yes', 'on', '1'].includes(String(v).toLowerCase());
}

export async function listEntity(sb: SB, userId: string, def: EntityDef) {
  const { data, error } = await sb
    .schema(def.schema)
    .from(def.table)
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
      if (!Number.isNaN(n)) row[f] = n;
    } else if (boolean.has(f)) {
      row[f] = coerceBool(v);
    } else {
      row[f] = String(v).slice(0, 1000);
    }
  }
  const required = def.requiredField ?? 'name';
  if (!row[required]) throw new Error(`${required} is required`);
  const { data, error } = await sb.schema(def.schema).from(def.table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntity(sb: SB, userId: string, def: EntityDef, id: string) {
  const { error } = await sb
    .schema(def.schema)
    .from(def.table)
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
