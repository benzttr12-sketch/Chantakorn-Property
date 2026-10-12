# Security and photo operations

Public visitors read `/api/properties`. The API projects only published listing fields; `properties` documents, drafts and internal notes are staff-only. Public LINE webhook requests retain signature verification. The verified webhook writes follower records using its server identity; browser clients cannot create or update followers.

## Server identity

The Vercel project uses keyless Google Workload Identity Federation:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: full provider resource name.
- `GCP_SERVICE_ACCOUNT_EMAIL`: dedicated server service account.
- The provider trusts only the Chantakorn Vercel project and its production/preview subjects. IAM restricts the service account's `roles/datastore.user` permission to the existing named Firestore database.
- The OAuth credentials are short lived. There is no production private key. Do not put server identity configuration or credentials in `NEXT_PUBLIC_*` variables.
- Renaming the Vercel team/project requires updating the provider issuer/subject conditions and service-account impersonation principals. Review preview deployment access before accepting code from untrusted contributors.

`FIREBASE_SERVER_CREDENTIALS` is an optional server-only service-account JSON alternative for other hosting providers. Its project must match the Firebase public configuration. It is not used on this Vercel deployment. Missing/invalid server identity fails closed.

## Photos and submissions

The browser decodes raster photos, checks 100 MiB input and 60 MP decoded limits, reduces dimensions/quality to a strict 450,000-byte output and applies the building logo and official contact watermark. SVG, corrupt files, unsupported decoding, CORS failures and unsafe remote URLs produce an error. Watermark can be disabled or moved to any of the five existing positions.

New property photos are stored individually in private `property_media` documents. The listing keeps HTTPS references, so its gallery does not accumulate Base64 data against Firestore's 1 MiB document ceiling. Exact legacy photos from an existing listing may be migrated up to 760,000 bytes to preserve unrelated edits. A public image response requires a published parent and current gallery/cover membership. Draft images are read through the staff SDK. New uploads are removed when their parent save fails; removed gallery references are cleaned after a successful update.

Firebase public forms use `/api/inquiries`, with bounded types/text and server-owned status/title. Up to 15 photos are uploaded separately using an expiring, unguessable session capability. Staging and customer photos remain private. Expired abandoned sessions are cleaned in bounded batches on new sessions. Consumed session cleanup preserves saved customer photos. Staff can expand the inbox photo panel to read them.

The submission ID binds a retry to the saved payload. LINE notifications read the saved record, claim a 90-second delivery lease, use fixed configured staff recipients and stable LINE retry keys. Provider rejection does not discard the customer's saved inquiry. The old standalone notify API now always requires staff authentication; public form callers cannot override recipients, tokens or notification settings. Optional Supabase mode retains inbox insertion but does not call the formerly anonymous Firebase LINE notification path.

Shared Firestore transactions limit both a caller and the whole application, including across server instances. Rotating caller identifiers cannot bypass the global daily ceiling. Paid AI calls apply the shared budget only when a provider is configured. These application limits do not promise immunity to platform-level traffic costs. Budget documents include expiry metadata; Firestore TTL is not enabled automatically, and no paid storage/billing upgrade is provisioned.

## Verification and release order

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npm run build:pages
```

Rules tests use a demo project and an isolated emulator; Java 21 is required. They never change the live database. GitHub CI runs the rules tests.

Configure and verify the server federation and deploy the new API before deploying `firestore.rules` to the explicit production project and named database from `firebase.json`. Do not use the Firebase CLI's unrelated global default project. Then verify the public catalog, image responses and staff access, and confirm that anonymous direct document reads/follower writes/inquiry writes are denied. If the server identity fails, repair federation rather than reopening the private collections.

Dependency advisories requiring major framework/toolchain upgrades remain a separate release concern. An application-boundary fix or Ready deployment does not establish that every dependency is free of vulnerabilities, nor does a LINE API acceptance establish handset receipt.
