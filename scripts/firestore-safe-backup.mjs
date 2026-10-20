#!/usr/bin/env node
/** Read-only Firestore export. Never exports Firebase Auth accounts or LINE secrets. */
import firestorePackage from '@google-cloud/firestore';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outsideRepositoryPath, backupLimits, firestoreBackupSource, firestoreRecords, createEncryptedArchive, verifyEncryptedArchive } from './firestore-backup-runtime.mjs';

const password = process.env.CHANTAKORN_BACKUP_PASSPHRASE;
const { Firestore, v1 } = firestorePackage;
const command = process.argv[2];
let filePath;

function preflight() {
  if (!password || password.length < 24 || password.length > 512) throw new Error('Provide a strong 24+-character CHANTAKORN_BACKUP_PASSPHRASE outside source control');
  filePath = outsideRepositoryPath(process.argv[3], fileURLToPath(new URL('..', import.meta.url)), { existing: command === 'verify' });
}

async function backup() {
  if (process.env.ALLOW_FIRESTORE_EXPORT_READS !== 'I_UNDERSTAND') throw new Error('Read quota gate: set ALLOW_FIRESTORE_EXPORT_READS=I_UNDERSTAND');
  const firebaseConfig = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
  const dbConfig = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const expectedProject = firebaseConfig.projectId;
  const expectedDatabase = dbConfig.firestore?.database;
  if (!expectedDatabase || expectedDatabase === '(default)' || process.env.FIREBASE_PROJECT_ID !== expectedProject || process.env.FIRESTORE_DATABASE_ID !== expectedDatabase) throw new Error('Explicit Firebase project and NAMED Firestore database must match committed configuration');
  const limits = backupLimits();
  const db = new Firestore({ projectId: expectedProject, databaseId: expectedDatabase });
  const discovery = new v1.FirestoreClient({ projectId: expectedProject });
  const source = firestoreBackupSource({ db, discovery, project: expectedProject, database: expectedDatabase });
  const counts = { records: 0, collections: Object.create(null) };
  try {
    const manifest = await createEncryptedArchive({ filePath, password, records: firestoreRecords(source, counts, limits), counts,
      metadata: { firestoreProject: expectedProject, firestoreDatabase: expectedDatabase } });
    console.log(JSON.stringify({ ok: true, records: manifest.records, collectionCount: Object.keys(counts.collections).length, archive: basename(filePath), manifest: basename(`${filePath}.manifest.json`) }));
  } finally {
    await Promise.allSettled([db.terminate(), discovery.close()]);
  }
}

async function verify() {
  const manifest = JSON.parse(readFileSync(`${filePath}.manifest.json`, 'utf8'));
  console.log(JSON.stringify(await verifyEncryptedArchive({ filePath, manifest, password })));
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
} catch (error) {
  const knownErrors = new Set([
    'Read quota gate: set ALLOW_FIRESTORE_EXPORT_READS=I_UNDERSTAND',
    'Explicit Firebase project and NAMED Firestore database must match committed configuration',
    'Archive path MUST be outside the Git repository',
    'Existing archive or manifest must never be overwritten',
    'Backup document cap reached; aborting incomplete archive',
    'Backup discovery request cap reached', 'Backup document location cap reached',
    'Backup collection cap reached', 'Backup nesting depth cap reached',
    'Firestore changed during backup; retry with writes paused',
    'Encrypted archive checksum mismatch', 'Archive document count mismatch',
    'Collection record count mismatch', 'Unexpected archive collections',
  ]);
  // Never expose provider exceptions, private paths, customer records or passphrases.
  const message = error instanceof Error && knownErrors.has(error.message) ? error.message : 'Check local permissions, settings, passphrase and available storage';
  console.error(`Backup ${command === 'backup' ? 'creation' : 'verification'} failed: ${message}`);
  process.exitCode = 1;
}
