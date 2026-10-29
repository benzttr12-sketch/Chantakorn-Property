#!/usr/bin/env node
/** Offline integrity/typed-value checks and a create-only restore to a local demo emulator. */
import { createDecipheriv, scrypt as scryptCallback } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import firestorePackage from '@google-cloud/firestore';
import { encodeFirestoreValue, redactCollectionPath, validateEncryptedBackupManifest } from './firestore-backup-codec.mjs';
import { outsideRepositoryPath, sha256File } from './firestore-backup-runtime.mjs';

const { Firestore, Timestamp, GeoPoint } = firestorePackage;
const scrypt = promisify(scryptCallback);
const MAX_LINE_BYTES = 20 * 1024 * 1024;
const MiB = 1024 * 1024;
const authenticatedSamples = new WeakSet();

function checkedLimit(value, fallback, maximum) {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error('Invalid restore limits');
  return number;
}

export function restoreLimits(environment = process.env) {
  return {
    sampleRecords: checkedLimit(environment.MAX_RESTORE_SAMPLE_RECORDS, 100, 5000),
    sampleBytes: checkedLimit(environment.MAX_RESTORE_SAMPLE_BYTES, 16 * MiB, 64 * MiB),
    decodedBytes: checkedLimit(environment.MAX_RESTORE_ARCHIVE_BYTES, 256 * MiB, 2 * 1024 * MiB),
    timeoutMs: checkedLimit(environment.MAX_RESTORE_TIMEOUT_MS, 120000, 600000),
  };
}

/** No DNS names, cloud hosts, default database or production project can reach the SDK. */
export function isolatedRestoreTarget({ host, project, database }) {
  let url;
  try { url = new URL(`http://${host}`); } catch { throw new Error('Restore requires an explicit numeric loopback emulator host and port'); }
  if (typeof host !== 'string' || !/^(127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) || Number(url.port) < 1024 || Number(url.port) > 65535 ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Restore requires an explicit numeric loopback emulator host and port');
  }
  if (typeof project !== 'string' || !/^demo-[a-z][a-z0-9-]{0,23}[a-z0-9]$/.test(project)) {
    throw new Error('Restore project must be a demo-* project');
  }
  if (typeof database !== 'string' || !/^restore-[a-z0-9][a-z0-9-]{0,53}[a-z0-9]$/.test(database)) {
    throw new Error('Restore requires an explicit restore-* named database');
  }
  return Object.freeze({ host, project, database });
}

function documentPath(value) {
  if (typeof value !== 'string' || !value) throw new Error('Invalid archived document path');
  const parts = value.split('/');
  if (parts.length % 2 !== 0 || parts.some(part => !part || part === '.' || part === '..' || Buffer.byteLength(part) > 1500)) {
    throw new Error('Invalid archived document path');
  }
  return value;
}

function exactFields(value, names) {
  if (Object.keys(value).sort().join('\0') !== names.sort().join('\0')) throw new Error('Invalid archived Firestore value');
}

/** Reconstruct native values; references deliberately point into the isolated destination. */
export function decodeFirestoreValue(value, reference = path => ({ referencePath: path }), depth = 0) {
  if (depth > 100) throw new Error('Archived value nesting limit exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid archived Firestore value');
  switch (value.$fs) {
    case 'timestamp': {
      exactFields(value, ['$fs', 'seconds', 'nanoseconds']);
      if (!Number.isSafeInteger(value.seconds) || !Number.isSafeInteger(value.nanoseconds)) throw new Error('Invalid archived timestamp');
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    case 'geopoint': {
      exactFields(value, ['$fs', 'latitude', 'longitude']);
      if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) throw new Error('Invalid archived geopoint');
      return new GeoPoint(value.latitude, value.longitude);
    }
    case 'reference':
      exactFields(value, ['$fs', 'path']);
      return reference(documentPath(value.path));
    case 'date': {
      exactFields(value, ['$fs', 'iso']);
      const date = new Date(value.iso);
      if (typeof value.iso !== 'string' || !Number.isFinite(date.getTime()) || date.toISOString() !== value.iso) throw new Error('Invalid archived date');
      return date;
    }
    case 'bytes': {
      exactFields(value, ['$fs', 'base64']);
      if (typeof value.base64 !== 'string' || Buffer.from(value.base64, 'base64').toString('base64') !== value.base64) throw new Error('Invalid archived bytes');
      return Buffer.from(value.base64, 'base64');
    }
    case 'array':
      exactFields(value, ['$fs', 'values']);
      if (!Array.isArray(value.values)) throw new Error('Invalid archived array');
      return value.values.map(item => decodeFirestoreValue(item, reference, depth + 1));
    case 'map': {
      exactFields(value, ['$fs', 'entries']);
      if (!Array.isArray(value.entries)) throw new Error('Invalid archived map');
      const result = {}, keys = new Set();
      for (const entry of value.entries) {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || keys.has(entry[0])) throw new Error('Invalid or duplicate archived map field');
        keys.add(entry[0]);
        Object.defineProperty(result, entry[0], { value: decodeFirestoreValue(entry[1], reference, depth + 1), enumerable: true, configurable: true, writable: true });
      }
      return result;
    }
    default: throw new Error('Unknown archived Firestore value tag');
  }
}

function canonical(value) {
  if (!value || typeof value !== 'object') return value;
  // Firestore stores JavaScript Date as Timestamp, preserving the millisecond instant.
  if (value.$fs === 'date') return encodeFirestoreValue(Timestamp.fromDate(new Date(value.iso)));
  if (value.$fs === 'map') return { $fs: 'map', entries: value.entries.map(([key, item]) => [key, canonical(item)]).sort((a, b) => a[0].localeCompare(b[0], 'en')) };
  if (value.$fs === 'array') return { $fs: 'array', values: value.values.map(canonical) };
  return value;
}

/** Refuse values the service/SDK cannot round-trip, rather than accepting a lossy restore. */
function assertWritableValue(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$fs === 'timestamp' && value.nanoseconds % 1000 !== 0) {
    throw new Error('Archived timestamp precision cannot be stored losslessly');
  }
  if (value.$fs === 'map') {
    for (const [name, item] of value.entries) {
      if (/^__.*__$/.test(name)) throw new Error('Reserved archived field cannot be stored losslessly');
      assertWritableValue(item);
    }
  }
  if (value.$fs === 'array') for (const item of value.values) assertWritableValue(item);
}

function freezeRecord(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeRecord(child);
    Object.freeze(value);
  }
  return value;
}

/** Authenticate the entire archive before exposing a bounded sample to any writer. */
export async function readRestoreSample({ filePath, manifest, password, limits = restoreLimits({}), highWaterMark, decodedChunkSize }) {
  validateEncryptedBackupManifest(manifest);
  if (manifest.records > 200000) throw new Error('Archive record cap exceeded');
  if (typeof password !== 'string' || password.length < 24 || password.length > 512) throw new Error('A 24+-character backup passphrase is required');
  if (await sha256File(filePath) !== manifest.sha256) throw new Error('Encrypted archive checksum mismatch');
  const key = await scrypt(password, Buffer.from(manifest.salt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(manifest.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  const decoder = new StringDecoder('utf8'), sample = [], paths = new Set(), collections = Object.create(null);
  let partial = '', records = 0, decodedBytes = 0, sampleBytes = 0;
  function consume(text) {
    decodedBytes += Buffer.byteLength(text);
    if (decodedBytes > limits.decodedBytes) throw new Error('Decoded archive byte cap exceeded');
    partial += text;
    let position;
    while ((position = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, position); partial = partial.slice(position + 1);
      const lineBytes = Buffer.byteLength(line);
      if (lineBytes > MAX_LINE_BYTES) throw new Error('Archived document byte cap exceeded');
      const row = JSON.parse(line);
      if (!row || typeof row !== 'object' || row.data?.$fs !== 'map') throw new Error('Malformed archived document');
      documentPath(row.path);
      if (paths.has(row.path)) throw new Error('Duplicate archived document path');
      paths.add(row.path);
      if (++records > manifest.records) throw new Error('Archive document count mismatch');
      const collection = redactCollectionPath(row.path.split('/').slice(0, -1).join('/'));
      collections[collection] = (collections[collection] ?? 0) + 1;
      decodeFirestoreValue(row.data);
      for (const name of ['create_time', 'update_time']) {
        if (row[name] !== undefined && row[name] !== null) {
          if (row[name].$fs !== 'timestamp') throw new Error('Invalid archived server timestamp');
          decodeFirestoreValue(row[name]);
        }
      }
      if (sample.length < limits.sampleRecords) {
        sampleBytes += lineBytes;
        if (sampleBytes > limits.sampleBytes) throw new Error('Restore sample byte cap exceeded');
        sample.push(row);
      }
    }
    if (Buffer.byteLength(partial) > MAX_LINE_BYTES) throw new Error('Archived document byte cap exceeded');
  }
  const sink = new Writable({
    write(chunk, _encoding, done) { try { consume(decoder.write(chunk)); done(); } catch (error) { done(error); } },
    final(done) { try { consume(decoder.end()); if (partial) throw new Error('Truncated archive JSONL'); done(); } catch (error) { done(error); } },
  });
  await pipeline(createReadStream(filePath, highWaterMark ? { highWaterMark } : undefined), decipher,
    createGunzip(decodedChunkSize ? { chunkSize: decodedChunkSize } : undefined), sink, { signal: AbortSignal.timeout(limits.timeoutMs) });
  if (records !== manifest.records || Object.keys(collections).length !== Object.keys(manifest.collections).length ||
      Object.entries(manifest.collections).some(([name, count]) => collections[name] !== count)) throw new Error('Archive inventory mismatch');
  const archive = Object.freeze({ sample: Object.freeze(sample.map(freezeRecord)), sourceRecords: records,
    sourceCollectionCount: Object.keys(collections).length, checksumVerified: true, authenticated: true });
  authenticatedSamples.add(archive);
  return archive;
}

function defaultClient(target) {
  // The SDK prioritizes this environment variable over host settings. Require exact agreement.
  if (process.env.FIRESTORE_EMULATOR_HOST !== target.host) throw new Error('Emulator environment must match the isolated restore target');
  return new Firestore({ projectId: target.project, databaseId: target.database, host: target.host, ssl: false });
}

/** Only create documents in an empty, explicitly isolated local emulator database. */
export async function restoreToIsolatedEmulator({ archive, target, clientFactory = defaultClient }) {
  const isolated = isolatedRestoreTarget(target);
  if (!authenticatedSamples.has(archive)) throw new Error('Restore requires a fully authenticated archive sample');
  for (const row of archive.sample) assertWritableValue(row.data);
  const db = clientFactory(isolated);
  try {
    if ((await db.listCollections()).length) throw new Error('Restore emulator database must be empty');
    const expected = archive.sample.map(row => {
      documentPath(row.path);
      return { path: row.path, data: decodeFirestoreValue(row.data, path => db.doc(path)), encoded: canonical(row.data) };
    });
    for (let offset = 0; offset < expected.length; offset += 100) {
      const batch = db.batch();
      for (const row of expected.slice(offset, offset + 100)) batch.create(db.doc(row.path), row.data);
      await batch.commit();
    }
    for (let offset = 0; offset < expected.length; offset += 100) {
      const rows = expected.slice(offset, offset + 100);
      const restored = await db.getAll(...rows.map(row => db.doc(row.path)));
      if (restored.length !== rows.length || restored.some((snapshot, index) => !snapshot.exists || snapshot.ref.path !== rows[index].path ||
        JSON.stringify(canonical(encodeFirestoreValue(snapshot.data()))) !== JSON.stringify(rows[index].encoded))) {
        throw new Error('Restored sample content mismatch');
      }
    }
    return { restored: true, verified: true, sampleRecords: expected.length, sourceRecords: archive.sourceRecords,
      sampleLimited: expected.length < archive.sourceRecords, serverTimestampsRestored: false, destination: 'local-demo-emulator' };
  } finally { await db.terminate(); }
}

async function main() {
  const command = process.argv[2];
  if (!['inspect', 'restore'].includes(command)) {
    console.error('Usage: node scripts/firestore-restore-validation.mjs inspect|restore /ABSOLUTE/OFF-REPO/archive.enc');
    process.exitCode = 2; return;
  }
  try {
    let target;
    if (command === 'restore') {
      if (process.env.ALLOW_FIRESTORE_EMULATOR_RESTORE !== 'DEMO_ONLY') throw new Error('Local emulator restore gate is required');
      target = isolatedRestoreTarget({ host: process.env.FIRESTORE_EMULATOR_HOST, project: process.env.FIREBASE_RESTORE_PROJECT_ID, database: process.env.FIRESTORE_RESTORE_DATABASE_ID });
    }
    const filePath = outsideRepositoryPath(process.argv[3], fileURLToPath(new URL('..', import.meta.url)), { existing: true });
    const manifest = JSON.parse(readFileSync(`${filePath}.manifest.json`, 'utf8'));
    const archive = await readRestoreSample({ filePath, manifest, password: process.env.CHANTAKORN_BACKUP_PASSPHRASE, limits: restoreLimits() });
    const result = command === 'restore' ? await restoreToIsolatedEmulator({ archive, target }) : {
      verified: true, checksumVerified: true, authenticated: true, sourceRecords: archive.sourceRecords,
      sourceCollectionCount: archive.sourceCollectionCount, sampleRecords: archive.sample.length,
    };
    console.log(JSON.stringify(result));
  } catch {
    // Paths, customer records, provider errors and credentials never enter terminal logs.
    console.error('Restore validation failed: check archive integrity, passphrase, safety limits and isolated emulator settings');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
