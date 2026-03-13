/**
 * STUB — Prisma client removed during Supabase migration.
 *
 * All API routes that still import `db` from here are stale
 * and will be rewritten to use Supabase directly.
 * This stub exists only to keep type-check passing during migration.
 */

export const db: any = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Prisma has been removed. Use Supabase client instead. See packages/supabase/src/clients.ts'
      );
    },
  }
);
