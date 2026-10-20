export type BackendType = 'local' | 'firebase';

const configuredBackend = (process.env.NEXT_PUBLIC_DATA_BACKEND || '').trim().toLowerCase();

export const dataBackend: BackendType = (() => {
  if (configuredBackend === 'local' || configuredBackend === 'firebase') {
    return configuredBackend;
  }
  if (configuredBackend) {
    throw new Error('NEXT_PUBLIC_DATA_BACKEND must be firebase or local');
  }
  return 'firebase';
})();

/**
 * Listings may migrate independently of Firebase Auth, LINE, leads and valuation.
 * Default remains Firestore. Unknown explicit modes fail closed.
 */
const configuredPropertyStorage = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'firebase').trim().toLowerCase();
if (configuredPropertyStorage !== 'firebase' && configuredPropertyStorage !== 'cloudflare') {
  throw new Error('NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND must be firebase or cloudflare');
}
export const useCloudflarePropertyBackend = configuredPropertyStorage === 'cloudflare';
