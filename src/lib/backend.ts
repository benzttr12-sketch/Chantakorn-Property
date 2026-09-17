import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// Use one backend for an entire session. Supabase includes the staff login used
// by this app; Firebase is a catalog/inquiry adapter without staff authentication.
const configuredBackend = process.env.NEXT_PUBLIC_DATA_BACKEND;
export const dataBackend: 'local' | 'supabase' | 'firebase' =
  configuredBackend === 'local'
    ? 'local'
    : configuredBackend === 'supabase' && isSupabaseConfigured
    ? 'supabase'
    : configuredBackend === 'firebase' && isFirebaseConfigured
    ? 'firebase'
    : isFirebaseConfigured
    ? 'firebase'
    : isSupabaseConfigured
    ? 'supabase'
    : 'local';
export const isDemoMode = dataBackend === 'local';
export const isDemoAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true' ||
  (isDemoMode || dataBackend === 'firebase');
