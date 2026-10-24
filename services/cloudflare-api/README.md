# Chantakorn Property — Cloudflare API (scaffold)

**Stacked migration / staging only.** This folder does **not** replace current Next.js/Firebase endpoints, change the domain, import old properties, or access production customer data. Property writes, publication and media uploads remain disabled by default.

## Stack

- Cloudflare Workers + [Hono](https://github.com/honojs/hono)
- [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) + Cloudflare D1 (SQLite)
- Separate private R2 bindings for mixed draft/published property images and customer inquiry media, delivered through authorized Worker routes.
- Firebase Authentication remains in the existing app. Staff routes verify signed Firebase tokens, D1 role authority and live Firebase account/revocation state.

## First-time setup (developer staging only)

1. `cd services/cloudflare-api && npm ci`
2. `cp wrangler.example.jsonc wrangler.jsonc` (the real file is gitignored).
3. In the **intended staging Cloudflare account**, create a new empty database and separate image buckets:

   ```sh
   npx wrangler d1 create chantakorn-property-dev
   npx wrangler r2 bucket create chantakorn-property-media-dev
   npx wrangler r2 bucket create chantakorn-inquiry-private-dev
   ```

4. Paste the newly generated **staging** D1 UUID into the local `wrangler.jsonc`. Verify the names and account are correct. Never paste API tokens, R2 credentials or customer data into version control. **Do not use the production example for local commands.**
5. Apply local migrations and start the Worker:

   ```sh
   npm run db:local
   npm run dev
   ```

6. Test safe anonymous routes:

   ```sh
   curl http://127.0.0.1:8787/health
   curl 'http://127.0.0.1:8787/v1/properties?limit=12'
   ```

   A brand-new D1 has **zero properties**, so the public list should return `{"data":[],"next_cursor":null}`. This is intentional; never silently use the demo/local listings.

### Remote staging

Only after you have selected/verified the Cloudflare account and **staging** database UUID, run:

```sh
npx wrangler d1 migrations apply chantakorn-property-dev --remote
npx wrangler deploy
```

These commands touch Cloudflare resources, so they are **not executed by CI**. Keep production separate; a template for production is `wrangler.production.example.jsonc` and must not be used until later approvals and backup checks. The production DB should also start with zero property listings.

## API implemented

- `GET /health` — confirms Worker code loaded; intentionally does **not** certify DB/R2 reachability.
- `GET /v1/properties` — published-only allowlisted fields, keyset cursor, maximum 30 results, filters for type/status/province/district/price. Invalid/duplicated query parameters give 400.
- `GET /v1/properties/:identifier` — published property by new property code or slug; no draft, private notes, client contacts or sample fallback. Unknown legacy IDs return 404.

`/v1/admin/properties` implements protected list/detail/create/PATCH/soft-delete; creation is always draft-first. R2 upload/read routes are described below. Public read routes require no credentials. Only the browser origin configured via `ALLOWED_ORIGIN` receives an Access-Control-Allow-Origin header. Before testing staff routes, configure the actual trusted `FIREBASE_PROJECT_ID` and its `FIREBASE_WEB_API_KEY` in the local/staging environment. Missing account-state configuration fails closed; never substitute a service-account private key. Keep all three write/publication flags false before staging acceptance.

## Testing

```sh
npm run typecheck
npm test
npm run test:integration
python3 scripts/verify_schema.py
```

Schema migrations are **human-reviewed SQL** under `migrations/`. `src/db/schema.ts` declares corresponding Drizzle tables. When changing schema, modify both and run migration verification. This PR intentionally has no production deploy automation and no configured access to the Firebase project.

The isolated Worker has a committed `package-lock.json`, with dependency checks performed using `npm ci` and an additional moderate-severity npm audit. Whenever dependencies change, update the lockfile and review the resulting diff before merging. Unused Drizzle Kit generation tooling is removed; the runtime ORM remains. Human-reviewed SQL migrations and the isolated schema verification are the migration workflow.

## Next PR sequence

PR-03 (stacked on PR-02) adds verified Firebase ID tokens and D1 ADMIN/AGENT role **reads**; approved staff records must be imported by privileged code only after backup reconciliation. PR-04 implements public/private R2 upload/download with size validation and authorization. PR-05 implements new property CRUD and connects the existing UI. PR-06/07 migrate **selected active** customer/LINE data only after encrypted backup + restore verification. No existing Firestore collection should be deleted until all active dependencies are identified and retired; **never delete Firebase Auth**.

Related decision and backup plan: [PR #35](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/35). Its document is a separate draft and does not modify this branch.

## Authentication bridge added in stacked PR-03

- `GET /v1/staff/me` requires `Authorization: Bearer <Firebase ID token>` and responds only for a **verified** Firebase Auth email and an existing, server-controlled D1 ADMIN/AGENT profile with matching UID.
- Google Secure Token **RS256** signature is verified against Google's rotating JWKS; project-specific issuer/audience, expiration, `iat`, `auth_time`, and `sub` are checked.
- D1 `profiles.role` remains USER by default. Missing, disabled, unauthorized, revoked or out-of-sync staff profiles are denied (401 or 403), **never** automatically upgraded.
- D1 `auth_disabled` and `tokens_valid_after` provide an additional deny gate. Every staff self-check, Admin read/write, private inquiry-media read and upload also verifies live Firebase account state, matching UID, verified email, disabled status and `auth_time >= validSince`. Missing/malformed state and lookup failures deny access. Firebase account state never grants a D1 staff role.
- No staff bootstrap endpoint exists. No public user can set their role. A secure manual migration after encrypted backup and UID reconciliation is required before the endpoint will grant any staff permission.
- Test `npm test` covers valid RS256 signed local fixture tokens, forged/expired/future/wrong-issuer/wrong-audience/unverified tokens and role state denial. No real Firebase account or customer record is used.

## Guarded R2 media routes (stacked PR-04)

The Worker now exposes `GET /v1/media/properties/:mediaId` only for a media row associated with a **published** property. A draft/unpublished listing returns 404 even when somebody knows the R2 object ID. Media files are routed through the Worker while the bucket remains private. Responses use `no-store` so a browser or intermediary cannot bypass the publication check after unpublishing.

`GET /v1/media/inquiries/:mediaId` always requires a verified Firebase ID token and an existing D1 ADMIN/AGENT role. Responses have `private, no-store`; neither the R2 private bucket nor inquiry metadata is exposed anonymously. Do NOT attach a public custom domain or public bucket URL to either of the current R2 buckets: even the listing bucket contains **draft** images.

Staff-only raw-image uploads are staged behind `MEDIA_WRITES_ENABLED=true`, which is **omitted from checked-in Wrangler examples and false by default**. Routes:
- `POST /v1/media/properties/:ownerId` — ADMIN only; associated listing must exist and not be soft-deleted, max 60 images.
- `POST /v1/media/inquiries/:ownerId` — existing inquiry, max 15 private images.
- An exact matching `Origin`, valid Bearer token, approved D1 role, explicit binary `Content-Type` and `Content-Length` and matching JPEG/PNG/WebP bytes are required. Max 2 MiB per image. Relative `media_path` returned after upload must be resolved with the **trusted API origin**; don't concatenate untrusted hosts.

**Production write gate:** keep `MEDIA_WRITES_ENABLED` disabled until real staging account-disable/revocation tests, staff role bootstrap/reconciliation, image full-decode validation, abuse controls and upload-rate protection pass. Current validation checks headers and magic bytes; full image decoding and EXIF removal remain required. Client preprocessing is not a security boundary. Uploaded R2 keys are generated server-side. Image-count quotas and the parent-state recheck are enforced in a single conditional metadata insert. Losing concurrent uploads and D1 insert errors trigger best-effort object cleanup; an orphan sweep is still needed for crashes or cleanup failures.

Property create/update/soft-delete and their audit event now commit in one D1 batch transaction. If the audit cannot be recorded, the mutation rolls back and returns 503. A stale optimistic-lock attempt creates no audit event. Local runtime tests inject an audit failure and race uploads at both image quotas to verify rollback and cleanup.

The integration suite bundles the real Worker and runs local workerd D1/R2 bindings. Locally signed RSA tokens and intercepted Google JWKS/account lookups exercise public pagination, private-file authorization, draft-first CRUD, concurrent revision conflicts and R2 bytes. It uses only synthetic records and never calls production Firebase or Cloudflare. The local runtime exercises Cache API hits, query isolation, current-origin CORS and invalidation after unpublishing. This is not a multi-region traffic benchmark.

**Free-tier design:** Routing every public image GET through the Worker consumes Worker requests. Before growing traffic, consider a **separate public-only, versioned R2 delivery bucket** populated after publication, with a custom domain and CDN, while keeping draft property and customer photos in private buckets. Public promotion must copy only explicitly published assets. Do not expose this mixed draft/public `PROPERTY_MEDIA` bucket directly.

## Public catalog cache (opt-in staging)

After applying migration `0004_catalog_generation.sql` in isolated staging, set `PUBLIC_CATALOG_CACHE_ENABLED=true` to test public list/detail caching. Examples keep it false. SQL triggers atomically rotate a random generation on property or property-media insert/update/delete, including direct maintenance SQL. Every cacheable request reads the generation from primary D1; never cache this token or read it from a lagging replica. A failure to read a valid generation fails closed with 503, never serves stale data.

Only validated anonymous GET list/detail payloads enter the Cache API, keyed by URL, sorted parameters, schema namespace and generation. Authentication/cookie requests bypass the cache; errors, private/Admin routes and draft media are never stored. Cached payloads contain no request headers; CORS is recomputed for each caller. All outward catalog responses use `no-store` so intermediary/browser caches cannot bypass generation validation. Internal entries expire after 60 seconds. Mutations make earlier keys unreachable immediately for requests starting after commit; already in-flight responses can complete from their observed state.

A hit costs one indexed singleton D1 read plus a Worker invocation, instead of repeating the property and media queries. It is not zero-cost or unlimited free traffic. Cache storage is data-center-local and can evict entries; errors fall back to the current origin result. Large-scale staging load tests and public-only image delivery remain necessary. See [D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Public search pagination

The Cloudflare `/properties` screen makes one request for 24 records at a time, with previous/next navigation. Search changes reset the cursor, debounce requests and abort obsolete requests. The map and counts explicitly describe the current page. Firebase mode keeps its existing behavior.

The API applies every public screen filter before its result limit: type/status, location substrings, price range, rooms, features, text/code search, featured and video. Newest, price ascending/descending and featured-first sorts use stable keyset cursors with created-at/id tie breakers; a cursor for another sort is rejected. Sort indexes are in migration 0005. Substring and JSON-feature searches can still scan rows on a cache miss and need staging query-cost/load measurements; pagination alone does not guarantee cheap arbitrary searches.

Other consumers using `cloudflareListProperties` (including the legacy Admin list) still use the bounded compatibility bridge. Their native pagination and real-browser staging remain open work before cutover.
