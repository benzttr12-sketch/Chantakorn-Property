import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// Production Backend configuration
export const dataBackend: 'local' | 'supabase' | 'firebase' = (() => {
  if (isFirebaseConfigured) return 'firebase';
  if (isSupabaseConfigured) return 'supabase';
  return 'firebase';
})();

export const isDemoMode = false;
export const isDemoAuthEnabled = false;
