import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseConfigured } from '../config/env';

/**
 * Creates a server Supabase SSR client with strict environment validation.
 * Throws a clear configuration error rather than connecting to placeholder domains.
 */
export async function createClient() {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Safe to ignore when called from Server Component; middleware handles session refresh.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Safe to ignore in Server Component context.
        }
      },
    },
  });
}
