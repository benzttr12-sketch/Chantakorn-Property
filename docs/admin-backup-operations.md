# Admin-only local encrypted backups

This is an operator workflow on the trusted Windows administrator's machine. There is no website backup download endpoint, public bucket or new service-account key. Existing read-only Google ADC and the existing Wrangler login supply provider access. Do not run exports in CI.

## Scope and custody

- Firestore: all discovered existing documents in the committed named database, including nested subcollections below missing ancestors. Original old property rows may be retained in this private recovery archive; they are never imported into D1.
- Firebase Auth: project-default account identity/provider/custom-claim metadata. Password hashes, salts, refresh tokens and MFA secrets are deliberately excluded. This is **not** a password-restoration export and does not create, disable or modify accounts.
- R2: the two configured production media buckets, preserving raw object bytes and encrypted keys/metadata. List/read only; no upload, delete or visibility change. Object size/ETag checks and a second inventory reject observed concurrent changes.

On Windows, `scripts/admin-backup-vault.ps1` creates `~/Chantakorn-Backups` outside all Git checkouts. It grants access only to the current Windows account and protects the directory ACL from inherited access. Keys live separately under `%LOCALAPPDATA%/Chantakorn/BackupKeys`, protected with Windows current-user DPAPI and the same private ACL. Files are created exclusively; existing snapshots are never overwritten. Links/junctions and unrelated preexisting directories are rejected.

The current Windows account must be the trusted backup administrator. A Firebase website role does not by itself grant access to these local files. Operating-system administrators can take ownership as usual; this workflow does not claim to resist a compromised administrator or device.

DPAPI recovery requires this Windows user's profile on this machine. **Do not delete that profile/key directory.** This local copy is not an off-device disaster-recovery plan. The administrator must arrange a separately protected portable recovery key and off-device archive custody before relying on recovery after loss of the device. Neither a password nor decrypted customer data should be placed in chat, source control, cloud logs or CI.

## Prepare and run

Use a trusted local PowerShell7 shell in the repository. Preparation creates only private directories, encrypted key custody and non-sensitive snapshot metadata; it does not read production records.

```powershell
pwsh -NoProfile -File scripts/admin-backup-vault.ps1 -Action Prepare
```

Record the returned snapshot identifier. After the administrator authorizes read-only production backup, run:

```powershell
pwsh -NoProfile -File scripts/admin-backup-vault.ps1 -Action Backup -SnapshotId SNAPSHOT_ID -AllowProductionReads
pwsh -NoProfile -File scripts/admin-backup-vault.ps1 -Action Verify -SnapshotId SNAPSHOT_ID
pwsh -NoProfile -File scripts/admin-backup-vault.ps1 -Action Reconcile -SnapshotId SNAPSHOT_ID
```

The wrapper unwraps the DPAPI key only into the transient child environment, never into arguments or output. It verifies each archive immediately after creation and clears/restores the environment. Output contains counts, integrity status and generic failure codes only. It disables Wrangler token disk logging and telemetry before privately capturing its existing credential. The wrapper uses conservative caps:1000 Firestore documents,2000 discovered locations,5000 discovery requests,1000 Auth accounts and1000 R2 objects/256MiB. Limit failures leave no successful/completed backup claim; inspect actual provider quotas before increasing caps. No billing is enabled or changed.

Individual scripts also support `backup|verify ABSOLUTE_OFF_REPO_FILE` with `CHANTAKORN_BACKUP_PASSPHRASE` supplied in a trusted process environment. Never supply the passphrase on the command line. Firestore/Auth project and database gates and the explicit R2 account/bucket gates must match committed configuration. Verification does not access the providers.

Offline reconciliation authenticates and checks every Firestore/Auth record before comparing profile UIDs/roles to enabled Auth identities and inspecting LINE follower identities/states. It reports aggregate counts and findings only. `complete:true` means the bounded inventories were fully examined; check `inventoriesMatch` and the findings count separately. It does not grant roles, repair identities automatically or imply an atomic snapshot.

## Integrity and isolated restore

All exports stream directly into gzip/AES-256-GCM ciphertext, with no plaintext staging files. Separate manifests contain only source identifiers, redacted counts, cryptographic parameters and ciphertext checksums. Auth/R2 source headers are authenticated with GCM additional data. R2 verification checks every original object-byte SHA-256 as well as the encrypted archive checksum. Firestore/Auth verification validates typed records, uniqueness, counts and limits.

`scripts/firestore-restore-validation.mjs inspect` authenticates the entire Firestore archive and validates native types before returning redacted counts. Its `restore` command can write only to an explicit numeric-loopback Firestore emulator, a `demo-*` project and a fresh `restore-*` named database. It refuses production/remote destinations and nonempty databases, uses create-only writes, then compares the reread typed sample. Before opening a writer it rejects reserved `__.*__` fields and timestamp precision finer than Firestore's microsecond storage; it never silently drops fields or rounds archived values to claim success. It cannot restore original server create/update times. Never place customer records into an emulator accessible to other users; use synthetic records for ordinary development validation.

These scans do not pause application/customer/LINE writes and are **not atomic point-in-time snapshots**. Snapshot metadata explicitly keeps `sourceWritesPaused:false` and `cutoverReady:false`. Retain Firestore and Firebase Auth. A coordinated final delta, identity/role review, retention decision and portable-key/off-device custody remain separate cutover gates. No script imports old property listings or changes production roles.

Storage constraints follow the official [Firestore data types](https://firebase.google.com/docs/firestore/manage-data/data-types) and [REST document field contract](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents). The backup retains encoded data; unsupported restore values are rejected before writes.

## Evidence boundaries

Unit fixtures exercise encryption/tamper rejection, native-value restore, path protections, concurrent export ownership, pagination and caps. Windows tests exercise real DPAPI recovery and private ACLs. The optional real emulator fixture is enabled with `RUN_FIRESTORE_RESTORE_EMULATOR_TESTS=true` and a numeric-loopback `FIRESTORE_EMULATOR_HOST`; it uses synthetic records only. Do not present fixture results as a completed production-data restore or a transactionally consistent migration snapshot.
