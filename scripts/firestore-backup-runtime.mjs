import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, openSync, closeSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { promisify } from 'node:util';
import { createGzip, createGunzip } from 'node:zlib';
import { encodeFirestoreValue, redactCollectionPath, validateEncryptedBackupManifest } from './firestore-backup-codec.mjs';

const scrypt = promisify(scryptCallback);
const PAGE_SIZE = 100;
const MAX_LINE_BYTES = 20 * 1024 * 1024;

/** Resolve symlink/junction parents before deciding whether an archive is off-repo. */
export function outsideRepositoryPath(input, repository, { existing = false } = {}) {
  if (typeof input !== 'string' || !isAbsolute(input)) throw new Error('Supply absolute encrypted archive path');
  const physicalRepository = realpathSync(repository);
  const physicalFile = existing ? realpathSync(input) : join(realpathSync(dirname(input)), basename(input));
  const part = relative(physicalRepository, physicalFile);
  if (!(part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part))) {
    throw new Error('Archive path MUST be outside the Git repository');
  }
  return physicalFile;
}

export function backupLimits(environment = process.env) {
  function limit(name, fallback, maximum) {
    const value = Number(environment[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error('Invalid backup scan limits');
    return value;
  }
  return {
    records: limit('MAX_BACKUP_RECORDS', 10000, 200000),
    locations: limit('MAX_BACKUP_DOCUMENT_LOCATIONS', 20000, 200000),
    requests: limit('MAX_BACKUP_DISCOVERY_REQUESTS', 50000, 500000),
    collections: limit('MAX_BACKUP_COLLECTIONS', 10000, 100000),
    depth: limit('MAX_BACKUP_DEPTH', 100, 100),
  };
}

/** Public SDK adapter; metadata-only pages retain create/update times and missing ancestors. */
export function firestoreBackupSource({ db, discovery, project, database }) {
  const prefix = `projects/${project}/databases/${database}/documents`;
  const options = { autoPaginate: false, timeout: 30000, retry: null };
  return {
    async collections({ parent, pageToken, pageSize }) {
      const [items, , response] = await discovery.listCollectionIds({ parent: parent ? `${prefix}/${parent}` : prefix, pageToken, pageSize }, options);
      return { items, nextPageToken: response?.nextPageToken };
    },
    async documents({ parent, collectionId, pageToken, pageSize }) {
      const [items, , response] = await discovery.listDocuments({ parent: parent ? `${prefix}/${parent}` : prefix,
        collectionId, pageToken, pageSize, showMissing: true, mask: { fieldPaths: [] } }, options);
      return { items: items.map(item => {
        if (typeof item.name !== 'string' || !item.name.startsWith(`${prefix}/`)) throw new Error('Unexpected Firestore resource');
        return { path: item.name.slice(prefix.length + 1), exists: Boolean(item.createTime || item.updateTime) };
      }), nextPageToken: response?.nextPageToken };
    },
    snapshot(path) { return db.doc(path).get(); },
  };
}

/** Discovery must include missing ancestor documents and disable SDK auto-pagination. */
export async function* firestoreRecords(source, counter, limits) {
  const seenCollections = new Set();
  const seenDocuments = new Set();
  let requests = 0, locations = 0;
  async function* pages(method, parent, collectionId) {
    let pageToken;
    const tokens = new Set();
    do {
      if (++requests > limits.requests) throw new Error('Backup discovery request cap reached');
      const page = await source[method]({ parent, collectionId, pageToken, pageSize: PAGE_SIZE });
      if (!Array.isArray(page.items) || page.items.length > PAGE_SIZE) throw new Error('Invalid discovery page');
      yield page.items;
      pageToken = page.nextPageToken || undefined;
      if (pageToken && tokens.has(pageToken)) throw new Error('Repeated discovery page token');
      if (pageToken) tokens.add(pageToken);
    } while (pageToken);
  }
  async function* walk(parent, depth) {
    for await (const collectionIds of pages('collections', parent)) {
      for (const collectionId of collectionIds) {
        if (depth > limits.depth) throw new Error('Backup nesting depth cap reached');
        if (typeof collectionId !== 'string' || !collectionId || collectionId.includes('/')) throw new Error('Invalid collection ID');
        const collectionPath = parent ? `${parent}/${collectionId}` : collectionId;
        if (seenCollections.has(collectionPath)) throw new Error('Duplicate discovered collection');
        seenCollections.add(collectionPath);
        if (seenCollections.size > limits.collections) throw new Error('Backup collection cap reached');
        for await (const documents of pages('documents', parent, collectionId)) {
          for (const item of documents) {
            if (++locations > limits.locations) throw new Error('Backup document location cap reached');
            if (!item || typeof item.path !== 'string' || !item.path.startsWith(`${collectionPath}/`) ||
                item.path.slice(collectionPath.length + 1).includes('/') || !item.path.slice(collectionPath.length + 1)) {
              throw new Error('Invalid discovered document path');
            }
            if (seenDocuments.has(item.path)) throw new Error('Duplicate discovered document');
            seenDocuments.add(item.path);
            if (item.exists) {
              if (++counter.records > limits.records) throw new Error('Backup document cap reached; aborting incomplete archive');
              const snapshot = await source.snapshot(item.path);
              // A concurrent deletion means this scan is inconsistent; never bless it as complete.
              if (!snapshot.exists) throw new Error('Firestore changed during backup; retry with writes paused');
              const template = redactCollectionPath(collectionPath);
              counter.collections[template] = (counter.collections[template] ?? 0) + 1;
              yield JSON.stringify({ path: item.path,
                create_time: snapshot.createTime ? encodeFirestoreValue(snapshot.createTime) : null,
                update_time: snapshot.updateTime ? encodeFirestoreValue(snapshot.updateTime) : null,
                data: encodeFirestoreValue(snapshot.data()),
              }) + '\n';
            }
            // Missing documents can still own customer subcollections.
            yield* walk(item.path, depth + 1);
          }
        }
      }
    }
  }
  yield* walk('', 1);
}

async function keyFor(password, salt) {
  return scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
}
export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Exclusive ownership prevents a failed concurrent backup deleting another archive. */
export async function createEncryptedArchive({ filePath, password, records, metadata, counts }) {
  const manifestPath = `${filePath}.manifest.json`;
  if (existsSync(filePath) || existsSync(manifestPath)) throw new Error('Existing archive or manifest must never be overwritten');
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await keyFor(password, salt), iv);
  let archiveOwned = false, manifestOwned = false, archiveFd, manifestFd;
  try {
    archiveFd = openSync(filePath, 'wx', 0o600);
    archiveOwned = true;
    const output = createWriteStream(filePath, { fd: archiveFd, autoClose: true });
    archiveFd = undefined;
    await pipeline(Readable.from(records), createGzip({ level: 6 }), cipher, output);
    const manifest = validateEncryptedBackupManifest({ version: 1, createdAt: new Date().toISOString(),
      ...metadata, records: counts.records, collections: counts.collections,
      encryption: 'AES-256-GCM', compression: 'gzip', salt: salt.toString('hex'), iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'), sha256: await sha256File(filePath) });
    manifestFd = openSync(manifestPath, 'wx', 0o600);
    manifestOwned = true;
    writeFileSync(manifestFd, JSON.stringify(manifest, null, 2) + '\n');
    closeSync(manifestFd); manifestFd = undefined;
    return manifest;
  } catch (error) {
    if (archiveFd !== undefined) closeSync(archiveFd);
    if (manifestFd !== undefined) closeSync(manifestFd);
    if (archiveOwned) { try { unlinkSync(filePath); } catch {} }
    if (manifestOwned) { try { unlinkSync(manifestPath); } catch {} }
    throw error;
  }
}

export async function verifyEncryptedArchive({ filePath, manifest, password, highWaterMark, decodedChunkSize }) {
  validateEncryptedBackupManifest(manifest);
  if ((await sha256File(filePath)) !== manifest.sha256) throw new Error('Encrypted archive checksum mismatch');
  const decipher = createDecipheriv('aes-256-gcm', await keyFor(password, Buffer.from(manifest.salt, 'hex')), Buffer.from(manifest.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  const decoder = new StringDecoder('utf8');
  let partial = '', count = 0;
  const collectionCounts = Object.create(null), paths = new Set();
  function consume(text) {
    partial += text;
    let position;
    while ((position = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, position); partial = partial.slice(position + 1);
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) throw new Error('Document exceeds verifier safety limit');
      const item = JSON.parse(line);
      if (!item || typeof item.path !== 'string' || !item.data || item.data.$fs !== 'map' || !Array.isArray(item.data.entries)) throw new Error('Malformed archived Firestore document');
      const parts = item.path.split('/');
      if (parts.length % 2 !== 0 || parts.some(part => !part) || paths.has(item.path)) throw new Error('Invalid or duplicate archived document path');
      paths.add(item.path);
      if (++count > manifest.records || count > 200000) throw new Error('Archive document count mismatch');
      const template = redactCollectionPath(parts.slice(0, -1).join('/'));
      collectionCounts[template] = (collectionCounts[template] ?? 0) + 1;
    }
    if (Buffer.byteLength(partial) > MAX_LINE_BYTES) throw new Error('Document exceeds verifier safety limit');
  }
  const sink = new Writable({
    write(chunk, _encoding, done) { try { consume(decoder.write(chunk)); done(); } catch (error) { done(error); } },
    final(done) { try { consume(decoder.end()); if (partial) throw new Error('Truncated JSONL archive'); done(); } catch (error) { done(error); } },
  });
  // pipeline propagates errors from every stage, including a wrong GCM authentication tag.
  await pipeline(createReadStream(filePath, highWaterMark ? { highWaterMark } : undefined), decipher, createGunzip(decodedChunkSize ? { chunkSize: decodedChunkSize } : undefined), sink);
  if (count !== manifest.records) throw new Error('Archive document count mismatch');
  for (const [path, n] of Object.entries(manifest.collections)) {
    if (collectionCounts[path] !== n) throw new Error('Collection record count mismatch');
  }
  if (Object.keys(collectionCounts).length !== Object.keys(manifest.collections).length) throw new Error('Unexpected archive collections');
  return { verified: true, records: count, collections: Object.keys(collectionCounts).length, checksumVerified: true };
}
