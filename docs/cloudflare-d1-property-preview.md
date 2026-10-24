# Cloudflare D1 new-property catalog — staging runbook (PR #40)

**Scope:** New listings ONLY. The existing three Firestore listings are intentionally **not copied** to D1. Other business data (Firebase Auth accounts, active customers, LINE OA followers, work jobs, service settings) stays on Firebase until the encrypted backup + reconciliation gate in PR #39 is completed. **No production database was changed by this PR.**

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
3. Reconcile Firebase Auth UID, email_verified, disabled/revoked state and the Firestore `profiles` role before creating any corresponding D1 staff records. `profiles` defaults to USER. Only an authorized operator should bootstrap specific approved ADMIN UIDs into the staging D1. The repo deliberately **does not** contain a global-admin auto-bootstrap or seed SQL.
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
- In staging with extra media-validation controls reviewed, enable `MEDIA_WRITES_ENABLED=true` and test uploading sanitized, compressed JPEG/PNG/WebP files into the private-origin R2 bucket. Never make draft media publicly accessible by direct bucket URL. Only publish media when the linked property is published.
- On staging only, after the public API and web preview are verified, enable `PROPERTY_PUBLICATION_ENABLED=true`; publish the first *new* property, confirm public search, detail, original short property-code links and image delivery work.
- Test stale update 409, duplicate slug 409, soft delete, public 404 on drafts/deleted properties, no internal notes/PII in public responses, and disabled-flag fallback behavior.
- Confirm changing to Cloudflare listing mode does **not** change LINE, inquiry, Auth account ownership or existing Firestore permissions.

## Known staging blockers before production

- The UI's existing unpaginated lists use a temporary capped compatibility adapter (up to **800 Admin or 300 public** records). Beyond that, the adapter throws visibly. Implement proper infinite pagination/filter API before meaningful growth.
- The R2 data validation in PR #38 checks headers, magic bytes and size, but **does not fully decode and sanitize images or strip EXIF**. It also needs upload rate limits and an eventual public-only CDN/media bucket for low-cost high-volume delivery.
- The mixed public/draft property-image R2 bucket must remain private. Draft thumbnails in Admin are displayed through the authenticated `GET /v1/admin/properties/:id/media/:mediaId` proxy, which rechecks the live Firebase account and D1 role on every request and hands the browser a short-lived Blob URL. Keep the bucket private and never bypass the proxy with a direct URL.
- The frontend does not delete old R2 images when a user removes them from a draft; removal is rejected until a guarded media-delete endpoint and orphan cleanup exist.
- Client-side R2 media uploading may need verifying `Content-Length` behavior across supported browsers and/or switching to an upload-session API.
- D1 staff role profiles must be securely imported from a verified Auth/Firestore roster; customer, LINE and work-job migration are **not** part of this PR.
- Property-code collisions with existing, no-longer-imported short links should be checked against an archived list of legacy codes before opening new production publishing.
- The Cloudflare page-preview host and external Maps/LINE/Vercel commercial hosting requirements are separate; no assumption of perpetual free-tier capacity.
- This PR remains a **Draft** until secure staging tests, root app tests, Worker tests and required backup checks pass.

## Safe rollback

Turn the **preview-only** `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND` option back to `firebase` or redeploy its previous build. Do not use fallback silently on API errors. Leave D1 and R2 intact for reconciliation; don't delete staged or production records while a request may have accepted writes. Stop writes first, inventory new records, then choose the authoritative backend. **Never delete Firebase Auth or the old Firestore during this PR.**
