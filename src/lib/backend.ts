import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// An explicit backend selection is authoritative, even when its credentials are
// missing. This makes configuration errors visible instead of silently switching
// to a different configured backend.
const configuredBackend = process.env.NEXT_PUBLIC_DATA_BACKEND;
export const dataBackend: 'local' | 'supabase' | 'firebase' =
  configuredBackend === 'local' || configuredBackend === 'supabase' || configuredBackend === 'firebase'
    ? configuredBackend
    : isFirebaseConfigured
      ? 'firebase'
      : isSupabaseConfigured
        ? 'supabase'
        : 'local';
export const isDemoMode = dataBackend === 'local';
export const isDemoAuthEnabled =
  isDemoMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
