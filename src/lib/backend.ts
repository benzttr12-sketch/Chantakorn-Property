import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// Backend selection:
// If a backend is explicitly selected and configured with credentials, use it.
// If an unconfigured backend is specified (e.g. Supabase without credentials),
// automatically fall back to Firebase (if configured) or local storage to prevent errors.
const configuredBackend = process.env.NEXT_PUBLIC_DATA_BACKEND;
export const dataBackend: 'local' | 'supabase' | 'firebase' = (() => {
  if (configuredBackend === 'local') return 'local';
  if (configuredBackend === 'supabase' && isSupabaseConfigured) return 'supabase';
  if (configuredBackend === 'firebase' && isFirebaseConfigured) return 'firebase';

  if (isFirebaseConfigured) return 'firebase';
  if (isSupabaseConfigured) return 'supabase';
  return 'local';
})();

export const isDemoMode = dataBackend === 'local';
export const isDemoAuthEnabled =
  isDemoMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
