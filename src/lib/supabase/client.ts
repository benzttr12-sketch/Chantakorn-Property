import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidUrl(value: string | undefined): boolean {
  if (!value || value.includes('your-project-id') || value.includes('YOUR_PROJECT')) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  isValidUrl(supabaseUrl) && supabaseAnonKey && !supabaseAnonKey.includes('...') && !supabaseAnonKey.includes('YOUR_')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
