# Chantakorn Property — Cloudflare API (scaffold)

**PR-02 + stacked PR-03 / staging only.** This folder does **not** replace any current Next.js/Firebase endpoints, change the domain, import old properties, or access production customer data. The initial API is **read only**.

## Stack

- Cloudflare Workers + [Hono](https://github.com/honojs/hono)
- [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) + Cloudflare D1 (SQLite)
- R2 bindings for **separate** public property images and **private** inquiry media (no R2 HTTP routes yet)
- Firebase Authentication remains in the existing app. PR-03 adds Firebase JWT verification and a private read-only staff self-check using D1 role authority; write operations are still disabled.

## First-time setup (developer staging only)

1. `cd services/cloudflare-api && npm install`
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

No POST, PUT, PATCH or DELETE endpoints exist. No secrets are required for the public read-only API. Only one browser origin configured via `ALLOWED_ORIGIN` gets an Access-Control-Allow-Origin header. Set `FIREBASE_PROJECT_ID` to the actual trusted Firebase Authentication project ID before testing staff access; the checked-in placeholder fails closed.

## Testing

```sh
npm run typecheck
npm test
python3 scripts/verify_schema.py
```

Schema migrations are **human-reviewed SQL** under `migrations/`. `src/db/schema.ts` declares corresponding Drizzle tables. When changing schema, modify both and run migration verification. This PR intentionally has no production deploy automation and no configured access to the Firebase project.

The initial isolated package has no committed lockfile because it could not be generated in the current development environment. Before merging this scaffold, generate and commit its `package-lock.json` using `npm install`, review resolved dependencies, and switch CI from `npm install` to `npm ci`. Until then dependency installation is **not deterministic**, even though direct versions are pinned.

## Next PR sequence

PR-03 (stacked on PR-02) adds verified Firebase ID tokens and D1 ADMIN/AGENT role **reads**; approved staff records must be imported by privileged code only after backup reconciliation. PR-04 implements public/private R2 upload/download with size validation and authorization. PR-05 implements new property CRUD and connects the existing UI. PR-06/07 migrate **selected active** customer/LINE data only after encrypted backup + restore verification. No existing Firestore collection should be deleted until all active dependencies are identified and retired; **never delete Firebase Auth**.

Related decision and backup plan: [PR #35](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/35). Its document is a separate draft and does not modify this branch.

## Authentication bridge added in stacked PR-03

- `GET /v1/staff/me` requires `Authorization: Bearer <Firebase ID token>` and responds only for a **verified** Firebase Auth email and an existing, server-controlled D1 ADMIN/AGENT profile with matching UID.
- Google Secure Token **RS256** signature is verified against Google's rotating JWKS; project-specific issuer/audience, expiration, `iat`, `auth_time`, and `sub` are checked.
- D1 `profiles.role` remains USER by default. Missing, disabled, unauthorized, revoked or out-of-sync staff profiles are denied (401 or 403), **never** automatically upgraded.
- `auth_disabled` and `tokens_valid_after` in D1 must be synchronized from real Firebase Auth account state by a future approved, privileged job; this draft only verifies what is present in D1. Firebase Auth account disable/revocation changes do not automatically flow to D1 yet. Do not expose high-impact write endpoints until synchronization/revocation checks are implemented and audited.
- No staff bootstrap endpoint exists. No public user can set their role. A secure manual migration after encrypted backup and UID reconciliation is required before the endpoint will grant any staff permission.
- Test `npm test` covers valid RS256 signed local fixture tokens, forged/expired/future/wrong-issuer/wrong-audience/unverified tokens and role state denial. No real Firebase account or customer record is used.
