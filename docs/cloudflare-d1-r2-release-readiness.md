# Cloudflare D1/R2 property catalog — code and operational readiness

The repository implements the property catalog on Cloudflare D1/R2 and defaults to the production Worker origin in `next.config.mjs`. Firebase Auth and other business-data paths remain in use. Code defaults, historical staging results and local tests do not certify the current deployment, staff roster or backups. Follow the [catalog verification and rollback runbook](d1-r2-cutover-plan.md).

## Historical implementation evidence

PRs #51–#67 delivered media lifecycle checks, native Admin pagination, complete supported-image decoding and verified offline staff import; these changes are present in the repository. The earlier statement that all were open draft PRs described their development stage, not current status.

The staging record dated 24 October 2026 described Worker `chantakorn-property-api-dev`, D1 `chantakorn-property-dev`, private R2 buckets and migrations 0001–0007. Its recorded local results were app lint/typecheck, 344 root tests, 59 Worker tests, 22 local runtime tests and schema verification. Its smoke results included an empty public catalog, anonymous Admin rejection and CORS checks. The later 25 October record describes a production catalog import. Neither record is a fresh runtime or backup verification.

## Implemented catalog checks

| Area | Code behavior | Operational follow-up |
| --- | --- | --- |
| Staff access | Signed Firebase identity, D1 role and live account-state verification | Reconcile approved UIDs and role changes across D1/Firestore; the importer is insert-only |
| Draft-first writes | Protected CRUD, optimistic revisions and transactional audit | Confirm write/publication flags and staging browser flow |
| Public catalog | Published-only fields, detail lookup, search and keyset pagination | Verify deployed catalog, detail, CORS on both website origins and media delivery |
| Media uploads | Sessions, quotas, rate limits and PNG/baseline JPEG validation | Confirm bindings, flags and real browser uploads in staging |
| Media deletion | D1 metadata deleted first, R2 best-effort cleanup | Monitor failures and scheduled orphan sweep |
| Catalog cache | Generation invalidation for properties, media and agents; namespace `public-catalog-v3`; private/Admin data excluded | Apply migration 0008 before deploying the updated Worker; confirm opt-in flag, query costs and load behavior |
| Admin pagination | Native filtered queries and revision-aware editor | CSV export contains loaded rows only |
| Catalog agents | Protected canonical D1 identities for editor selection; list/detail contact hydration; public contacts honor `is_public=1` | Deploy/check `/v1/admin/agents` and agent-aware catalog responses before dependent frontend builds; featured-agent profiles remain in Firestore |

PNG and baseline JPEG are fully decoded before R2 storage. Interlaced PNG, progressive/arithmetic/multi-scan/restart JPEG and WebP uploads are rejected; the browser compressor emits metadata-free JPEG. Direct camera uploads may need client re-encoding.

## Verify before changing data authority

1. Inspect deployed Vercel/Pages environment overrides and the actual Worker origin used by the browser. Do not assume the old pending-cutover checklist is current.
2. Run `npm run verify:cloudflare -- --require-listings` from the repository root for read-only public list/CORS checks and one sampled listing's detail/image. The flag fails on an empty catalog; it does not inventory every record/media object, test staff writes or prove migration completeness.
3. Check the intended account's D1/R2 bindings, migrations, exact allowed origins, feature flags and Cron. Apply D1 migrations through `0008_catalog_agent_generation.sql`, then deploy the updated Worker, then the frontend, then run smoke/flow checks. Repository changes do not establish that this rollout has happened. Keep draft and customer media buckets private.
4. Exercise draft create/edit/upload/publish/unpublish in isolated staging, including account revocation, revision conflicts and disabled feature flags. Historical results do not replace current acceptance.
5. Verify encrypted backups, restore results and post-snapshot changes using the [backup runbook](firestore-encrypted-backup-runbook.md). Review staff roles and retain business data still served by Firestore.
6. Route `R2_MEDIA_SWEEP`, `R2_MEDIA_SWEEP_FAILED` and `R2_MEDIA_ORPHAN_CLEANUP_REQUIRED` logs to an external alert and record the evidence.
7. For rollback, pause catalog writes and reconcile post-cutover D1/R2 changes before switching configuration. Changing the backend variable alone does not restore new data to Firestore. Keep one write authority.

## Remaining limits

- Dashboard, social automation and valuation screens materialise at most 100 pages / 10,000 rows; move aggregates server-side before meaningful growth.
- Public images pass through a Worker from a mixed draft/published private bucket. A separate public-only CDN can reduce request costs at higher traffic.
- Public property images use `private, max-age=180`: fresh requests check publication, but a previously loaded image can remain in that browser's cache for up to three minutes after unpublishing. Catalog and private customer-media responses use `no-store`.
- Substring/JSON-feature searches can scan rows on cache misses; production-like load and query-cost measurements require operational evidence.
- Firestore role edits in `/admin/users` do not update D1 roles. The offline importer only adds missing rows; role changes/revocation need a trusted D1 operation as well.
- Customer intake, private customer photos, LINE follower/settings data, work jobs and other business workflows remain on Firebase. Their D1 schema is not a completed migration.
- Hosting, Maps and LINE limits and costs are not established by repository tests.
