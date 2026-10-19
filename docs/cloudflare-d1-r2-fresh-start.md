# Cloudflare D1 + R2 Fresh-Start Migration — Chantakorn Property

**Status:** Planning PR only — no production changes.  
**Reviewed baseline:** `main` commit `241411043294fae356925e97cb6c6f8d74cadac8`, 20 Oct 2026.

## Decisions

- Begin with **zero listings** in new D1; do not migrate the three existing property listings or their old images into the new public catalog.
- Retain **Firebase Authentication** and existing sign-in methods. Do not delete the Firebase project.
- Retain important operational data after review: user profiles and ADMIN/AGENT roles; active leads/inquiries and their photos; LINE followers and reply/notification state; current work jobs; non-secret settings; approved agent profiles. Archive older data separately, applying appropriate retention rules.
- Store fresh listing metadata in D1, public property photos in an R2 public-media bucket, and **customer photos in a separate private R2 bucket**.
- Implement a typed Worker API with Hono, Drizzle/SQL migrations, Wrangler, and server-side authorization. The existing Next.js 15 UI initially remains on its current host; hosting migration is optional and later.
- Each change lands in a separate reviewable PR with tests; no auto-merge, database deletion or production cutover as part of preparation.

## Verified dependencies in existing code

- `src/lib/backend.ts` supports `firebase` and `local` only. Unknown values fail closed.
- `src/app/api/properties/route.ts` reads up to 1,000 published documents and sends `Cache-Control: no-store`; move public catalog behind safe cache and pagination.
- `src/lib/store/properties-store.ts`, `agents-store.ts`, `property-media.ts`, `work-jobs-store.ts`, `land-valuation-store.ts` directly import Firestore APIs.
- `src/lib/server-auth.ts` validates Firebase ID tokens and then reads staff roles from Firestore `profiles`. Replace role reads with **server-controlled D1 roles**; never trust client-editable role fields.
- `src/app/api/line/webhook/route.ts` writes inquiries and `line_followers` into Firestore; `src/lib/inquiry-notification.ts` handles lease/retry state. Preserve signature, idempotency, reply and follow/unfollow behavior.
- `src/app/api/inquiries/media/route.ts` uses `sharp` and private Firestore documents. Preserve validation and privacy; don't presume Workers free CPU can perform image transformations.
- `src/lib/store/work-jobs-store.ts` falls back to localStorage; investigate browser-only work-job changes before cutover.
- `firebase.json` points to a **named Firestore database**. An export targeting `(default)` would be incorrect.
- Static export in `scripts/build-pages.mjs` defaults to local/demo and removes API routes. It is not the production hosting replacement.
- Previously shared short property URLs may exist. Old IDs must not be recycled for unrelated new listings; use a designed 404/410 or explanation.

## Data disposition

| Existing data | Handling |
| --- | --- |
| properties / property_media | Intentionally NOT imported; optional encrypted disaster-recovery archive |
| Firebase Auth users | Keep Auth live; inventory UID/provider/disabled state with privileged tools |
| profiles / agents | Backup; reconcile and import approved active UID-to-role bindings and public staff data |
| inquiries / inquiry_media | Encrypted backup; import active work only after review; keep private |
| line_followers | Backup; import active/authorized follower state, honor opt-outs |
| work_jobs | Backup; import active stages; reconcile local-only state |
| reviews / property_history / system_activities | Archive with retention decision; selectively import if required |
| settings | Import allowlisted non-secret preferences; keep API and LINE secrets in platform secrets |
| request_budgets / temporary sessions | Don't import old counters; create new safe limits |
| other collections/subcollections | Discover and inventory before final archive; rules may not list all |

## Mandatory backup gate (NOT yet complete)

1. Confirm actual Firebase project, the **named** Firestore DB, LINE channel, current webhook URL and hosting configs, without exposing secrets.
2. Run read-only collection/subcollection inventory. Capture per-collection record counts, relationships and recent writes, including customer media and operational records.
3. Export confidential data to **encrypted access-controlled storage outside GitHub and CI**. Commit only sanitized record counts, timestamps and archive checksums. Do not copy PII or tokens into an AI conversation, commit or PR.
4. Managed Firestore export may require a paid billing plan; never enable paid services automatically. If applicable, implement scoped read-only SDK export and account for consumed Firestore reads.
5. Confirm all Firebase Auth accounts and immutable UID-to-staff role reconciliation.
6. Test a representative restore in a separately secured environment; ensure LINE inquiry and notification state and R2 media references are recovered correctly.
7. Near cutover, freeze/reconcile writes and export a delta; verify counts and sample records before changing data authority.
8. Obtain specific review for **irreversible deletion** after retention and restore checks; do not automatically delete Firestore. Never delete the Firebase Auth project.

## Proposed target topology

```text
chantakornproperty.com (existing Next.js 15 UI)
    public read / admin action -> Cloudflare Worker API (Hono)
                                    |-- D1 (properties, authorized roles, active leads, LINE state)
                                    |-- R2 public (versioned listing images behind CDN)
                                    |-- R2 private (customer/inquiry media, signed/authorized read)
    Firebase Authentication -------> signed ID token verified on trusted API
    LINE OA -----------------------> signature-verified, idempotent webhook
```

Design rules: cache only published public data; pagination and indexes to keep D1 row scans bounded; use one authoritative write backend for each resource at cutover, never permanent dual-write; never expose drafts, private contact data or private R2 media; fail closed on missing permissions or configuration. Keep originals/previous deployment available for rollback.

## AI PR sequence

| PR | Work | Exit gate |
| --- | --- | --- |
| **01** | This plan, inventory and backup checklist | Documentation only; no production secrets or runtime changes |
| **02** | Scaffold `services/cloudflare-api`, Wrangler/Hono, Drizzle D1 schema/migrations, local test fixtures | Fresh local/staging migration + typecheck and integration tests |
| **03** | Firebase JWT verification and D1 staff-role authorization | Non-admin, unverified, forged and expired tokens rejected; bootstrap audited |
| **04** | R2 public/private media API, validation, lifecycle and CDN strategy | Anonymous requests cannot access customer images |
| **05** | Fresh properties CRUD, public pagination/search, admin integration | Empty real catalog, create/edit/publish/delete, old codes not reused |
| **06** | Active customer leads, agent profiles, staff inbox, work jobs | Encrypted backup gate passed, privacy & idempotency tests |
| **07** | LINE webhook/followers/notification state moved to D1 | HMAC, dedupe, follow/unfollow, reply and notification retry tests |
| **08** | CI, observability, edge caching, load & security tests, staging/cutover/rollback | E2E green; low-cost budgets and error monitoring established |
| **09 optional** | Cloudflare site hosting POC (OpenNext) | Next.js 15, Node/sharp, Auth, SEO, domain and commercial terms verified |

PRs are merged **serially after reviews**; parallel AI work is allowed only on independent branches and files, with no unreviewed merges. The rollback switch must be server-side and deployed in advance. Never silently substitute local/sample data for missing production data.

## Required verification commands

```sh
npm ci
npm run audit:security
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
```

For Worker PRs additionally execute local D1 migrations, Worker unit/API tests, JWT authorization matrix, and R2 private access tests. CI must never have write/delete access to the **production** database.

## Cutover criteria and rollback

1. Backup gate, restore test and data reconciliation signed off; active leads, LINE followers, work jobs and users accounted for.
2. Create separate staging and production D1/R2 resources with least-privileged bindings; provision secrets outside the repo.
3. New empty listings are intentional; confirm publishing the **first new property** works with R2 images, short links, search and LINE cards.
4. Verify Admin login, role edit restrictions, public inquiry intake and LINE replies using a controlled test.
5. Enable new write authority using server feature flags only after smoke tests. Monitor errors, rows read, Worker CPU, image operations, rate limits, Maps/LINE/AI charges.
6. If critical errors arise, stop writes, reconcile all post-cutover records and restore the previous build/configuration safely; don't double-write.
7. Preserve the old Firestore in a locked-down archival state for an agreed observation/retention period (for example 30 days if appropriate), then consider separate reviewed deletion. **Keep Firebase Auth.**

## Primary references

- https://github.com/cloudflare/templates/tree/main/d1-template
- https://github.com/cloudflare/workers-sdk
- https://github.com/honojs/hono
- https://github.com/drizzle-team/drizzle-orm
- https://github.com/opennextjs/opennextjs-cloudflare
- https://github.com/panva/jose
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://firebase.google.com/docs/firestore/manage-data/export-import
