# Chantakorn Property — Cloudflare API (scaffold)

**PR-02 / staging only.** This folder does **not** replace any current Next.js/Firebase endpoints, change the domain, import old properties, or access production customer data. The initial API is **read only**.

## Stack

- Cloudflare Workers + [Hono](https://github.com/honojs/hono)
- [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) + Cloudflare D1 (SQLite)
- R2 bindings for **separate** public property images and **private** inquiry media (no R2 HTTP routes yet)
- Firebase Authentication remains in the existing app; JWT/role verification will be added before any write/private endpoints in a later PR.

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

No POST, PUT, PATCH or DELETE endpoints exist. No secrets are required for the public read-only API. Only one browser origin configured via `ALLOWED_ORIGIN` gets an Access-Control-Allow-Origin header. Configure the deployed frontend's actual origin when ready.

## Testing

```sh
npm run typecheck
npm test
python3 scripts/verify_schema.py
```

Schema migrations are **human-reviewed SQL** under `migrations/`. `src/db/schema.ts` declares corresponding Drizzle tables. When changing schema, modify both and run migration verification. This PR intentionally has no production deploy automation and no configured access to the Firebase project.

The initial isolated package has no committed lockfile because it could not be generated in the current development environment. Before merging this scaffold, generate and commit its `package-lock.json` using `npm install`, review resolved dependencies, and switch CI from `npm install` to `npm ci`. Until then dependency installation is **not deterministic**, even though direct versions are pinned.

## Next PR sequence

PR-03 adds verified Firebase ID tokens and server-maintained D1 ADMIN/AGENT roles. PR-04 implements public/private R2 upload/download with size validation and authorization. PR-05 implements new property CRUD and connects the existing UI. PR-06/07 migrate **selected active** customer/LINE data only after encrypted backup + restore verification. No existing Firestore collection should be deleted until all active dependencies are identified and retired; **never delete Firebase Auth**.

Related decision and backup plan: [PR #35](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/35). Its document is a separate draft and does not modify this branch.
