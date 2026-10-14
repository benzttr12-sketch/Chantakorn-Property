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
