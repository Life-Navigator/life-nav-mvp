import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createBrowserSupabaseClient, createServerClient as createServerSupabaseClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Browser client — uses anon key, respects RLS via user JWT.
 * Use in React client components.
 */
export function createBrowserClient() {
  return createBrowserSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Server client — uses anon key with cookie-based auth.
 * Use in Next.js server components, API routes, and middleware.
 * Requires cookie store from next/headers.
 */
export function createServerClient(cookieStore: {
  getAll: () => { name: string; value: string }[]
  set: (name: string, value: string, options?: Record<string, unknown>) => void
}) {
  return createServerSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Silently fail in Server Components where cookies can't be set
          }
        },
      },
    }
  )
}

/**
 * Admin client — uses service_role key, bypasses RLS.
 * ONLY use server-side for admin operations. Never expose to browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — admin client is server-only')
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
