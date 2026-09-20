import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Production builds use the versioned Firebase project; preview data is opt-in.
const env = {
  ...process.env,
  STATIC_EXPORT: 'true',
  NEXT_PUBLIC_DATA_BACKEND: process.env.DEPLOY_DATA_BACKEND || 'firebase',
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
if (env.NEXT_PUBLIC_DATA_BACKEND === 'local') {
  for (const key of [
    'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_DATABASE_ID',
  ]) env[key] = '';
}
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  env, stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync('out/.nojekyll', '');
