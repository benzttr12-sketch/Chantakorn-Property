# Encrypted Firestore backup runbook — before D1 cutover

**Status: TOOLING ONLY. No backup of production data has been run.** This is not permission to delete Firestore. Operate with a trusted human and a **read-only** Google identity. Do not upload the archive, encryption password, Auth user list or LINE follower IDs to GitHub, PRs, AI chats or CI.

## What it covers

`scripts/firestore-safe-backup.mjs` enumerates top-level Firestore collections **and all nested subcollections** in the **named** database configured in `firebase.json`. It reads stored documents and encodes Firestore-native timestamps, geopoints, document references and bytes using explicit type markers. It archives JSONL as gzip then encrypts the stream using **AES-256-GCM**, with a passphrase-derived key and random salt/IV. Output file permissions are restricted to the local operating-system user. Archive must be **outside the Git repository** and cannot overwrite a previous file.

The separate plaintext manifest contains only database identifiers, timestamp, document counts by **redacted collection template** (e.g. `inquiries/{doc}/notes`), encryption parameters and a SHA-256 ciphertext checksum; it MUST NOT contain actual document paths, names, phone numbers, tokens or messages. Keep the manifest in access-controlled storage with the archive.

**Not covered:** Firebase Authentication users (different product), LINE provider-side chat history, existing LINE tokens, browser-localStorage-only jobs, Vercel settings, secrets, R2 objects, exported Google Map images, or third-party data. Handle each separately. Existing property rows/images are in the private disaster-recovery archive but **will not be imported to fresh D1**.

## Mandatory preparation

1. Confirm the project in `firebase-applet-config.json`, its exact **named** Firestore database in `firebase.json`, and that credentials have read-only Firestore access. Do not guess `(default)`.
2. Choose an encrypted offline destination **outside** the repo, for example an encrypted external disk. Test disk space; customer image payloads may enlarge the archive.
3. Use Google Application Default Credentials with least-privileged, time-bounded Firestore read access; do not copy service-account private keys to repo or Cloudflare. A Vercel OIDC token is not automatically a local ADC credential.
4. Set a distinct backup passphrase of at least 24 characters in an isolated local shell and save it **separately** in a password manager. Do not put it into `.env`, shell-history command lines, CI or PRs.
5. Consider Firebase read quotas and egress; this client scan reads every document and may consume free quota or incur billable usage. **Never enable billing automatically.**
6. Do not run these commands in CI or from an AI tool with production credentials. Run after authorized local environment and backup ownership are confirmed.

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
node scripts/firestore-safe-backup.mjs backup /secure/off-repo/chantakorn.firestore.enc
```

The script fails rather than silently exporting the wrong Firestore database, leaking raw document IDs to the manifest, exceeding the record cap, writing over another archive or writing into the repository. It is read-only against Firestore (but writes local encrypted files).

## Offline verification before any cutover

```sh
export CHANTAKORN_BACKUP_PASSPHRASE
node scripts/firestore-safe-backup.mjs verify /secure/off-repo/chantakorn.firestore.enc
```

This verifies SHA-256 integrity, AES-GCM authentication, gzip/JSONL parsing and counts per redacted collection path without printing private contents or reconnecting to Firestore.

**Additional mandatory manual checks:** (a) separately inventory Firebase Auth UID/provider/disabled status; (b) compare `profiles` role UIDs to Auth; (c) inspect active customer inquiries and private photos; (d) reconcile active `work_jobs` with possible browser-only copies; (e) verify LINE follower and opt-out counts plus signed webhook behavior; (f) test an actual isolated **restore of a restricted sample**. The offline integrity verifier is **not** a substitute for restore testing or for taking a delta backup just before the final cutover.

After verification, store encrypted archive and password separately, record the manifest checksum and archive custodian, set a reviewed retention policy, and leave production Firestore in place. **Do not delete Firestore or the Firebase project.** Firebase Authentication remains in use after D1 migration.

## Testing (no production credentials)

```sh
npm ci
node --test tests/firestore-backup-codec.test.cjs
```
