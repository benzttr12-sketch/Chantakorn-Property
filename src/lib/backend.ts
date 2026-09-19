import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';

// Use one backend for an entire session.
// Firebase Firestore is the primary cloud database configured for this application.
const configuredBackend = process.env.NEXT_PUBLIC_DATA_BACKEND;
export const dataBackend: 'local' | 'supabase' | 'firebase' =
  isFirebaseConfigured
    ? 'firebase'
    : configuredBackend === 'supabase' && isSupabaseConfigured
    ? 'supabase'
    : configuredBackend === 'firebase'
    ? 'firebase'
    : configuredBackend === 'local'
    ? 'local'
    : isSupabaseConfigured
    ? 'supabase'
    : 'local';
export const isDemoMode = dataBackend === 'local';
export const isDemoAuthEnabled =
  isDemoMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
