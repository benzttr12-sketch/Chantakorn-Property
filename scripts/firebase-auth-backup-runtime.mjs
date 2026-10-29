import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, openSync, closeSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { promisify } from 'node:util';
import { createGzip, createGunzip } from 'node:zlib';
import { outsideRepositoryPath } from './firestore-backup-runtime.mjs';

const scrypt = promisify(scryptCallback);
const repository = fileURLToPath(new URL('..', import.meta.url));
const PAGE_SIZE = 100;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_PLAINTEXT_BYTES = 256 * 1024 * 1024;
const USER_KEYS = ['uid', 'disabled', 'emailVerified', 'providerData', 'customClaims', 'email', 'displayName', 'phoneNumber', 'photoUrl', 'createdAt', 'lastLoginAt', 'lastRefreshAt', 'validSince', 'tenantId'];
const PROVIDER_FIELDS = { providerId: 128, rawId: 2048, federatedId: 2048, displayName: 1024, email: 1024, photoUrl: 4096, screenName: 1024, phoneNumber: 64 };
const OPTIONAL_FIELDS = { email: 1024, displayName: 1024, phoneNumber: 64, photoUrl: 4096, createdAt: 128, lastLoginAt: 128, lastRefreshAt: 128, validSince: 128, tenantId: 128 };

function fail(code) { throw new Error(code); }
function archivePath(filePath, { existing = false } = {}) {
  const resolved = outsideRepositoryPath(filePath, repository, { existing });
  // Also reject another checkout (including .git files for managed worktrees).
  for (let directory = dirname(resolved);; directory = dirname(directory)) {
    if (existsSync(join(directory, '.git'))) fail('AUTH_ARCHIVE_IN_REPOSITORY');
    if (dirname(directory) === directory) break;
  }
  return resolved;
}
function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}
function validProject(project) {
  if (typeof project !== 'string' || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) fail('AUTH_PROJECT_INVALID');
}
function validPassword(password) {
  if (typeof password !== 'string' || password.length < 24 || password.length > 512) fail('AUTH_PASSPHRASE_INVALID');
}
function copyStrings(source, limits) {
  const result = {};
  for (const [key, maximum] of Object.entries(limits)) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== 'string' || source[key].length > maximum) fail('AUTH_USER_INVALID');
    result[key] = source[key];
  }
  return result;
}
function providers(values) {
  if (!Array.isArray(values) || values.length > 100) fail('AUTH_USER_INVALID');
  return values.map(provider => {
    if (!plainObject(provider) || typeof provider.providerId !== 'string' || !provider.providerId) fail('AUTH_USER_INVALID');
    return copyStrings(provider, PROVIDER_FIELDS);
  });
}
function claims(value) {
  function jsonOnly(item, depth = 0) {
    if (depth > 20) fail('AUTH_CLAIMS_INVALID');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (Array.isArray(item)) { for (const child of item) jsonOnly(child, depth + 1); return; }
    if (plainObject(item)) { for (const child of Object.values(item)) jsonOnly(child, depth + 1); return; }
    fail('AUTH_CLAIMS_INVALID');
  }
  jsonOnly(value);
  if (!plainObject(value) || Buffer.byteLength(JSON.stringify(value)) > 1000) fail('AUTH_CLAIMS_INVALID');
  // Round-trip ensures only JSON data, with no prototype setters or executable values.
  return JSON.parse(JSON.stringify(value));
}

/** Deliberate allowlist: never archive hashes, salts, refresh tokens or MFA secrets. */
export function normalizeAuthUser(user) {
  if (!plainObject(user) || typeof user.localId !== 'string' || !user.localId || user.localId.length > 128 ||
      (user.disabled !== undefined && typeof user.disabled !== 'boolean') ||
      (user.emailVerified !== undefined && typeof user.emailVerified !== 'boolean')) fail('AUTH_USER_INVALID');
  let customClaims = {};
  if (user.customAttributes !== undefined && user.customAttributes !== '') {
    if (typeof user.customAttributes !== 'string' || Buffer.byteLength(user.customAttributes) > 1000) fail('AUTH_CLAIMS_INVALID');
    try { customClaims = JSON.parse(user.customAttributes); } catch { fail('AUTH_CLAIMS_INVALID'); }
  }
  return {
    uid: user.localId, disabled: user.disabled === true, emailVerified: user.emailVerified === true,
    providerData: providers(user.providerUserInfo ?? []), customClaims: claims(customClaims),
    ...copyStrings(user, OPTIONAL_FIELDS),
  };
}

function validateRecord(record) {
  if (!plainObject(record) || Object.keys(record).some(key => !USER_KEYS.includes(key)) ||
      typeof record.uid !== 'string' || !record.uid || record.uid.length > 128 ||
      typeof record.disabled !== 'boolean' || typeof record.emailVerified !== 'boolean' ||
      !Array.isArray(record.providerData) || record.providerData.some(provider => !plainObject(provider) || Object.keys(provider).some(key => !Object.hasOwn(PROVIDER_FIELDS, key)))) fail('AUTH_RECORD_INVALID');
  providers(record.providerData);
  claims(record.customClaims);
  copyStrings(record, OPTIONAL_FIELDS);
  return record;
}

export function authBackupLimits(environment = process.env) {
  function limit(key, fallback, maximum) {
    const value = Number(environment[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail('AUTH_LIMIT_INVALID');
    return value;
  }
  return {
    users: limit('MAX_AUTH_BACKUP_USERS', 10000, 200000),
    pages: limit('MAX_AUTH_BACKUP_PAGES', 200, 2000),
    timeoutMs: limit('AUTH_BACKUP_TIMEOUT_MS', 300000, 900000),
  };
}

/** Fixed Google endpoint; credential refresh uses existing ADC, with no account writes. */
export function authBackupSource({ client, project, timeoutMs = 300000 }) {
  validProject(project);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900000) fail('AUTH_LIMIT_INVALID');
  const deadline = Date.now() + timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);
  return {
    async page({ pageToken, pageSize }) {
      if (pageSize !== PAGE_SIZE || (pageToken !== undefined && (typeof pageToken !== 'string' || !pageToken || pageToken.length > 4096))) fail('AUTH_PAGE_INVALID');
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal.aborted) fail('AUTH_BACKUP_TIMEOUT');
      const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:batchGet`);
      url.searchParams.set('maxResults', String(pageSize));
      if (pageToken) url.searchParams.set('nextPageToken', pageToken);
      // Bound credential-refresh latency too; some ADC adapters do not forward the signal while refreshing.
      const response = await new Promise((resolve, reject) => {
        const abort = () => reject(new Error('AUTH_BACKUP_TIMEOUT'));
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(() => client.request({ url: url.href, method: 'GET', responseType: 'stream',
          timeout: Math.min(30000, remaining), signal, retry: false, maxRedirects: 0, redirect: 'error', maxContentLength: MAX_PAGE_BYTES }))
          .then(result => {
            signal.removeEventListener('abort', abort);
            if (signal.aborted) {
              result.data?.destroy?.();
              if (result.data?.cancel) Promise.resolve(result.data.cancel()).catch(() => {});
              reject(new Error('AUTH_BACKUP_TIMEOUT'));
            } else resolve(result);
          }, error => { signal.removeEventListener('abort', abort); reject(signal.aborted ? new Error('AUTH_BACKUP_TIMEOUT') : error); });
      });
      if (response.status !== 200 || !response.data?.[Symbol.asyncIterator]) fail('AUTH_PAGE_INVALID');
      const chunks = []; let bytes = 0;
      try {
        for await (const chunk of response.data) {
          if (signal.aborted) fail('AUTH_BACKUP_TIMEOUT');
          const buffer = Buffer.from(chunk); bytes += buffer.length;
          if (bytes > MAX_PAGE_BYTES) fail('AUTH_PAGE_TOO_LARGE');
          chunks.push(buffer);
        }
      } catch (error) { response.data.destroy?.(); throw error; }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('AUTH_PAGE_INVALID'); }
      if (!plainObject(body) || (body.users !== undefined && !Array.isArray(body.users))) fail('AUTH_PAGE_INVALID');
      return { users: body.users ?? [], nextPageToken: body.nextPageToken };
    },
  };
}

export async function* authMetadataRecords(source, limits = authBackupLimits({})) {
  const seenUsers = new Set(), seenTokens = new Set();
  const deadline = Date.now() + limits.timeoutMs;
  let pageToken, pages = 0;
  do {
    if (Date.now() >= deadline) fail('AUTH_BACKUP_TIMEOUT');
    if (++pages > limits.pages) fail('AUTH_PAGE_CAP');
    const page = await source.page({ pageToken, pageSize: PAGE_SIZE });
    if (Date.now() >= deadline) fail('AUTH_BACKUP_TIMEOUT');
    if (!page || !Array.isArray(page.users) || page.users.length > PAGE_SIZE) fail('AUTH_PAGE_INVALID');
    for (const user of page.users) {
      const record = normalizeAuthUser(user);
      if (seenUsers.has(record.uid)) fail('AUTH_DUPLICATE_UID');
      if (seenUsers.size >= limits.users) fail('AUTH_USER_CAP');
      seenUsers.add(record.uid);
      yield record;
    }
    pageToken = page.nextPageToken;
    if (pageToken !== undefined && pageToken !== null && (typeof pageToken !== 'string' || !pageToken || pageToken.length > 4096)) fail('AUTH_PAGE_INVALID');
    if (pageToken && seenTokens.has(pageToken)) fail('AUTH_REPEATED_PAGE_TOKEN');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
}

function header(project, createdAt) {
  return { version: 1, format: 'chantakorn-firebase-auth-metadata', firebaseProject: project,
    scope: 'project-default-users', passwordHashesIncluded: false, credentialsRestorable: false, createdAt };
}
const MANIFEST_KEYS = [...Object.keys(header('', '')), 'encryption', 'compression', 'salt', 'iv', 'tag', 'sha256', 'records', 'payloadBytes'];
export function validateAuthManifest(manifest) {
  if (!plainObject(manifest) || Object.keys(manifest).some(key => !MANIFEST_KEYS.includes(key)) ||
      manifest.version !== 1 || manifest.format !== 'chantakorn-firebase-auth-metadata' || manifest.scope !== 'project-default-users' ||
      manifest.passwordHashesIncluded !== false || manifest.credentialsRestorable !== false ||
      typeof manifest.createdAt !== 'string' || manifest.createdAt.length > 64 || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      manifest.encryption !== 'AES-256-GCM' || manifest.compression !== 'gzip' ||
      !/^[a-f0-9]{32}$/.test(manifest.salt ?? '') || !/^[a-f0-9]{24}$/.test(manifest.iv ?? '') ||
      !/^[a-f0-9]{32}$/.test(manifest.tag ?? '') || !/^[a-f0-9]{64}$/.test(manifest.sha256 ?? '') ||
      !Number.isSafeInteger(manifest.records) || manifest.records < 0 || manifest.records > 200000 ||
      !Number.isSafeInteger(manifest.payloadBytes) || manifest.payloadBytes < 0 || manifest.payloadBytes > MAX_PLAINTEXT_BYTES) fail('AUTH_MANIFEST_INVALID');
  validProject(manifest.firebaseProject);
  return manifest;
}
async function keyFor(password, salt) { return scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }); }
async function checksum(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

/** No plaintext file is created; an interrupted scan removes only its own files. */
export async function createAuthEncryptedArchive({ filePath, password, records, project }) {
  validPassword(password); validProject(project);
  filePath = archivePath(filePath);
  const manifestPath = `${filePath}.manifest.json`;
  if (existsSync(filePath) || existsSync(manifestPath)) fail('AUTH_ARCHIVE_EXISTS');
  const meta = header(project, new Date().toISOString());
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await keyFor(password, salt), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(meta)));
  let recordCount = 0, payloadBytes = 0, archiveOwned = false, manifestOwned = false, archiveFd, manifestFd;
  const uids = new Set();
  async function* encoded() {
    for await (const record of records) {
      validateRecord(record);
      if (uids.has(record.uid)) fail('AUTH_DUPLICATE_UID');
      if (++recordCount > 200000) fail('AUTH_USER_CAP');
      uids.add(record.uid);
      const line = JSON.stringify(record) + '\n';
      const bytes = Buffer.byteLength(line); payloadBytes += bytes;
      if (bytes > MAX_RECORD_BYTES || payloadBytes > MAX_PLAINTEXT_BYTES) fail('AUTH_ARCHIVE_TOO_LARGE');
      yield line;
    }
  }
  try {
    archiveFd = openSync(filePath, 'wx', 0o600); archiveOwned = true;
    const output = createWriteStream(filePath, { fd: archiveFd, autoClose: true }); archiveFd = undefined;
    await pipeline(Readable.from(encoded()), createGzip({ level: 6 }), cipher, output);
    const manifest = validateAuthManifest({ ...meta, records: recordCount, payloadBytes,
      encryption: 'AES-256-GCM', compression: 'gzip', salt: salt.toString('hex'), iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'), sha256: await checksum(filePath) });
    manifestFd = openSync(manifestPath, 'wx', 0o600); manifestOwned = true;
    writeFileSync(manifestFd, JSON.stringify(manifest, null, 2) + '\n'); closeSync(manifestFd); manifestFd = undefined;
    return manifest;
  } catch (error) {
    if (archiveFd !== undefined) closeSync(archiveFd);
    if (manifestFd !== undefined) closeSync(manifestFd);
    if (archiveOwned) { try { unlinkSync(filePath); } catch {} }
    if (manifestOwned) { try { unlinkSync(manifestPath); } catch {} }
    throw error;
  }
}

/** Authentication must finish before any collected identity metadata can be returned. */
async function inspectAuthArchive({ filePath, password, manifest, expectedProject, highWaterMark, decodedChunkSize }, collection = null) {
  validPassword(password);
  filePath = archivePath(filePath, { existing: true });
  if (!manifest) {
    const manifestPath = archivePath(`${filePath}.manifest.json`, { existing: true });
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  }
  validateAuthManifest(manifest);
  if (collection && manifest.records > collection.maxRecords) fail('AUTH_READ_RECORD_CAP');
  if (collection && manifest.payloadBytes > collection.maxBytes) fail('AUTH_READ_BYTE_CAP');
  if (expectedProject !== undefined && manifest.firebaseProject !== expectedProject) fail('AUTH_PROJECT_MISMATCH');
  if (await checksum(filePath) !== manifest.sha256) fail('AUTH_CHECKSUM_MISMATCH');
  const decipher = createDecipheriv('aes-256-gcm', await keyFor(password, Buffer.from(manifest.salt, 'hex')), Buffer.from(manifest.iv, 'hex'));
  decipher.setAAD(Buffer.from(JSON.stringify(header(manifest.firebaseProject, manifest.createdAt))));
  decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  const decoder = new StringDecoder('utf8'), uids = new Set();
  let partial = '', count = 0, payloadBytes = 0;
  function consume(text) {
    partial += text;
    let position;
    while ((position = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, position); partial = partial.slice(position + 1);
      if (Buffer.byteLength(line) + 1 > MAX_RECORD_BYTES) fail('AUTH_ARCHIVE_TOO_LARGE');
      const record = validateRecord(JSON.parse(line));
      if (uids.has(record.uid)) fail('AUTH_DUPLICATE_UID');
      uids.add(record.uid);
      if (++count > manifest.records || count > 200000) fail('AUTH_RECORD_COUNT_MISMATCH');
      if (collection) collection.users.push(record);
    }
    if (Buffer.byteLength(partial) > MAX_RECORD_BYTES) fail('AUTH_ARCHIVE_TOO_LARGE');
  }
  const sink = new Writable({
    write(chunk, _encoding, done) {
      try {
        payloadBytes += chunk.length;
        if (payloadBytes > MAX_PLAINTEXT_BYTES || payloadBytes > manifest.payloadBytes) fail('AUTH_ARCHIVE_TOO_LARGE');
        consume(decoder.write(chunk)); done();
      } catch (error) { done(error); }
    },
    final(done) { try { consume(decoder.end()); if (partial) fail('AUTH_ARCHIVE_TRUNCATED'); done(); } catch (error) { done(error); } },
  });
  await pipeline(createReadStream(filePath, highWaterMark ? { highWaterMark } : undefined), decipher,
    createGunzip(decodedChunkSize ? { chunkSize: decodedChunkSize } : undefined), sink);
  if (count !== manifest.records || payloadBytes !== manifest.payloadBytes) fail('AUTH_RECORD_COUNT_MISMATCH');
  return { verified: true, records: count, checksumVerified: true, passwordHashesIncluded: false, credentialsRestorable: false };
}

/** Local integrity verification only. This never creates/restores Firebase accounts. */
export async function verifyAuthEncryptedArchive(options) {
  return inspectAuthArchive(options);
}

/** Bounded private in-memory data for offline reconciliation; no streaming disclosure before GCM verification. */
export async function readVerifiedAuthRecords(options) {
  const maxRecords = options.maxRecords ?? 5000, maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 5000 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024 * 1024) fail('AUTH_LIMIT_INVALID');
  const collection = { maxRecords, maxBytes, users: [] };
  const result = await inspectAuthArchive(options, collection);
  function freeze(value) {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
  }
  return Object.freeze({ users: freeze(collection.users), sourceRecords: result.records, authenticated: true, checksumVerified: true });
}
