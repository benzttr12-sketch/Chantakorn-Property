#!/usr/bin/env node
/** Local encrypted R2 disaster backup. Never uploads, deletes or changes bucket visibility. */
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outsideRepositoryPath } from './firestore-backup-runtime.mjs';
import { r2BackupLimits, parseR2Buckets, wranglerBackupToken, r2BackupSource, createR2EncryptedArchive, verifyR2EncryptedArchive } from './r2-backup-runtime.mjs';

const ACCOUNT = '711ed9021355751ec61335d3096f5a99';
const BUCKETS = ['chantakorn-property-media-prod', 'chantakorn-inquiry-private-prod'];
const repository = fileURLToPath(new URL('..', import.meta.url));
const command = process.argv[2], password = process.env.CHANTAKORN_BACKUP_PASSPHRASE;
try {
  if (!['backup', 'verify'].includes(command) || process.argv.length !== 4) throw new Error('R2_USAGE');
  if (!password || password.length < 24 || password.length > 512) throw new Error('R2_PASSPHRASE_REQUIRED');
  const filePath = outsideRepositoryPath(process.argv[3], repository, { existing: command === 'verify' });
  for (let directory = dirname(filePath);; directory = dirname(directory)) {
    if (existsSync(join(directory, '.git'))) throw new Error('R2_ARCHIVE_IN_REPOSITORY');
    if (dirname(directory) === directory) break;
  }
  const limits = r2BackupLimits();
  if (command === 'verify') {
    const manifest = JSON.parse(readFileSync(`${filePath}.manifest.json`, 'utf8'));
    console.log(JSON.stringify(await verifyR2EncryptedArchive({ filePath, manifest, password, limits })));
  } else {
    if (process.env.ALLOW_R2_EXPORT_READS !== 'I_UNDERSTAND') throw new Error('R2_READ_GATE');
    const buckets = parseR2Buckets(process.env.R2_BACKUP_BUCKETS);
    if (process.env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT || buckets.length !== BUCKETS.length || BUCKETS.some(bucket => !buckets.includes(bucket))) throw new Error('R2_SCOPE_MISMATCH');
    const token = await wranglerBackupToken(repository);
    const source = r2BackupSource({ accountId: ACCOUNT, token, limits });
    const manifest = await createR2EncryptedArchive({ filePath, password, source, accountId: ACCOUNT, buckets, limits });
    console.log(JSON.stringify({ ok: true, objects: manifest.objects, bytes: manifest.bytes, bucketCount: buckets.length, archive: basename(filePath), manifest: basename(`${filePath}.manifest.json`) }));
  }
} catch (error) {
  // Provider bodies, credentials, object keys and customer metadata must never reach tool/CI logs.
  const code = error instanceof Error && /^R2_[A-Z_]+$/.test(error.message) ? error.message : 'R2_BACKUP_FAILED';
  console.error(JSON.stringify({ ok: false, code })); process.exitCode = code === 'R2_USAGE' ? 2 : 1;
}
