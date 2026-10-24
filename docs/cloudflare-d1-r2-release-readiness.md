# Cloudflare D1/R2 property catalog — code-side release readiness

**Status:** code-side gate review after stacked PRs #51–#62. **No production deployment, database migration to production, cutover, or real-data change has been performed.** All evidence below is from local tests and CI on draft stacked PRs; final acceptance still requires the operator gates at the end.

## Evidence

- All PRs #51–#62 are open **draft** PRs with chained bases (each based on the previous branch) and green required CI (`Cloudflare D1 API (isolated checks)` and, where root files changed, `Cloudflare property Admin bridge (root checks)`).
- Local verification used for the latest branch: app lint, app typecheck, root tests (344), Worker typecheck, Worker unit tests (57), local workerd runtime tests with real D1/R2 bindings (21), and `scripts/verify_schema.py` against migrations 0001–0007.
- Tests use synthetic records only. No Firebase project, Cloudflare account, LINE credentials or customer data were accessed.

## Gate matrix

| Gate | Delivered by | State | Residual risk |
| --- | --- | --- | --- |
| Draft-media staff preview | #51 | ✅ | none known |
| Guarded R2 media deletion | #52 | ✅ | delete is D1-row-first, R2 best-effort; leftovers handled by sweep |
| Bounded R2 orphan sweep + status | #53 | ✅ | external log-alert routing still required |
| Image container validation + metadata rejection | #54 | ✅ | JPEG/WebP pixel decode open (below) |
| Verified staff-role import planner | #55 | ✅ | actual roster import is operator-only |
| Filtered keyset Admin listing API | #56 | ✅ | search is substring/scan on cache miss |
| Admin list/editor native pagination | #57 | ✅ | CSV export covers loaded rows only |
| Upload sessions (server) | #58 | ✅ | enabling the required flag is operator step |
| Upload sessions (browser client) | #59 | ✅ | real-browser staging verification pending |
| Whole-catalog screens off the 800-row bridge | #60 | ✅ | dashboard/automation still materialise the catalog |
| Per-staff upload/session rate limits | #61 | ✅ | complements, not replaces, edge/WAF controls |
| PNG full pixel decode | #62 | ✅ | JPEG/WebP pixel decode open |

## Open decision: JPEG/WebP pixel decoding

Accepted containers are still structurally validated and metadata-free, but JPEG entropy data and WebP VP8/VP8L image data are not pixel-decoded inside the Worker. This is the only remaining **image-decoding** gate. Options for the owner:

1. **WASM decoder in the Worker** (e.g. `@jsquash/jpeg`, `@jsquash/webp`): full decode for both formats, but adds WASM bundling config, dependency-audit surface and CPU cost per upload. Highest assurance.
2. **Accept the current boundary**: only the app's canvas re-encoder is a supported client, uploads are rate-limited/metadata-free/container-validated, and edge/WAF abuse controls stay enabled. Requires explicit risk sign-off.
3. **Narrow the accepted formats**: implement a baseline-JPEG decoder and switch the client compressor to JPEG (reject lossy VP8 WebP, keep lossless WebP). Full pixel decode with no new dependency, but changes delivered image format/quality.

Do not enable `MEDIA_WRITES_ENABLED` in production until one option is chosen.

## Operator gates before production (in order)

1. Create isolated staging D1 (fresh, unseeded), private property-media R2 bucket and private inquiry R2 bucket; apply migrations 0001–0007 to staging only.
2. Configure the Worker: real `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` as a secret, exact `ALLOWED_ORIGIN`, six-hourly Cron trigger; keep every feature flag `false`.
3. Run `npm run staff:import` dry-run → reviewed SQL outside the repo → apply via `wrangler d1 execute`. Verify `GET /v1/staff/me` with a real staff account.
4. Enable staging flags one at a time and execute `docs/cloudflare-d1-property-preview.md` §Staged verification: draft create/edit, image upload with sessions, metadata rejection, delete, publication, public search/detail/image delivery, stale-revision 409s, disabled-flag fallbacks.
5. Enable `MEDIA_SWEEP_ENABLED` and verify `GET /v1/admin/media/sweep` + log output; route `R2_MEDIA_SWEEP`, `R2_MEDIA_SWEEP_FAILED` and `R2_MEDIA_ORPHAN_CLEANUP_REQUIRED` to an external alert.
6. Complete the encrypted Firestore backup gate, Firebase Auth/profile reconciliation and LINE/customer inventory in `docs/firestore-encrypted-backup-runbook.md`; test a restricted restore.
7. Only then plan cutover. Rollback is switching the preview `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND` back to `firebase`; never delete Firebase Auth or Firestore during this migration.

## Remaining non-decoding release risks

- Dashboard, social automation and the valuation map still materialise the whole catalog (bounded at 100 pages / 10,000 rows with a visible failure). Move their aggregates to server APIs before meaningful growth.
- Public images are served through the Worker from the mixed draft/public private bucket; plan a separate public-only CDN bucket for traffic growth (free-tier request costs).
- Admin CSV export covers the rows currently loaded in the list.
- No production-like load test has been run; search filters and JSON-feature queries can scan on a cache miss.
- Cloudflare/Vercel/Maps/LINE commercial hosting limits are outside this repo's gates.
