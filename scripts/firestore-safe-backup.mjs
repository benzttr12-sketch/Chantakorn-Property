#!/usr/bin/env node
/**
 * Read-only, encrypted Firestore archive. NEVER uploads PII to GitHub or Cloudflare.
 * This script does NOT export Firebase Authentication accounts, LINE channel secrets,
 * browser-local work jobs, or external LINE conversation history.
 *
 * Examples:
 * CHANTAKORN_BACKUP_PASSPHRASE=... ALLOW_FIRESTORE_EXPORT_READS=I_UNDERSTAND \
 * FIREBASE_PROJECT_ID=... FIRESTORE_DATABASE_ID=... GOOGLE_APPLICATION_CREDENTIALS=/secure/read-only.json \
 * node scripts/firestore-safe-backup.mjs backup /secure/off-repo/chantakorn-20261020.firestore.enc
 *
 * CHANTAKORN_BACKUP_PASSPHRASE=... node scripts/firestore-safe-backup.mjs verify \
 * /secure/off-repo/chantakorn-20261020.firestore.enc
 */
import { Firestore, FieldPath } from '@google-cloud/firestore';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { encodeFirestoreValue, validateEncryptedBackupManifest } from './firestore-backup-codec.mjs';

const scrypt = promisify(scryptCallback);
const PAGE_SIZE = 100;
const password = process.env.CHANTAKORN_BACKUP_PASSPHRASE;
const command = process.argv[2];
const filePath = process.argv[3] && resolve(process.argv[3]);
const manifestPath = filePath && `${filePath}.manifest.json`;

function preflight() {
  if (!password || password.length < 24 || password.length > 512)
    throw new Error('Provide a strong 24+-character CHANTAKORN_BACKUP_PASSPHRASE outside source control');
  if (!filePath || !isAbsolute(filePath)) throw new Error('Supply absolute encrypted archive path');
  const repo = resolve(new URL('..', import.meta.url).pathname);
  const relativeToRepo = relative(repo, filePath);
  if (!relativeToRepo.startsWith('..') || filePath.includes('/.git/'))
    throw new Error('Archive path MUST be outside the Git repository');
}

async function keyFor(salt) {
  return scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function* fireStoreRecords(db, counter, maxRecords) {
  const top = await db.listCollections();
  for (const col of top) {
    yield* walkCollection(col, counter, maxRecords);
  }
}

async function* walkCollection(collection, counter, maxRecords) {
  let lastDocument = null;
  for (;;) {
    let query = collection.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDocument) query = query.startAfter(lastDocument);
    const page = await query.get();
    if (page.empty) return;
    for (const snapshot of page.docs) {
      if (++counter.records > maxRecords) throw new Error('Backup document cap reached; aborting incomplete archive');
      const collectionPath = collection.path;
      counter.collections[collectionPath] = (counter.collections[collectionPath] ?? 0) + 1;
      const line = {
        path: snapshot.ref.path,
        create_time: snapshot.createTime ? encodeFirestoreValue(snapshot.createTime) : null,
        update_time: snapshot.updateTime ? encodeFirestoreValue(snapshot.updateTime) : null,
        data: encodeFirestoreValue(snapshot.data()),
      };
      yield JSON.stringify(line) + '\n';
      // Capture *all* subcollections, not only paths listed in firestore.rules.
      for (const child of await snapshot.ref.listCollections()) {
        yield* walkCollection(child, counter, maxRecords);
      }
    }
    if (page.size < PAGE_SIZE) return;
    lastDocument = page.docs.at(-1);
  }
}

async function backup() {
  if (process.env.ALLOW_FIRESTORE_EXPORT_READS !== 'I_UNDERSTAND') {
    throw new Error('Read quota gate: set ALLOW_FIRESTORE_EXPORT_READS=I_UNDERSTAND');
  }
  if (existsSync(filePath) || existsSync(manifestPath)) throw new Error('Existing archive or manifest must never be overwritten');

  const firebaseConfig = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
  const dbConfig = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const expectedProject = firebaseConfig.projectId;
  const expectedDatabase = dbConfig.firestore?.database;
  if (!expectedDatabase || expectedDatabase === '(default)' ||
      process.env.FIREBASE_PROJECT_ID !== expectedProject ||
      process.env.FIRESTORE_DATABASE_ID !== expectedDatabase) {
    throw new Error('Explicit Firebase project and NAMED Firestore database must match committed configuration');
  }
  // Service account/ADC must have read-only Firestore privileges, not write/delete access.
  const db = new Firestore({
    projectId: expectedProject,
    databaseId: expectedDatabase,
  });
  const maxRecords = Number(process.env.MAX_BACKUP_RECORDS || '10000');
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 200000)
    throw new Error('MAX_BACKUP_RECORDS must be an integer between 1 and 200000');

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await keyFor(salt), iv);
  const counts = { records: 0, collections: Object.create(null) };
  try {
    await pipeline(
      Readable.from(fireStoreRecords(db, counts, maxRecords)),
      createGzip({ level: 6 }),
      cipher,
      createWriteStream(filePath, { flags: 'wx', mode: 0o600 }),
    );
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      firestoreProject: expectedProject,
      firestoreDatabase: expectedDatabase,
      records: counts.records,
      collections: counts.collections,
      encryption: 'AES-256-GCM',
      compression: 'gzip',
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      sha256: await sha256File(filePath),
    };
    validateEncryptedBackupManifest(manifest);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ ok: true, records: manifest.records, collectionCount: Object.keys(counts.collections).length, archive: basename(filePath), manifest: basename(manifestPath) }));
  } catch (error) {
    try { if (existsSync(filePath)) unlinkSync(filePath); } catch {}
    try { if (existsSync(manifestPath)) unlinkSync(manifestPath); } catch {}
    throw error;
  }
}

async function verify() {
  const manifest = validateEncryptedBackupManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if ((await sha256File(filePath)) !== manifest.sha256)
    throw new Error('Encrypted archive checksum mismatch');
  const key = await keyFor(Buffer.from(manifest.salt, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(manifest.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));

  const decrypted = createReadStream(filePath).pipe(decipher).pipe(createGunzip());
  let partial = '', count = 0;
  const collectionCounts = Object.create(null);
  for await (const chunk of decrypted) {
    partial += chunk.toString('utf8');
    let pos;
    while ((pos = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, pos);
      partial = partial.slice(pos + 1);
      const item = JSON.parse(line);
      if (!item || typeof item.path !== 'string' || typeof item.data !== 'object' || item.data?.$fs !== 'map') {
        throw new Error('Malformed archived Firestore document');
      }
      const parts = item.path.split('/');
      if (parts.length % 2 !== 0 || parts.some(part => !part)) throw new Error('Invalid archived document path');
      const collPath = parts.slice(0, -1).join('/');
      collectionCounts[collPath] = (collectionCounts[collPath] ?? 0) + 1;
      count++;
    }
    if (partial.length > 20 * 1024 * 1024) throw new Error('Document exceeds verifier safety limit');
  }
  if (partial) throw new Error('Truncated JSONL archive');
  if (count !== manifest.records) throw new Error('Archive document count mismatch');
  const expected = manifest.collections ?? {};
  for (const [path, n] of Object.entries(expected)) {
    if (collectionCounts[path] !== n) throw new Error('Collection record count mismatch');
  }
  if (Object.keys(collectionCounts).length !== Object.keys(expected).length)
    throw new Error('Unexpected archive collections');
  console.log(JSON.stringify({ verified: true, records: count, collections: Object.keys(collectionCounts).length, checksumVerified: true }));
}

try {
  if (command !== 'backup' && command !== 'verify') {
    console.error('Usage: node scripts/firestore-safe-backup.mjs backup|verify /ABSOLUTE/OUTSIDE/REPO/file.firestore.enc');
    process.exitCode = 2;
  } else {
    preflight();
    if (command === 'backup') await backup();
    else await verify();
  }
} catch (err) {
  // Never log records, passphrases or underlying stack with possible sensitive IDs.
  console.error(`Backup ${command === 'backup' ? 'creation' : 'verification'} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  process.exitCode = 1;
}
