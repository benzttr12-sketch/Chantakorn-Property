#!/usr/bin/env node
/** Read-only Auth metadata backup. It cannot restore passwords or create users. */
import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { authBackupLimits, authBackupSource, authMetadataRecords, createAuthEncryptedArchive, verifyAuthEncryptedArchive } from './firebase-auth-backup-runtime.mjs';

const command = process.argv[2], filePath = process.argv[3];
const password = process.env.CHANTAKORN_BACKUP_PASSPHRASE;

try {
  if (!['backup', 'verify'].includes(command) || process.argv.length !== 4) {
    console.error('Usage: node scripts/firebase-auth-safe-backup.mjs backup|verify /ABSOLUTE/OUTSIDE/REPO/file.auth.enc');
    process.exitCode = 2;
  } else {
    const project = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8')).projectId;
    if (!password || password.length < 24 || password.length > 512) throw new Error('AUTH_PASSPHRASE_INVALID');
    if (command === 'verify') {
      console.log(JSON.stringify(await verifyAuthEncryptedArchive({ filePath, password, expectedProject: project })));
    } else {
      if (process.env.ALLOW_FIREBASE_AUTH_EXPORT_READS !== 'I_UNDERSTAND') throw new Error('AUTH_EXPORT_READ_GATE');
      if (process.env.FIREBASE_PROJECT_ID !== project) throw new Error('AUTH_PROJECT_MISMATCH');
      const limits = authBackupLimits();
      const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
      const source = authBackupSource({ client, project, timeoutMs: limits.timeoutMs });
      const manifest = await createAuthEncryptedArchive({ filePath, password, project, records: authMetadataRecords(source, limits) });
      console.log(JSON.stringify({ ok: true, records: manifest.records, archiveCreated: true, manifestCreated: true,
        scope: manifest.scope, passwordHashesIncluded: false, credentialsRestorable: false }));
    }
  }
} catch (error) {
  // Provider errors may contain bearer headers, UIDs or user records. Never echo them.
  const known = new Set(['AUTH_PROJECT_INVALID', 'AUTH_PASSPHRASE_INVALID', 'AUTH_USER_INVALID', 'AUTH_CLAIMS_INVALID',
    'AUTH_RECORD_INVALID', 'AUTH_LIMIT_INVALID', 'AUTH_BACKUP_TIMEOUT', 'AUTH_PAGE_INVALID', 'AUTH_PAGE_TOO_LARGE',
    'AUTH_PAGE_CAP', 'AUTH_DUPLICATE_UID', 'AUTH_USER_CAP', 'AUTH_REPEATED_PAGE_TOKEN', 'AUTH_MANIFEST_INVALID',
    'AUTH_ARCHIVE_EXISTS', 'AUTH_ARCHIVE_TOO_LARGE', 'AUTH_PROJECT_MISMATCH', 'AUTH_CHECKSUM_MISMATCH',
    'AUTH_RECORD_COUNT_MISMATCH', 'AUTH_ARCHIVE_TRUNCATED', 'AUTH_EXPORT_READ_GATE', 'AUTH_ARCHIVE_IN_REPOSITORY']);
  const code = error instanceof Error && known.has(error.message) ? error.message : 'AUTH_BACKUP_FAILED';
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
}
