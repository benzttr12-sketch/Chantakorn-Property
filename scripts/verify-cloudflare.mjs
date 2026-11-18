import { pathToFileURL } from 'node:url';

const JSON_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 2 * 1024 * 1024;
const productionOrigins = ['https://chantakornproperty.com', 'https://www.chantakornproperty.com'];

function origin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Expected an HTTPS origin without a path or credentials');
  }
  return url.origin;
}

async function readBytes(response, limit) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Unexpected HTTP status ${response.status}`);
  }
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body.cancel();
    throw new Error('Response exceeds the verification byte limit');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Response exceeds the verification byte limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** Anonymous GET requests only: never submit inquiries, send LINE, or mutate data. */
export async function verifyCloudflare({ apiOrigin, siteOrigins = productionOrigins, requireListings = false, fetchImpl = fetch }) {
  const api = origin(apiOrigin);
  check(siteOrigins.length > 0 && siteOrigins.length <= 10, 'Provide between one and ten website origins');
  const sites = [...new Set(siteOrigins.map(origin))];
  const signal = AbortSignal.timeout(60_000);
  const checks = [];
  const request = (path, site) => fetchImpl(api + path, {
    method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
    ...(site ? { headers: { Origin: site } } : {}),
  });
  const checkedBytes = async (response, limit, inspect = () => {}) => {
    try {
      inspect(response);
      return await readBytes(response, limit);
    } finally {
      if (response.body && !response.bodyUsed) await response.body.cancel().catch(() => undefined);
    }
  };
  const json = async (response, inspect) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await checkedBytes(response, JSON_LIMIT, inspect)));
  const health = await json(await request('/health'));
  check(health?.ok === true || health?.status === 'ok', 'Worker health response is invalid');
  checks.push('worker-health');

  let sample;
  for (const site of sites) {
    const response = await request('/v1/properties?limit=1', site);
    const page = await json(response, headers => {
      check(headers.headers.get('access-control-allow-origin') === site, 'Website origin is missing from Worker CORS');
      check(/(?:^|,)\s*origin\s*(?:,|$)/i.test(headers.headers.get('vary') || ''), 'Catalog must vary by Origin');
      check(headers.headers.get('cache-control')?.includes('no-store'), 'Catalog must revalidate publication state');
    });
    check(Array.isArray(page?.data) && page.data.length <= 1 &&
      (page.next_cursor === null || (typeof page.next_cursor === 'string' && page.next_cursor.length > 0)), 'Catalog page is invalid');
    for (const row of page.data) {
      check(row?.published === true && row.deleted_at == null && row.deletedAt == null && typeof row.id === 'string' &&
        /^[\p{L}\p{N}_-]{1,120}$/u.test(row.id), 'Catalog returned an invalid or unpublished listing');
    }
    sample ||= page.data[0];
    checks.push(`catalog-cors:${site}`);
  }
  const deniedOrigin = await request('/v1/properties?limit=1', 'https://unapproved.invalid');
  await deniedOrigin.body?.cancel();
  check(!deniedOrigin.headers.get('access-control-allow-origin'), 'Worker allows an unapproved website origin');
  checks.push('unapproved-origin-denied');

  if (!sample) {
    check(!requireListings, 'Catalog is empty; detail and R2 image delivery are unverified');
    return { ok: true, apiOrigin: api, checks, detail: 'unverified-empty-catalog', media: 'unverified-empty-catalog' };
  }
  const detail = await json(await request(`/v1/properties/${encodeURIComponent(sample.id)}`));
  check(detail?.data?.id === sample.id && detail.data.published === true && detail.data.deleted_at == null && detail.data.deletedAt == null, 'Detail does not match the published listing');
  checks.push('published-detail');

  const media = detail.data.cover_image || detail.data.images?.[0];
  check(typeof media === 'string' && media.length > 0, 'Sample listing has no R2 image to verify');
  const mediaUrl = new URL(media, api);
  check(mediaUrl.origin === api && !mediaUrl.username && !mediaUrl.password && !mediaUrl.search && !mediaUrl.hash &&
    /^\/v1\/media\/properties\/[0-9a-f-]{36}$/i.test(mediaUrl.pathname), 'Sample image is not a canonical Worker R2 URL');
  const image = await request(mediaUrl.pathname, sites[0]);
  const bytes = await checkedBytes(image, IMAGE_LIMIT, response => {
    check(response.headers.get('access-control-allow-origin') === sites[0], 'Image origin is missing from Worker CORS');
    check(/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') || ''), 'R2 response is not a supported image');
    const directives = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
    const maxAge = directives.find(value => value.startsWith('max-age='))?.slice(8);
    check(directives.includes('private') && !directives.includes('public') &&
      !directives.some(value => value.startsWith('s-maxage=')) &&
      (directives.includes('no-store') || (/^\d+$/.test(maxAge || '') && Number(maxAge) <= 180)),
    'R2 image cache must be private with at most a three-minute browser lifetime');
  });
  check(bytes.length > 0, 'R2 image is empty');
  checks.push('published-r2-image');
  return { ok: true, apiOrigin: api, checks, detail: 'verified', media: 'verified' };
}

export async function main(args = process.argv.slice(2)) {
  const options = { siteOrigins: [], requireListings: false };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') {
      console.log('Usage: npm run verify:cloudflare -- [--api-origin https://worker.example] [--site-origin https://website.example] [--require-listings]\nAnonymous read-only check; repeat --site-origin for each approved website. No credentials or customer submissions.');
      return;
    }
    if (flag === '--require-listings') { options.requireListings = true; continue; }
    check((flag === '--api-origin' || flag === '--site-origin') && args[index + 1] && !args[index + 1].startsWith('--'), 'Unknown or incomplete verification option');
    const value = args[++index];
    if (flag === '--api-origin') options.apiOrigin = value;
    else options.siteOrigins.push(value);
  }
  if (!options.apiOrigin) {
    const { default: config } = await import('../next.config.mjs');
    options.apiOrigin = config.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN;
  }
  if (!options.siteOrigins.length) options.siteOrigins = productionOrigins;
  console.log(JSON.stringify(await verifyCloudflare(options), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Verification failed' }));
    process.exitCode = 1;
  });
}
