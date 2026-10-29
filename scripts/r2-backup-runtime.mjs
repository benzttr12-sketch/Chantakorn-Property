import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { promisify } from 'node:util';
import { createGzip, createGunzip } from 'node:zlib';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { sha256File } from './firestore-backup-runtime.mjs';

const scrypt = promisify(scryptCallback), execute = promisify(execFile);
const PAGE_SIZE = 100, CHUNK_BYTES = 65536, MAX_LINE_BYTES = 131072, MAX_METADATA_BYTES = 32768;
const fail = code => { throw new Error(code); };
const bucketValid = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value);

export function r2BackupLimits(environment = process.env) {
  const number = (key, fallback, maximum) => {
    const value = Number(environment[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail('R2_INVALID_LIMITS');
    return value;
  };
  return {
    objects: number('MAX_R2_BACKUP_OBJECTS', 5000, 100000),
    bytes: number('MAX_R2_BACKUP_BYTES', 1073741824, 107374182400),
    objectBytes: number('MAX_R2_BACKUP_OBJECT_BYTES', 67108864, 5368709120),
    requests: number('MAX_R2_BACKUP_REQUESTS', 15000, 250000),
    durationMs: number('MAX_R2_BACKUP_DURATION_MS', 900000, 3600000),
    requestTimeoutMs: number('MAX_R2_BACKUP_REQUEST_TIMEOUT_MS', 30000, 120000),
  };
}

export function parseR2Buckets(value) {
  if (typeof value !== 'string') fail('R2_BUCKETS_REQUIRED');
  const buckets = value.split(',').map(item => item.trim());
  if (!buckets.length || buckets.length > 20 || buckets.some(item => !bucketValid(item)) || new Set(buckets).size !== buckets.length) fail('R2_INVALID_BUCKETS');
  return buckets;
}

/** Wrangler owns refresh/keyring handling. Capture output privately and disable its disk logs. */
export async function wranglerBackupToken(repository, environment = process.env, run = execute) {
  if (environment.CLOUDFLARE_API_TOKEN) return validToken(environment.CLOUDFLARE_API_TOKEN);
  try {
    const authEnvironment = { ...environment, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false' };
    delete authEnvironment.CHANTAKORN_BACKUP_PASSPHRASE;
    const { stdout } = await run(process.execPath, [join(repository, 'services/cloudflare-api/node_modules/wrangler/bin/wrangler.js'), 'auth', 'token', '--json'], {
      cwd: repository, timeout: 30000, maxBuffer: 131072,
      env: authEnvironment,
    });
    const credentials = JSON.parse(stdout);
    if (!['oauth', 'api_token'].includes(credentials.type)) fail('R2_AUTH_UNAVAILABLE');
    return validToken(credentials.token);
  } catch { fail('R2_AUTH_UNAVAILABLE'); }
}
function validToken(value) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 8192 || /\s/.test(value)) fail('R2_AUTH_UNAVAILABLE');
  return value;
}

/** node:https retains raw bytes even when object Content-Encoding is gzip. Fetch would decode them. */
export function rawHttpsGet(url, { headers, signal }) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: 'GET', headers, signal }, response => {
      const normalizedHeaders = new Headers();
      for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) normalizedHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
      resolve({ status: response.statusCode, headers: normalizedHeaders, body: response });
    });
    request.on('error', reject); request.end();
  });
}
function closeBody(body) { if (body?.destroy) body.destroy(); else if (body?.cancel) void body.cancel().catch(() => {}); }
async function readJson(body, maximum = 4194304) {
  const chunks = []; let bytes = 0;
  try {
    for await (const part of body) {
      const chunk = Buffer.from(part); bytes += chunk.length;
      if (bytes > maximum) fail('R2_LIST_RESPONSE_TOO_LARGE');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { closeBody(body); }
}

/** Official Cloudflare REST list/get only; no redirects, remote writes or SDK auto-pagination/retries. */
export function r2BackupSource({ accountId, token, limits = r2BackupLimits(), request = rawHttpsGet }) {
  if (!/^[a-f0-9]{32}$/.test(accountId)) fail('R2_INVALID_ACCOUNT');
  validToken(token);
  let requests = 0;
  const deadline = AbortSignal.timeout(limits.durationMs);
  const get = async (path, additionalHeaders = {}) => {
    if (++requests > limits.requests) fail('R2_REQUEST_CAP');
    try {
      return await request(new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${path}`), {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity', ...additionalHeaders },
        signal: AbortSignal.any([deadline, AbortSignal.timeout(limits.requestTimeoutMs)]),
      });
    } catch { fail('R2_READ_FAILED'); }
  };
  return {
    async list({ bucket, cursor }) {
      if (!bucketValid(bucket) || (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 4096))) fail('R2_INVALID_LIST_REQUEST');
      const params = new URLSearchParams({ per_page: String(PAGE_SIZE) }); if (cursor) params.set('cursor', cursor);
      const response = await get(`${encodeURIComponent(bucket)}/objects?${params}`);
      if (response.status !== 200) { closeBody(response.body); fail('R2_LIST_FAILED'); }
      let data; try { data = await readJson(response.body); } catch { fail('R2_LIST_FAILED'); }
      if (data.success !== true || !Array.isArray(data.result) || data.result.length > PAGE_SIZE) fail('R2_INVALID_LIST_PAGE');
      const info = data.result_info;
      // Actual REST responses omit result_info entirely on the final page, including empty buckets.
      if (info && (typeof info !== 'object' || (info.is_truncated !== undefined && typeof info.is_truncated !== 'boolean'))) fail('R2_INVALID_LIST_PAGE');
      const truncated = info?.is_truncated === true;
      if (truncated && (typeof info.cursor !== 'string' || !info.cursor || info.cursor.length > 4096)) fail('R2_INVALID_LIST_PAGE');
      if (!truncated && info?.cursor) fail('R2_INVALID_LIST_PAGE');
      return { items: data.result, cursor: truncated ? info.cursor : undefined };
    },
    async read({ bucket, item }) {
      if (!bucketValid(bucket)) fail('R2_INVALID_BUCKETS');
      const metadata = normalizeObject(item, limits);
      // R2's REST route requires literal slashes inside the object key, unlike most encoded path parameters.
      const encodedKey = metadata.key.split('/').map(encodeURIComponent).join('/');
      const response = await get(`${encodeURIComponent(bucket)}/objects/${encodedKey}`);
      if (response.status !== 200) { closeBody(response.body); fail('R2_OBJECT_CHANGED_OR_UNAVAILABLE'); }
      const length = response.headers.get('content-length'), etag = response.headers.get('etag');
      if (length === null || !/^\d+$/.test(length) || Number(length) !== metadata.size || etag?.replace(/^"|"$/g, '') !== metadata.etag) {
        closeBody(response.body); fail('R2_OBJECT_CHANGED_OR_UNAVAILABLE');
      }
      return response.body;
    },
  };
}

function stringMap(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => typeof item !== 'string')) fail('R2_INVALID_OBJECT_METADATA');
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
function normalizeObject(item, limits) {
  if (!item || typeof item !== 'object' || typeof item.key !== 'string' || !item.key || Buffer.byteLength(item.key) > 1024 || item.key.includes('\0') || item.key.split('/').some(segment => segment === '.' || segment === '..') ||
      !Number.isSafeInteger(item.size) || item.size < 0 || item.size > limits.objectBytes ||
      typeof item.etag !== 'string' || !/^[a-fA-F0-9]{32}(?:-\d+)?$/.test(item.etag) ||
      typeof item.last_modified !== 'string' || !Number.isFinite(Date.parse(item.last_modified)) || item.ssec === true) fail('R2_INVALID_OBJECT_METADATA');
  const result = { key: item.key, size: item.size, etag: item.etag, last_modified: item.last_modified };
  for (const name of ['http_metadata', 'custom_metadata']) { const value = stringMap(item[name]); if (value !== undefined) result[name] = value; }
  if (item.storage_class !== undefined) { if (typeof item.storage_class !== 'string') fail('R2_INVALID_OBJECT_METADATA'); result.storage_class = item.storage_class; }
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_METADATA_BYTES) fail('R2_INVALID_OBJECT_METADATA');
  return result;
}

async function inventory(source, buckets, limits) {
  const entries = [], identities = new Set(); let bytes = 0, pages = 0;
  for (const bucket of buckets) {
    let cursor; const cursors = new Set();
    do {
      if (++pages > limits.requests) fail('R2_REQUEST_CAP');
      const page = await source.list({ bucket, cursor });
      if (!page || !Array.isArray(page.items) || page.items.length > PAGE_SIZE || (page.cursor !== undefined && (typeof page.cursor !== 'string' || !page.cursor || page.cursor.length > 4096))) fail('R2_INVALID_LIST_PAGE');
      for (const raw of page.items) {
        const item = normalizeObject(raw, limits), identity = `${bucket}\0${item.key}`;
        if (identities.has(identity)) fail('R2_DUPLICATE_OBJECT'); identities.add(identity);
        bytes += item.size;
        if (identities.size > limits.objects || bytes > limits.bytes) fail('R2_DATA_CAP');
        entries.push({ bucket, item });
      }
      cursor = page.cursor;
      if (cursor && cursors.has(cursor)) fail('R2_REPEATED_CURSOR'); if (cursor) cursors.add(cursor);
    } while (cursor);
  }
  return entries.sort((a, b) => `${a.bucket}\0${a.item.key}`.localeCompare(`${b.bucket}\0${b.item.key}`));
}

/** Object identity/metadata and chunks stay inside the encrypted stream. Second inventory detects changes. */
export async function* r2Records(source, buckets, counts, limits = r2BackupLimits()) {
  const first = await inventory(source, buckets, limits);
  for (const { bucket, item } of first) {
    yield JSON.stringify({ type: 'object', bucket, metadata: item }) + '\n';
    const hash = createHash('sha256'); let size = 0;
    const body = await source.read({ bucket, item });
    try {
      for await (const part of body) {
        const data = Buffer.from(part);
        for (let offset = 0; offset < data.length; offset += CHUNK_BYTES) {
          const chunk = data.subarray(offset, offset + CHUNK_BYTES); size += chunk.length; counts.bytes += chunk.length;
          if (size > item.size || size > limits.objectBytes || counts.bytes > limits.bytes) fail('R2_OBJECT_SIZE_MISMATCH');
          hash.update(chunk); yield JSON.stringify({ type: 'chunk', data: chunk.toString('base64') }) + '\n';
        }
      }
    } finally { closeBody(body); }
    if (size !== item.size) fail('R2_OBJECT_SIZE_MISMATCH');
    counts.objects++; counts.buckets[bucket].objects++; counts.buckets[bucket].bytes += size;
    yield JSON.stringify({ type: 'end', sha256: hash.digest('hex') }) + '\n';
  }
  const second = await inventory(source, buckets, limits);
  if (JSON.stringify(first) !== JSON.stringify(second)) fail('R2_INVENTORY_CHANGED');
}

async function keyFor(password, salt) { return scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }); }
function authenticatedContext(accountId, buckets, createdAt) {
  return Buffer.from(JSON.stringify({ version: 1, kind: 'r2-backup', format: 'r2-jsonl-v1',
    accountId, buckets: [...buckets].sort(), createdAt }));
}
export function validateR2Manifest(manifest, limits = r2BackupLimits()) {
  if (!manifest || manifest.version !== 1 || manifest.kind !== 'r2-backup' || manifest.format !== 'r2-jsonl-v1' ||
      manifest.encryption !== 'AES-256-GCM' || manifest.compression !== 'gzip' || !/^[a-f0-9]{32}$/.test(manifest.accountId ?? '') ||
      typeof manifest.createdAt !== 'string' || manifest.createdAt.length > 64 || !Number.isFinite(Date.parse(manifest.createdAt)) || !/^[a-f0-9]{64}$/.test(manifest.sha256 ?? '') || !/^[a-f0-9]{32}$/.test(manifest.salt ?? '') ||
      !/^[a-f0-9]{24}$/.test(manifest.iv ?? '') || !/^[a-f0-9]{32}$/.test(manifest.tag ?? '') ||
      !Number.isSafeInteger(manifest.objects) || manifest.objects < 0 || manifest.objects > limits.objects ||
      !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 0 || manifest.bytes > limits.bytes ||
      !manifest.buckets || typeof manifest.buckets !== 'object' || Array.isArray(manifest.buckets)) fail('R2_INVALID_MANIFEST');
  const entries = Object.entries(manifest.buckets);
  if (!entries.length || entries.length > 20 || entries.some(([name, count]) => !bucketValid(name) || !count ||
      !Number.isSafeInteger(count.objects) || count.objects < 0 || !Number.isSafeInteger(count.bytes) || count.bytes < 0) ||
      entries.reduce((total, [, count]) => total + count.objects, 0) !== manifest.objects ||
      entries.reduce((total, [, count]) => total + count.bytes, 0) !== manifest.bytes) fail('R2_INVALID_MANIFEST');
  return manifest;
}

export async function createR2EncryptedArchive({ filePath, password, source, accountId, buckets, limits = r2BackupLimits() }) {
  if (typeof password !== 'string' || password.length < 24 || password.length > 512) fail('R2_PASSPHRASE_REQUIRED');
  if (!/^[a-f0-9]{32}$/.test(accountId) || !Array.isArray(buckets) || !buckets.length || buckets.length > 20 || buckets.some(item => !bucketValid(item)) || new Set(buckets).size !== buckets.length) fail('R2_INVALID_SCOPE');
  const manifestPath = `${filePath}.manifest.json`;
  if (existsSync(filePath) || existsSync(manifestPath)) fail('R2_ARCHIVE_EXISTS');
  const createdAt = new Date().toISOString();
  const salt = randomBytes(16), iv = randomBytes(12), key = await keyFor(password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv); key.fill(0);
  cipher.setAAD(authenticatedContext(accountId, buckets, createdAt));
  const counts = { objects: 0, bytes: 0, buckets: Object.fromEntries(buckets.map(bucket => [bucket, { objects: 0, bytes: 0 }])) };
  let archiveOwned = false, manifestOwned = false, archiveFd, manifestFd;
  try {
    archiveFd = openSync(filePath, 'wx', 0o600); archiveOwned = true;
    const output = createWriteStream(filePath, { fd: archiveFd, autoClose: true }); archiveFd = undefined;
    await pipeline(Readable.from(r2Records(source, buckets, counts, limits)), createGzip({ level: 6 }), cipher, output, { signal: AbortSignal.timeout(limits.durationMs) });
    const manifest = validateR2Manifest({ version: 1, kind: 'r2-backup', format: 'r2-jsonl-v1', createdAt, accountId,
      ...counts, encryption: 'AES-256-GCM', compression: 'gzip', salt: salt.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), sha256: await sha256File(filePath) }, limits);
    manifestFd = openSync(manifestPath, 'wx', 0o600); manifestOwned = true;
    writeFileSync(manifestFd, JSON.stringify(manifest, null, 2) + '\n'); closeSync(manifestFd); manifestFd = undefined;
    return manifest;
  } catch (error) {
    if (archiveFd !== undefined) closeSync(archiveFd); if (manifestFd !== undefined) closeSync(manifestFd);
    if (archiveOwned) { try { unlinkSync(filePath); } catch {} } if (manifestOwned) { try { unlinkSync(manifestPath); } catch {} }
    throw error;
  }
}

/** Verification decrypts only into memory, authenticates GCM and checks every object's original byte digest. */
export async function verifyR2EncryptedArchive({ filePath, manifest, password, limits = r2BackupLimits(), highWaterMark }) {
  validateR2Manifest(manifest, limits);
  if (typeof password !== 'string' || password.length < 24 || password.length > 512) fail('R2_PASSPHRASE_REQUIRED');
  if (await sha256File(filePath) !== manifest.sha256) fail('R2_CHECKSUM_MISMATCH');
  const key = await keyFor(password, Buffer.from(manifest.salt, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(manifest.iv, 'hex')); key.fill(0); decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  decipher.setAAD(authenticatedContext(manifest.accountId, Object.keys(manifest.buckets), manifest.createdAt));
  const decoder = new StringDecoder('utf8'), seen = new Set(), counts = { objects: 0, bytes: 0, buckets: Object.fromEntries(Object.keys(manifest.buckets).map(bucket => [bucket, { objects: 0, bytes: 0 }])) };
  let partial = '', current, decodedBytes = 0;
  const maximumDecodedBytes = manifest.bytes * 2 + manifest.objects * (MAX_METADATA_BYTES + 1024) + 1024;
  function consume(text) {
    decodedBytes += Buffer.byteLength(text); if (decodedBytes > maximumDecodedBytes) fail('R2_DECODED_DATA_CAP');
    partial += text; let position;
    while ((position = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, position); partial = partial.slice(position + 1);
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) fail('R2_INVALID_ARCHIVE_RECORD');
      const record = JSON.parse(line);
      if (record?.type === 'object' && !current) {
        if (!Object.hasOwn(counts.buckets, record.bucket)) fail('R2_INVALID_ARCHIVE_RECORD');
        const metadata = normalizeObject(record.metadata, limits), identity = `${record.bucket}\0${metadata.key}`;
        if (seen.has(identity) || seen.size >= manifest.objects) fail('R2_INVALID_ARCHIVE_RECORD'); seen.add(identity);
        current = { metadata, bucket: record.bucket, bytes: 0, hash: createHash('sha256') };
      } else if (record?.type === 'chunk' && current) {
        if (typeof record.data !== 'string' || !record.data || record.data.length > Math.ceil(CHUNK_BYTES / 3) * 4) fail('R2_INVALID_ARCHIVE_RECORD');
        const chunk = Buffer.from(record.data, 'base64');
        if (chunk.length > CHUNK_BYTES || chunk.toString('base64') !== record.data) fail('R2_INVALID_ARCHIVE_RECORD');
        current.bytes += chunk.length; counts.bytes += chunk.length;
        if (current.bytes > current.metadata.size || counts.bytes > manifest.bytes) fail('R2_OBJECT_SIZE_MISMATCH'); current.hash.update(chunk);
      } else if (record?.type === 'end' && current) {
        if (current.bytes !== current.metadata.size || current.hash.digest('hex') !== record.sha256) fail('R2_OBJECT_DIGEST_MISMATCH');
        counts.objects++; counts.buckets[current.bucket].objects++; counts.buckets[current.bucket].bytes += current.bytes; current = undefined;
      } else fail('R2_INVALID_ARCHIVE_RECORD');
    }
    if (Buffer.byteLength(partial) > MAX_LINE_BYTES) fail('R2_INVALID_ARCHIVE_RECORD');
  }
  const sink = new Writable({ write(chunk, _encoding, done) { try { consume(decoder.write(chunk)); done(); } catch (error) { done(error); } },
    final(done) { try { consume(decoder.end()); if (partial || current) fail('R2_TRUNCATED_ARCHIVE'); done(); } catch (error) { done(error); } } });
  await pipeline(createReadStream(filePath, highWaterMark ? { highWaterMark } : undefined), decipher, createGunzip(), sink, { signal: AbortSignal.timeout(limits.durationMs) });
  if (counts.objects !== manifest.objects || counts.bytes !== manifest.bytes || JSON.stringify(counts.buckets) !== JSON.stringify(manifest.buckets)) fail('R2_ARCHIVE_COUNTS_MISMATCH');
  return { verified: true, objects: counts.objects, bytes: counts.bytes, bucketCount: Object.keys(counts.buckets).length, checksumVerified: true, objectDigestsVerified: true };
}
