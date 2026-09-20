// Firebase is the production backend. Local mode is an explicit read-only preview.
export const dataBackend: 'local' | 'firebase' = process.env.NEXT_PUBLIC_DATA_BACKEND === 'local' ? 'local' : 'firebase';
export const isDemoMode = dataBackend === 'local';
