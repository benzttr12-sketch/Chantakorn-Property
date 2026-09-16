import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// Use one backend for an entire session. Supabase includes the staff login used
// by this app; Firebase is a catalog/inquiry adapter without staff authentication.
const configuredBackend = process.env.NEXT_PUBLIC_DATA_BACKEND;
export const dataBackend = configuredBackend === 'local' ? 'local'
  : configuredBackend === 'supabase' ? 'supabase'
  : configuredBackend === 'firebase' ? 'firebase'
  : isSupabaseConfigured ? 'supabase' : isFirebaseConfigured ? 'firebase' : 'local';
export const isDemoMode = dataBackend === 'local';
export const isDemoAuthEnabled = isDemoMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
