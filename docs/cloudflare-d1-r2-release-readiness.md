# Cloudflare D1/R2 property catalog — code-side release readiness

**Status: all code-side gates closed** by stacked PRs #51–#67 (media lifecycle, Admin catalog pagination, image decode/metadata sanitization, verified staff import), and a **staging preview is deployed and usable** (see below). **No production database migration, production cutover, or destructive real-data change has been performed.** Production hosting is unchanged; remaining work is operator review/verification, backup gate and cutover approval.

## Current staging environment (deployed 2026-10-24)

- Worker `chantakorn-property-api-dev` → `https://chantakorn-property-api-dev.chantakorn-property.workers.dev`, bound to D1 `chantakorn-property-dev`, R2 `chantakorn-property-media-dev` / `chantakorn-inquiry-private-dev`, with the six-hourly Cron trigger.
- Migrations 0001–0007 applied to staging D1; `FIREBASE_WEB_API_KEY` stored as a Worker secret; staging flags (`PROPERTY_WRITES_ENABLED`, `PROPERTY_PUBLICATION_ENABLED`, `MEDIA_WRITES_ENABLED`, `MEDIA_SWEEP_ENABLED`, `MEDIA_UPLOAD_SESSIONS_REQUIRED`) enabled; `ALLOWED_ORIGIN=http://localhost:3000`.
- One verified ADMIN profile (the repo owner's Firebase account) was imported with the offline planner from the Firebase `auth:export`. The exporter omits `disabled` when it is false; the planner now treats a missing flag as enabled while still failing closed on missing `emailVerified` (#67).
- Local preview: `.env.local` sets `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=cloudflare` + `NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN`; `npm run dev` serves http://localhost:3000. Firebase remains the backend for Auth/users, inquiries, LINE and other business data.

## Evidence

- All PRs #51–#67 are open **draft** PRs with chained bases (each based on the previous branch) and green required CI (`Cloudflare D1 API (isolated checks)` and, where root files changed, `Cloudflare property Admin bridge (root checks)`).
- Final local verification on the head branch: app lint, app typecheck, root tests (344), Worker typecheck, Worker unit tests (59), local workerd runtime tests with real D1/R2 bindings (22), and `scripts/verify_schema.py` against migrations 0001–0007.
- Deployed-staging smoke checks: `/health` 200, public `/v1/properties` returns `{"data":[],"next_cursor":null}`, Admin routes return 401 without a token, allowed-origin CORS preflight 204 and a foreign origin 403.
- Tests use synthetic records only. No Firebase customer data, LINE credentials or production Cloudflare resources were accessed.

## Gate matrix

| Gate | Delivered by | State | Residual risk |
| --- | --- | --- | --- |
| Draft-media staff preview | #51 | ✅ | none known |
| Guarded R2 media deletion | #52 | ✅ | delete is D1-row-first, R2 best-effort; leftovers handled by sweep |
| Bounded R2 orphan sweep + status | #53 | ✅ | external log-alert routing still required |
| Image container validation + metadata rejection | #54 | ✅ | all formats metadata-free |
| PNG full pixel decode | #62 | ✅ | interlaced PNG rejected |
| Baseline JPEG full entropy decode | #64 | ✅ | progressive/multi-scan/restart JPEGs rejected |
| WebP uploads refused; client produces JPEG | #65 | ✅ | no new WebP delivery (revisit if needed) |
| Verified staff-role import planner | #55 | ✅ | actual roster import is operator-only |
| Filtered keyset Admin listing API | #56 | ✅ | search is substring/scan on cache miss |
| Admin list/editor native pagination | #57 | ✅ | CSV export covers loaded rows only |
| Upload sessions (server) | #58 | ✅ | enabling the required flag is operator step |
| Upload sessions (browser client) | #59 | ✅ | real-browser staging verification pending |
| Whole-catalog screens off the 800-row bridge | #60 | ✅ | dashboard/automation still materialise the catalog |
| Per-staff upload/session rate limits | #61 | ✅ | complements, not replaces, edge/WAF controls |

## Image decoding gate (closed)

The only accepted upload formats are now **PNG and baseline JPEG**, both of which are fully decoded before any R2 write (#62, #64). The browser canvas compressor produces JPEG instead of WebP and the Worker refuses WebP uploads (#65) because a VP8/VP8L pixel decoder is not available without a WASM dependency. Progressive, arithmetic-coded, multi-scan and restart-interval JPEGs are rejected with explicit 415s; the app compressor always emits baseline JPEG, so this only affects direct API callers. If WebP delivery becomes a product requirement, revisit the WASM-decoder or CDN-transcode options before enabling production writes.

## Operator gates before production (in order)

1. Create isolated staging D1 (fresh, unseeded), private property-media R2 bucket and private inquiry R2 bucket; apply migrations 0001–0007 to staging only. ✅ staging done.
2. Configure the Worker: real `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` as a secret, exact `ALLOWED_ORIGIN`, six-hourly Cron trigger. ✅ staging done (flags enabled for preview).
3. Run `npm run staff:import` dry-run → reviewed SQL outside the repo → apply via `wrangler d1 execute`. ✅ staging done for the owner ADMIN account; verify `GET /v1/staff/me` in the browser.
4. Execute `docs/cloudflare-d1-property-preview.md` §Staged verification in the browser: draft create/edit, image upload with sessions, metadata rejection, delete, publication, public search/detail/image delivery, stale-revision 409s, disabled-flag fallbacks. ⏳ owner review pending.
5. `MEDIA_SWEEP_ENABLED` and status endpoint are live; route `R2_MEDIA_SWEEP`, `R2_MEDIA_SWEEP_FAILED` and `R2_MEDIA_ORPHAN_CLEANUP_REQUIRED` to an external alert. ⏳ alert routing pending.
6. Complete the encrypted Firestore backup gate, Firebase Auth/profile reconciliation and LINE/customer inventory in `docs/firestore-encrypted-backup-runbook.md`; test a restricted restore. ⏳ pending.
7. Only then plan production cutover. Rollback is switching the preview `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND` back to `firebase`; never delete Firebase Auth or Firestore during this migration.

## Remaining non-decoding release risks

- Dashboard, social automation and the valuation map still materialise the whole catalog (bounded at 100 pages / 10,000 rows with a visible failure). Move their aggregates to server APIs before meaningful growth.
- Public images are served through the Worker from the mixed draft/public private bucket; plan a separate public-only CDN bucket for traffic growth (free-tier request costs).
- Admin CSV export covers the rows currently loaded in the list.
- No production-like load test has been run; search filters and JSON-feature queries can scan on a cache miss.
- Cloudflare/Vercel/Maps/LINE commercial hosting limits are outside this repo's gates.
