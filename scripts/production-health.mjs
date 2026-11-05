import tls from 'node:tls';
import { appendFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SITE_ORIGINS = ['https://chantakornproperty.com', 'https://www.chantakornproperty.com'];
export const API_ORIGIN = 'https://chantakorn-property-api.chantakorn-property.workers.dev';
const DOMAIN = 'chantakornproperty.com';
const NAMESERVERS = ['elmo.ns.cloudflare.com', 'megan.ns.cloudflare.com'];
const RESOLVERS = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query'];
const DAY = 86_400_000;
const MAX_BODY = 1_048_576;

class HealthError extends Error {}
function requireHealth(value, code) { if (!value) throw new HealthError(code); }

// No cookies, credentials, POSTs or redirects. Never log response bodies, URLs
// derived from customer records, raw provider errors or certificate subjects.
export async function boundedRequest(url, { fetchImpl = fetch, headers = {}, maxBytes = MAX_BODY, prefixOnly = false } = {}) {
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', credentials: 'omit',
    headers: { 'User-Agent': 'Chantakorn-ReadOnly-Health/1.0', ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!prefixOnly && Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new HealthError('response-too-large');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body || []) {
    if (prefixOnly) {
      const prefix = Buffer.from(chunk).subarray(0, maxBytes - bytes);
      bytes += prefix.byteLength;
      chunks.push(prefix);
      if (bytes >= maxBytes) break; // Async iterator closes/cancels the rest.
      continue;
    }
    bytes += chunk.byteLength;
    if (bytes > maxBytes) throw new HealthError('response-too-large');
    chunks.push(Buffer.from(chunk));
  }
  return { status: response.status, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') };
}

function json(result) {
  requireHealth(/application\/(?:json|dns-json|rdap\+json)/i.test(result.headers.get('content-type') || ''), 'expected-json');
  try { return JSON.parse(result.text); } catch { throw new HealthError('invalid-json'); }
}

export function certificateDays(hostname, now = Date.now()) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true });
    const timer = setTimeout(() => socket.destroy(new Error('TLS timeout')), 10_000);
    socket.once('error', reject);
    socket.once('close', () => clearTimeout(timer));
    socket.once('secureConnect', () => {
      const expires = Date.parse(socket.getPeerCertificate().valid_to);
      socket.end();
      if (!socket.authorized || !Number.isFinite(expires)) reject(new Error('TLS certificate invalid'));
      else resolve(Math.floor((expires - now) / DAY));
    });
  });
}

export async function runProductionChecks({ fetchImpl = fetch, readCertificate = certificateDays, now = Date.now(), attempts = 2 } = {}) {
  const tasks = [];
  const request = (url, options = {}) => boundedRequest(url, { fetchImpl, ...options });
  const add = (id, run) => tasks.push({ id, run });

  for (const [index, resolver] of RESOLVERS.entries()) {
    for (const origin of SITE_ORIGINS) {
      const host = new URL(origin).hostname;
      add(`dns-${index}-${host}`, async () => {
        const result = await request(`${resolver}?name=${host}&type=A`, { headers: { Accept: 'application/dns-json' } });
        requireHealth(result.status === 200, 'dns-http-status');
        const answer = json(result);
        requireHealth(answer.Status === 0, 'dns-resolution-failed');
        requireHealth(answer.Answer?.some(row => row.type === 1 && typeof row.data === 'string'), 'dns-address-missing');
      });
    }
    add(`nameservers-${index}`, async () => {
      const result = await request(`${resolver}?name=${DOMAIN}&type=NS`, { headers: { Accept: 'application/dns-json' } });
      requireHealth(result.status === 200, 'dns-http-status');
      const answer = json(result);
      requireHealth(answer.Status === 0, 'dns-resolution-failed');
      const actual = answer.Answer?.filter(row => row.type === 2).map(row => row.data.toLowerCase().replace(/\.$/, '')).sort();
      requireHealth(JSON.stringify(actual) === JSON.stringify([...NAMESERVERS].sort()), 'nameservers-changed');
    });
  }
  add('registration', async () => {
    const result = await request(`https://rdap.verisign.com/com/v1/domain/${DOMAIN}`);
    requireHealth(result.status === 200, 'registration-http-status');
    const record = json(result);
    requireHealth(record.ldhName?.toLowerCase() === DOMAIN, 'registration-domain-mismatch');
    requireHealth(!record.status?.some(status => /(?:hold|redemption|pending delete)/i.test(status)), 'registration-suspended');
    const expiry = record.events?.find(event => event.eventAction === 'expiration')?.eventDate;
    requireHealth(Date.parse(expiry) - now >= 30 * DAY, 'registration-expiring');
  });

  for (const origin of SITE_ORIGINS) {
    const host = new URL(origin).hostname;
    add(`tls-${host}`, async () => requireHealth(await readCertificate(host, now) >= 14, 'certificate-expiring'));
    for (const pathname of ['/', '/login']) {
      add(`page-${host}${pathname}`, async () => {
        const result = await request(origin + pathname);
        requireHealth(result.status === 200, 'page-http-status');
        requireHealth(result.headers.get('content-type')?.includes('text/html'), 'expected-html');
        requireHealth(/<title>CHANTAKORN PROPERTY/i.test(result.text), 'wrong-website');
        requireHealth(result.headers.get('cross-origin-opener-policy') === 'same-origin-allow-popups', 'popup-policy-changed');
        requireHealth(result.headers.get('content-security-policy')?.includes('https://apis.google.com'), 'google-script-policy-changed');
      });
    }
    add(`auth-helper-${host}`, async () => {
      const result = await request(origin + '/__/auth/iframe.js');
      requireHealth(result.status === 200 && /javascript/.test(result.headers.get('content-type') || ''), 'auth-helper-unavailable');
      requireHealth(result.text.length > 1000, 'auth-helper-empty');
      requireHealth(result.headers.get('cross-origin-opener-policy') === 'unsafe-none', 'auth-helper-opener-policy-changed');
    });
    add(`catalog-${host}`, async () => {
      const result = await request(API_ORIGIN + '/v1/properties?limit=1', { headers: { Origin: origin } });
      requireHealth(result.status === 200, 'catalog-http-status');
      requireHealth(result.headers.get('access-control-allow-origin') === origin, 'catalog-origin-denied');
      const payload = json(result);
      requireHealth(Array.isArray(payload.data) && payload.data.length <= 1 &&
        (payload.next_cursor === null || typeof payload.next_cursor === 'string'), 'catalog-schema-invalid');
      if (!payload.data.length) return; // An intentionally empty catalog is valid.
      const property = payload.data[0];
      requireHealth(property.published === true && typeof property.title === 'string', 'catalog-publication-invalid');
      requireHealth(typeof property.cover_image === 'string' && property.cover_image.length > 0, 'catalog-cover-missing');
      const imageUrl = new URL(property.cover_image, API_ORIGIN);
      requireHealth(imageUrl.origin === API_ORIGIN && imageUrl.pathname.startsWith('/v1/media/properties/') &&
        !imageUrl.username && !imageUrl.password && !imageUrl.search, 'catalog-cover-origin-invalid');
      // A range request bounds bandwidth; no private media or customer URLs.
      const image = await request(imageUrl.href, {
        headers: { Origin: origin, Range: 'bytes=0-1023' }, maxBytes: 1024, prefixOnly: true,
      });
      requireHealth([200, 206].includes(image.status) && /^image\//.test(image.headers.get('content-type') || '') &&
        image.text.length > 0, 'catalog-image-unavailable');
      requireHealth(image.headers.get('access-control-allow-origin') === origin, 'catalog-image-origin-denied');
    });
  }
  for (const [id, headers] of [['anonymous', {}], ['forged', { Authorization: 'Bearer health-check-invalid-token' }]]) {
    add(`staff-denies-${id}`, async () => {
      const result = await request(API_ORIGIN + '/v1/staff/me', { headers });
      requireHealth(result.status === 401, 'staff-access-boundary-failed');
      requireHealth(result.headers.get('cache-control')?.includes('no-store'), 'staff-cache-policy-changed');
    });
  }

  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < tasks.length) {
      const index = next++, task = tasks[index];
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          await task.run();
          results[index] = { id: task.id, ok: true };
          break;
        } catch (error) {
          results[index] = { id: task.id, ok: false, code: error instanceof HealthError ? error.message : 'request-failed' };
        }
      }
    }
  }));
  return { version: 1, checkedAt: new Date(now).toISOString(), ok: results.every(result => result.ok), checks: results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runProductionChecks();
  console.log(JSON.stringify(report, null, 2));
  const failed = report.checks.filter(check => !check.ok);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Production health: ${report.ok ? 'PASS' : 'FAIL'}\n\n` +
      `${report.checks.length - failed.length}/${report.checks.length} read-only checks passed.\n\n` +
      failed.map(check => `- ${check.id}: ${check.code}\n`).join(''));
  }
  if (process.env.HEALTH_REPORT_PATH) await writeFile(process.env.HEALTH_REPORT_PATH, JSON.stringify(report), { flag: 'wx' });
  if (!report.ok) process.exitCode = 1;
}
