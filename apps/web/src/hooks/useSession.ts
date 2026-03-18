/**
 * Legacy session stubs — Supabase Auth is the real auth system.
 * These return safe defaults so pages that still reference useSession don't crash.
 * TODO: Migrate remaining pages to use Supabase auth hooks directly.
 */
export function useSession(): { data: any; status: string; update: () => Promise<any> } {
  return {
    data: null,
    status: 'unauthenticated',
    update: async () => null,
  };
}

export async function getCsrfToken(): Promise<string | undefined> {
  return undefined;
}

export async function getSession(): Promise<any> {
  return null;
}

export function signIn(..._args: any[]) {
  return Promise.resolve(undefined);
}

export function signOut(..._args: any[]) {
  return Promise.resolve(undefined);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return children;
}
