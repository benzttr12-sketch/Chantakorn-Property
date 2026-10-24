# Cloudflare D1 new-property catalog — staging runbook (PR #40)

**Scope:** New listings ONLY. The existing three Firestore listings are intentionally **not copied** to D1. Other business data (Firebase Auth accounts, active customers, LINE OA followers, work jobs, service settings) stays on Firebase until the encrypted backup + reconciliation gate in PR #39 is completed. **No production database was changed by this PR.**

**Release readiness:** [cloudflare-d1-r2-release-readiness.md](cloudflare-d1-r2-release-readiness.md) tracks the code-side gate matrix (#51–#62), the open JPEG/WebP pixel-decoding decision, and the ordered operator gates.

## Architecture and rollout defaults

- The current Next.js site remains on its existing host with `NEXT_PUBLIC_DATA_BACKEND=firebase`. Only the listing store can be switched independently.
- New Worker `GET /v1/admin/properties`, `GET /v1/admin/properties/:id`, `POST /v1/admin/properties`, `PATCH /v1/admin/properties/:id`, and `DELETE /v1/admin/properties/:id` are protected by Firebase RS256 JWT verification, **live** Firebase account lookup, and D1 role authorization.
- Only pre-approved `ADMIN` profiles are permitted to create, update or soft-delete properties. `AGENT` roles can read the draft catalog. No self-service staff-role assignment or public writes.
- `POST` **always creates an unpublished draft** even if a client requests publication. Publication is a separate protected PATCH action and blocked unless its own feature flag is explicitly enabled.
- `DELETE` is a **soft delete** (sets `deleted_at`, clears publication). Public property list/detail and public R2 media refuse unpublished/deleted records.
- `updated_at` is used for optimistic concurrency: concurrent edits should receive HTTP 409, never silent overwrite.
- Public listing serializer explicitly excludes internal notes and accepts only fields from the original UI's safe public-property allowlist; the Admin serializer also includes internal notes. Media are indexed and queried in a batch rather than once per listing.
- Auth lookups and private Admin endpoints are not cached. Public list/detail use a short bounded cache and D1 keyset pagination.

## Cloudflare staging prerequisites

1. Complete PR #36/37/38/39 code review. Create isolated staging D1, property media R2 and private customer media R2; apply migrations 0001, 0002 and 0003 to **staging only**. Never use the existing Firebase project as a disposable test target.
2. Confirm the **real Firebase project ID** and set `FIREBASE_PROJECT_ID` as a Worker variable. Provide `FIREBASE_WEB_API_KEY` through a Worker secret (the Firebase public Web API key is not a staff role or database secret; keeping runtime configuration central avoids accidental mismatches).
3. Reconcile Firebase Auth UID, email_verified, disabled/revoked state and the Firestore `profiles` role before creating any corresponding D1 staff records. `profiles` defaults to USER. Only an authorized operator should bootstrap specific approved ADMIN UIDs into the staging D1. The repo deliberately **does not** contain a global-admin auto-bootstrap or seed SQL; use the offline `services/cloudflare-api` `npm run staff:import` planner to validate the Auth export, `profiles` export and approved-UID list and produce reviewed insert-only SQL. It never connects to Firebase or D1 itself.
4. Set `ALLOWED_ORIGIN` to the **exact preview website origin** (scheme + hostname + port), not a wildcard. The Worker checks it for writes; CORS alone is not authentication.
5. Keep these Worker variables **disabled initially**:
   ```json
   {
     "PROPERTY_WRITES_ENABLED": "false",
     "PROPERTY_PUBLICATION_ENABLED": "false",
     "MEDIA_WRITES_ENABLED": "false"
   }
   ```
6. On a **preview website only**, configure:
   ```env
   NEXT_PUBLIC_DATA_BACKEND=firebase
   NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=cloudflare
   NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN=https://YOUR_STAGING_WORKER.workers.dev
   ```
   Never enable that environment option for Production until staged end-to-end tests and the customer/LINE backup gate pass. The existing Firebase users, inquiries, LINE and map stores still use their existing backend.

## Staged verification

- Without any imported properties, public `GET /v1/properties?limit=12` returns `{"data":[],"next_cursor":null}`. No demo samples or Firestore listings appear.
- Missing/forged/expired/unverified tokens, disabled Firebase accounts, bad D1 role, wrong browser origins, and missing Worker flags must reject Admin writes.
- After explicit operator setup **in staging**, enable `PROPERTY_WRITES_ENABLED=true` to create a new **draft**. Confirm all original editor fields (price, type, address, map coordinates, features, feng shui, year built, videos and private notes) survive a round trip.
- In staging with extra media-validation controls reviewed, enable `MEDIA_WRITES_ENABLED=true` and test uploading sanitized, compressed JPEG/PNG/WebP files into the private-origin R2 bucket. Never make draft media publicly accessible by direct bucket URL. Only publish media when the linked property is published. Create a short-lived upload session (`POST /v1/media/properties/:id/sessions?uploads=N`), upload with `X-Upload-Session`, and verify per-file consumption, expiry, cross-property reuse rejection and rejection of session-less uploads once `MEDIA_UPLOAD_SESSIONS_REQUIRED=true`; also verify uploads still work when a proxy omits `Content-Length` (chunked).
- On staging only, after the public API and web preview are verified, enable `PROPERTY_PUBLICATION_ENABLED=true`; publish the first *new* property, confirm public search, detail, original short property-code links and image delivery work.
- Test admin listing filters/tabs (`sale`, `rent`, `featured`, `draft`, `published`), district/type/search filters, all five sort orders, cursor pagination and the returned `total` count; malformed or cross-sort cursors must return 400.
- Test stale update 409, duplicate slug 409, soft delete, public 404 on drafts/deleted properties, no internal notes/PII in public responses, and disabled-flag fallback behavior.
- Confirm changing to Cloudflare listing mode does **not** change LINE, inquiry, Auth account ownership or existing Firestore permissions.

## Known staging blockers before production

- The UI's legacy unpaginated lists still use a temporary capped compatibility adapter (up to **800 Admin or 300 public** records) and throw visibly beyond that. The authenticated Admin listing API has native server-side filters, five sorts, keyset pagination and tab counts; the Admin list screen and property editor use it directly, and the dashboard/automation/valuation-map screens walk those pages through a shared bounded helper (100 rows/page, visible failure at 100 pages / 10,000 rows) instead of the old bridge. Those whole-catalog screens should move to aggregate APIs, and real-browser staging is required, before meaningful growth.
- The R2 upload path now walks the real image container: EXIF/XMP/IPTC/ICC/comments are rejected; PNG chunk CRCs, zlib stream and **every scanline are fully decoded** (row filters, bit depths, palette indices); baseline JPEG is validated at DQT/DHT/SOF0/SOS level and its **Huffman MCU data is fully decoded** (progressive/arithmetic/multi-scan/restart-interval JPEGs are rejected); WebP uploads are refused and the browser compressor now produces JPEG. Oversized/interlaced images are refused and nothing with metadata is stored (direct uploads are rejected, not rewritten). Per-staff hourly upload/session limits are enforced and recorded atomically with accepted uploads. Edge/WAF abuse controls, load testing and an eventual public-only CDN/media bucket remain open before production.
- The mixed public/draft property-image R2 bucket must remain private. Draft thumbnails in Admin are displayed through the authenticated `GET /v1/admin/properties/:id/media/:mediaId` proxy, which rechecks the live Firebase account and D1 role on every request and hands the browser a short-lived Blob URL. Keep the bucket private and never bypass the proxy with a direct URL.
- Draft photo removal now uses the guarded `DELETE /v1/media/properties/:propertyId/:mediaId` route: ADMIN + live Firebase state, an unpublished/undeleted parent, and a non-cover photo are required. The D1 row is deleted before the R2 object; a failed object delete is logged as `R2_MEDIA_ORPHAN_CLEANUP_REQUIRED`. A six-hourly opt-in `MEDIA_SWEEP_ENABLED` sweep (bounded lists/deletes, one-hour age floor, persisted cursor, ADMIN status at `GET /v1/admin/media/sweep`) removes leftovers; external alert routing for `R2_MEDIA_SWEEP`/`R2_MEDIA_SWEEP_FAILED` and a real staging sweep are still required before production.
- The Worker accepts chunked uploads without `Content-Length` (declared lengths must still match) and offers a short-lived, property-scoped upload-session API. The browser adapter now requests one session per ≤20-photo batch and sends `X-Upload-Session` on every file. Enabling `MEDIA_UPLOAD_SESSIONS_REQUIRED=true` and real-browser/staging verification (including a proxy that strips `Content-Length`) remain before production.
- D1 staff role profiles now have verified offline import tooling (`npm run staff:import` in `services/cloudflare-api`): it validates the Auth export, Firestore `profiles` export and an explicit approved-UID list, rejects unverified/disabled/mismatched identities, and produces insert-only SQL that never rewrites an existing D1 profile. An actual reviewed staging import, per-UID live-account verification and restore testing remain operator steps. Customer, LINE and work-job migration are **not** part of this PR.
- Property-code collisions with existing, no-longer-imported short links should be checked against an archived list of legacy codes before opening new production publishing.
- The Cloudflare page-preview host and external Maps/LINE/Vercel commercial hosting requirements are separate; no assumption of perpetual free-tier capacity.
- This PR remains a **Draft** until secure staging tests, root app tests, Worker tests and required backup checks pass.

## Safe rollback

Turn the **preview-only** `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND` option back to `firebase` or redeploy its previous build. Do not use fallback silently on API errors. Leave D1 and R2 intact for reconciliation; don't delete staged or production records while a request may have accepted writes. Stop writes first, inventory new records, then choose the authoritative backend. **Never delete Firebase Auth or the old Firestore during this PR.**
