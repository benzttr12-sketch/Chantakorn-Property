# Cloudflare D1 + R2 fresh-start migration — historical plan

This records the proposal against `main` commit `241411043294fae356925e97cb6c6f8d74cadac8` on 20 October 2026. It is not a current deployment or data-import runbook. Use [current catalog scope and verification](d1-r2-cutover-plan.md) and [code readiness](cloudflare-d1-r2-release-readiness.md) for ongoing work.

## Original proposal and subsequent scope

| Original proposal | Current code / later record |
| --- | --- |
| Start D1 with zero listings; leave the three old listings archived | The 25 October cutover record reports importing three listings and 15 images. Do not reset or repeat that import from this plan. Verify present data first. |
| Move selected leads, LINE state, work jobs, settings and agents after backup review | These business-data paths remain on Firestore. The current migration covers the property catalog; D1 tables alone do not implement further migration. |
| Retain Firebase Authentication | Still required for login and signed identities checked by the Worker. |
| Public-only R2 delivery bucket/CDN | Current property bucket contains both draft and published media and stays private behind Worker publication checks. A separate public-only CDN remains a growth option. |
| Deploy and cut over in later PRs | Catalog code now defaults to Cloudflare and the production Worker origin. Hosting overrides and live behavior require separate verification. |

The initial sequence proposed schema/auth/media/catalog work before customer operations and LINE migration. Catalog CRUD, pagination, image validation, upload sessions and the offline staff-role importer are implemented. This does not establish that production flags, backups, restore tests or the complete staff roster have been verified today.

## Requirements retained from the plan

- Keep one authoritative write backend per resource. Never silently substitute sample data or Firestore when the selected production catalog fails.
- Keep Firebase Auth and the Firestore data still used by business workflows. Review retention and verify restore before considering any separate deletion.
- Inventory the **named** Firestore database in `firebase.json`, including subcollections, customer photos, profiles/roles, LINE opt-outs and work jobs that may exist only in a browser.
- Keep confidential exports encrypted outside GitHub, CI and conversations. Store platform/API secrets in the hosting secret manager.
- Reconcile Firebase Auth UID, verified/disabled state and approved D1 roles. Existing `staff:import` is insert-only and cannot apply later role changes.
- Before a further migration or rollback, pause affected writes, capture a final delta and reconcile all records/media added since the previous snapshot. A previous deployment and old database are insufficient when their data has diverged.
- Validate permissions, private media, idempotency, LINE signatures/retries, query cost and error monitoring for every workflow moved to a new authority.

## Further business-data migration

Inquiries, LINE followers/state, featured agents, work jobs and settings remain on Firebase. Moving them would require a separate scoped implementation: API contracts and authorization, frontend/server adapters, source inventory and an offline reviewed import plan, staging restore/flow tests, then coordinated authority change. They are outside the catalog migration.

Backup procedures: [admin backup operations](admin-backup-operations.md) and [encrypted Firestore backup/restore gate](firestore-encrypted-backup-runbook.md). Local synthetic tests and a public catalog smoke check do not replace a production-data restore test.
