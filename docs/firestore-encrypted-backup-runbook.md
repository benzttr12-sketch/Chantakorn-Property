# Encrypted Firestore backup runbook — before D1 cutover

**Status: TOOLING ONLY. No backup of production data has been run.** This is not permission to delete Firestore. Operate with a trusted human and a **read-only** Google identity. Do not upload the archive, encryption password, Auth user list or LINE follower IDs to GitHub, PRs, AI chats or CI.

## What it covers

`scripts/firestore-safe-backup.mjs` enumerates top-level Firestore collections **and nested subcollections, including descendants of missing/deleted ancestor documents**, in the **named** database configured in `firebase.json`. It uses explicitly paged metadata discovery with `showMissing: true`, then reads existing documents through the typed server SDK. The server metadata API is required here to discover absent ancestors; application query/pipeline results alone do not enumerate them. It encodes Firestore-native timestamps, geopoints, document references and bytes using explicit type markers, archives JSONL as gzip, then encrypts the stream using **AES-256-GCM**, with a passphrase-derived key and random salt/IV.

Archive destinations must be absolute and **outside the Git repository** after resolving physical directories, symlinks and Windows junctions. Sibling directories and separate drives are supported. Exclusive file creation prevents overwrites; failed/concurrent scans clean up only files they created. The script requests mode `0600` on systems that support POSIX permissions. **On Windows, use an encrypted disk and independently restrict the destination directory's NTFS ACL**; the mode alone does not establish Windows access control.

The separate plaintext manifest contains only database identifiers, timestamp, document counts by **redacted collection template** (e.g. `inquiries/{doc}/notes`), encryption parameters and a SHA-256 ciphertext checksum; it MUST NOT contain actual document paths, names, phone numbers, tokens or messages. Keep the manifest in access-controlled storage with the archive.

**Not covered:** Firebase Authentication users (different product), LINE provider-side chat history, existing LINE tokens, browser-localStorage-only jobs, Vercel settings, secrets, R2 objects, exported Google Map images, or third-party data. Handle each separately. Existing property rows/images are in the private disaster-recovery archive but **will not be imported to fresh D1**.

## Mandatory preparation

1. Confirm the project in `firebase-applet-config.json`, its exact **named** Firestore database in `firebase.json`, and that credentials have read-only Firestore access. Do not guess `(default)`.
2. Choose an encrypted offline destination **outside** the repo, for example an encrypted external disk. Test disk space; customer image payloads may enlarge the archive.
3. Use Google Application Default Credentials with least-privileged, time-bounded Firestore read access; do not copy service-account private keys to repo or Cloudflare. A Vercel OIDC token is not automatically a local ADC credential.
4. Set a distinct backup passphrase of at least 24 characters in an isolated local shell and save it **separately** in a password manager. Do not put it into `.env`, shell-history command lines, CI or PRs.
5. Consider Firebase read quotas and egress. Metadata discovery plus a separate typed read of every existing document costs more than the previous existing-document-only scan. Each discovered location also needs a subcollection-list request, even if it has no children. This can consume free quota or incur billable usage. **Never enable billing automatically.** Select conservative scan limits before starting; caps are fail-closed limits, not a free-tier guarantee. Provider accounting and SDK read retries can add usage.
6. Do not run these commands in CI or from an AI tool with production credentials. Run after authorized local environment and backup ownership are confirmed.
7. Pause application/admin writes for a complete cutover snapshot and include LINE webhook/customer submissions in that operational plan. This client scan is **not a transactionally consistent point-in-time export**. It fails if an enumerated existing document disappears before its typed read, but cannot detect every concurrent insert/update. If writes cannot be paused, retain Firestore, reconcile changes, and take a final reviewed delta backup before cutover.

The confirmed target edition is Enterprise Native mode; these backup calls use the read-only metadata/document API to preserve source types and missing ancestors. They do not modify application query semantics, indexes, Firebase Auth or database settings.

## Create a read-only encrypted backup (example)

```sh
# Run on a trusted machine with ADC scoped to Firestore READ ONLY.
npm ci
read -r -s -p 'Backup passphrase: ' CHANTAKORN_BACKUP_PASSPHRASE
echo
export CHANTAKORN_BACKUP_PASSPHRASE
export FIREBASE_PROJECT_ID='YOUR_COMMITTED_FIREBASE_PROJECT_ID'
export FIRESTORE_DATABASE_ID='YOUR_NAMED_FIRESTORE_DATABASE'
export GOOGLE_APPLICATION_CREDENTIALS='/secure/path/to/read-only-credentials.json'
export ALLOW_FIRESTORE_EXPORT_READS=I_UNDERSTAND
export MAX_BACKUP_RECORDS=10000
export MAX_BACKUP_DOCUMENT_LOCATIONS=20000
export MAX_BACKUP_DISCOVERY_REQUESTS=50000
export MAX_BACKUP_COLLECTIONS=10000
export MAX_BACKUP_DEPTH=100
node scripts/firestore-safe-backup.mjs backup /secure/off-repo/chantakorn.firestore.enc
```

The script fails rather than silently exporting the wrong Firestore database, leaking raw document IDs to the manifest, exceeding a scan cap, writing over another archive or writing into the repository. Discovery pages contain at most 100 entries and automatic pagination is disabled for discovery calls; SDK retries can add provider requests. The document-location cap includes missing ancestors; request, collection and nesting-depth caps prevent empty/deep trees from scanning indefinitely. Exceeding any cap removes the incomplete archive. The maximum allowed settings are 200,000 records, 200,000 document locations, 500,000 discovery calls, 100,000 collections and depth 100. These ceilings do not replace an approved read budget. It is read-only against Firestore (but writes local encrypted files).

## Offline verification before any cutover

```sh
export CHANTAKORN_BACKUP_PASSPHRASE
node scripts/firestore-safe-backup.mjs verify /secure/off-repo/chantakorn.firestore.enc
```

This verifies SHA-256 integrity, AES-GCM authentication, gzip/JSONL parsing, unique document paths and counts per redacted collection path without printing private contents or reconnecting to Firestore. UTF-8 decoding preserves Thai characters across stream chunk boundaries, and stream failures reject the entire verification. It does not restore data, reconcile Auth/LINE, or prove that the source remained unchanged during the export.

**Additional mandatory manual checks:** (a) separately inventory Firebase Auth UID/provider/disabled status; (b) compare `profiles` role UIDs to Auth; (c) inspect active customer inquiries and private photos; (d) reconcile active `work_jobs` with possible browser-only copies; (e) verify LINE follower and opt-out counts plus signed webhook behavior; (f) test an actual isolated **restore of a restricted sample**. The offline integrity verifier is **not** a substitute for restore testing or for taking a delta backup just before the final cutover.

After verification, store encrypted archive and password separately, record the manifest checksum and archive custodian, set a reviewed retention policy, and leave production Firestore in place. **Do not delete Firestore or the Firebase project.** Firebase Authentication remains in use after D1 migration.

## Testing (no production credentials)

```sh
npm ci
node --test tests/firestore-backup-codec.test.cjs tests/firestore-backup-runtime.test.cjs
```

The offline fixture exercises actual export traversal/encryption/verification, missing-parent descendants, manual metadata pagination, scan limits, Windows junction confinement, split Thai UTF-8, wrong password/tag/checksum, incomplete scans and concurrent creators. It contains synthetic records only. Passing these tests is not evidence of a production backup or isolated Firestore restore.
