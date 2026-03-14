/**
 * Stubs for next-auth — replaced by Supabase auth.
 * Returns safe defaults so pages don't crash during SSR/prerender.
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
