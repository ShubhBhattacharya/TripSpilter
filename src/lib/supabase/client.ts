import { createBrowserClient } from '@supabase/ssr';

const PLACEHOLDER_MARKERS = ['your-supabase-url', 'your-project-ref', 'placeholder', 'your-supabase-anon-key'];

function isValidPublicValue(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_MARKERS.some((m) => trimmed.toLowerCase().includes(m));
}

export const isSupabaseConfigured =
  isValidPublicValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  isValidPublicValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Creates a browser Supabase client when credentials are properly configured.
 * Throws explicitly instead of silently connecting to placeholder URLs.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidPublicValue(supabaseUrl) || !isValidPublicValue(supabaseAnonKey)) {
    throw new Error(
      'Supabase client cannot be initialized: configure valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
