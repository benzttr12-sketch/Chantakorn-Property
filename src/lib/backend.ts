import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

export type BackendType = 'local' | 'supabase' | 'firebase';

const configuredBackend = (process.env.NEXT_PUBLIC_DATA_BACKEND || '').trim().toLowerCase();

export const dataBackend: BackendType = (() => {
  if (configuredBackend === 'local' || configuredBackend === 'supabase' || configuredBackend === 'firebase') {
    return configuredBackend as BackendType;
  }
  if (isFirebaseConfigured) return 'firebase';
  if (isSupabaseConfigured) return 'supabase';
  return 'local';
})();

export const isDemoMode = dataBackend === 'local';

export const isDemoAuthEnabled: boolean = (() => {
  if (dataBackend !== 'local') return false;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
})();
