import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The explicit backend keeps a local .env.local out of the public demo build.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  STATIC_EXPORT: 'true',
  NEXT_PUBLIC_DATA_BACKEND: process.env.DEPLOY_DATA_BACKEND || 'local',
  NEXT_PUBLIC_ENABLE_DEMO_AUTH: process.env.DEPLOY_DEMO_AUTH || 'false',
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
if (env.NEXT_PUBLIC_DATA_BACKEND === 'local') {
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]) env[key] = '';
}
const apiRoutes = resolve('src/app/api');
const apiBackup = join(tmpdir(), `chantakorn-pages-api-${process.pid}`);
const propertyPage = resolve('src/app/properties/[slug]/page.tsx');
const propertyClient = resolve('src/app/properties/[slug]/pages-build-client.tsx');
let apiMoved = false;
let pageMoved = false;

try {
  // Pages has no server runtime. Vercel keeps the original API and dynamic routes.
  if (existsSync(apiBackup) || existsSync(propertyClient)) throw new Error('A temporary Pages build backup already exists');
  renameSync(apiRoutes, apiBackup);
  apiMoved = true;
  renameSync(propertyPage, propertyClient);
  pageMoved = true;
  writeFileSync(propertyPage, `import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import PropertyPage from './pages-build-client';
export const dynamicParams = false;
export function generateStaticParams() {
  return SAMPLE_PROPERTIES.filter(property => property.slug).map(property => ({ slug: property.slug }));
}
export default function PropertyDetailPage() { return <PropertyPage />; }
`);
  const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    env, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Static export failed with exit code ${result.status || 1}`);
  writeFileSync('.next-pages/.nojekyll', '');
} finally {
  if (pageMoved) {
    unlinkSync(propertyPage);
    renameSync(propertyClient, propertyPage);
  }
  if (apiMoved) renameSync(apiBackup, apiRoutes);
}
