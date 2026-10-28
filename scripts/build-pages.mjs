import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

// The explicit backend keeps a local .env.local out of the public demo build.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  STATIC_EXPORT: 'true',
  NEXT_PUBLIC_DATA_BACKEND: process.env.DEPLOY_DATA_BACKEND || 'local',
  NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: process.env.DEPLOY_PROPERTY_BACKEND || 'firebase',
  NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: process.env.DEPLOY_CLOUDFLARE_API_ORIGIN || '',
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
if (env.NEXT_PUBLIC_DATA_BACKEND === 'local') {
  for (const key of [
    'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]) env[key] = '';
}
if (env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND === 'cloudflare') {
  // The static site has no API routes; the listing catalog must come from the Worker.
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN)) {
    throw new Error('DEPLOY_CLOUDFLARE_API_ORIGIN must be an https origin (no path) when DEPLOY_PROPERTY_BACKEND=cloudflare');
  }
}

/** Page every published D1 listing under its slug, id and CK code, like the sample data. */
async function cloudflareStaticSlugs() {
  const origin = env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN;
  const slugs = [];
  const visited = new Set();
  let cursor = null;
  for (let page = 0; page < 100; page++) {
    const url = new URL('/v1/properties', origin);
    url.searchParams.set('limit', '30');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Catalog fetch failed: HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('Invalid catalog page');
    for (const row of body.data) {
      if (typeof row.slug !== 'string' || !/^[\p{L}\p{N}_-]{1,120}$/u.test(row.slug)) continue;
      slugs.push(row.slug);
      if (typeof row.id === 'string' && /^[\p{L}\p{N}_-]{1,120}$/u.test(row.id)) slugs.push(row.id);
      if (typeof row.code === 'string' && /^[\p{L}\p{N}_-]{1,120}$/u.test(row.code)) slugs.push(row.code);
    }
    if (body.next_cursor === null) return slugs;
    if (typeof body.next_cursor !== 'string' || !body.next_cursor || visited.has(body.next_cursor))
      throw new Error('Invalid catalog cursor');
    visited.add(body.next_cursor);
    cursor = body.next_cursor;
  }
  throw new Error('Catalog exceeds static export budget');
}

const workspaceRoot = realpathSync(process.cwd());
function workspacePath(path) {
  const target = resolve(workspaceRoot, path);
  const part = relative(workspaceRoot, target);
  if (!part || part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part))
    throw new Error('Pages build staging must stay inside the workspace');
  return target;
}
// /tmp may be a different filesystem on CI. Keep rename backups outside app/
// but on the checkout filesystem; .tools/ is ignored and Next never cleans it.
const stagingParent = workspacePath('.tools');
mkdirSync(stagingParent, { recursive: true });
const staging = workspacePath(mkdtempSync(join(workspacePath(realpathSync(stagingParent)), 'pages-build-')));
const apiRoutes = workspacePath('src/app/api');
const apiBackup = workspacePath(join(staging, 'api'));
const propertyPage = workspacePath('src/app/properties/[slug]/page.tsx');
const propertyClient = workspacePath('src/app/properties/[slug]/pages-build-client.tsx');
const routesModule = workspacePath('src/lib/generated-static-routes.ts');
const routesBackup = workspacePath(join(staging, 'generated-static-routes.ts'));
let apiMoved = false;
let pageMoved = false;
let routesMoved = false;

/** Sample listing link keys (slug/id) read from the demo data source. */
function samplePropertyKeys() {
  const source = readFileSync(workspacePath('src/data/sample-properties.ts'), 'utf8');
  const keys = new Set();
  for (const match of source.matchAll(/^\s*(?:slug|id)\s*:\s*'([^']{1,120})'/gm)) keys.add(match[1]);
  return [...keys];
}

try {
  // Pages has no server runtime. Vercel keeps the original API and dynamic routes.
  if (existsSync(apiBackup) || existsSync(propertyClient) || existsSync(routesBackup))
    throw new Error('A temporary Pages build backup already exists');
  renameSync(apiRoutes, apiBackup);
  apiMoved = true;
  renameSync(propertyPage, propertyClient);
  pageMoved = true;

  // The detail page is a client component that hydrates from the Worker API,
  // but static export still needs one route per listing at build time.
  const sampleKeys = samplePropertyKeys();
  let extraKeys = [];
  if (env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND === 'cloudflare') {
    extraKeys = await cloudflareStaticSlugs();
  }
  const allKeys = [...new Set([...sampleKeys, ...extraKeys])];
  console.log(`Pages build: ${allKeys.length} listing routes (${sampleKeys.length} sample + ${extraKeys.length} from D1)`);

  // Let propertyHref emit pretty /properties/<key> links only for pages this
  // build really generates; listings added later fall back to the query route.
  renameSync(routesModule, routesBackup);
  routesMoved = true;
  writeFileSync(routesModule, `// Generated by scripts/build-pages.mjs during the static build; restored afterwards.
export const BUILT_PROPERTY_ROUTES: readonly string[] = ${JSON.stringify(allKeys)};
`);

  writeFileSync(propertyPage, `import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { formatPropertyCode } from '@/lib/format-code';
import PropertyPage from './pages-build-client';
export const dynamicParams = false;
const D1_KEYS: string[] = ${JSON.stringify(extraKeys)};
export function generateStaticParams() {
  const keys = SAMPLE_PROPERTIES.flatMap(property => [
    property.slug,
    property.id,
    formatPropertyCode(property.id),
  ]).filter(Boolean).concat(D1_KEYS);
  return [...new Set(keys)].map(slug => ({ slug }));
}
export default function PropertyDetailPage() { return <PropertyPage />; }
`);
  const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    cwd: workspaceRoot, env, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Static export failed with exit code ${result.status || 1}`);
  writeFileSync(workspacePath('.next-pages/.nojekyll'), '');
} finally {
  const failures = [];
  for (const [moved, backup, original, generated] of [
    [routesMoved, routesBackup, routesModule, true],
    [pageMoved, propertyClient, propertyPage, true],
    [apiMoved, apiBackup, apiRoutes, false],
  ]) {
    if (!moved) continue;
    try {
      if (generated && existsSync(original)) unlinkSync(original);
      renameSync(backup, original);
    } catch (error) { failures.push(error); }
  }
  // Never recursively remove a staging directory: failed backups must survive.
  if (!failures.length) {
    try { rmdirSync(staging); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'Pages build source restoration failed; backups retained in ' + staging);
}
