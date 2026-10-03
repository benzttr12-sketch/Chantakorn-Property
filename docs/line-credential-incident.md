# LINE credential incident: investigation and remediation

Never paste credential values into issues, commits, chat, shell commands, screenshots, or logs. This document contains no secret values. Perform provider changes as a channel administrator; repository cleanup does not revoke credentials.

## Evidence and scope

The repository is public. Investigation baseline: `main` at `3811659bf8bf96ac4becd6376163f70e961b6624`.

| Event | Commit | Location |
| --- | --- | --- |
| Initial introduction, October 2, 2026, 05:18 PDT | `86c359b6274e55abd9109e044b9a27c1de979b6a` | New `src/lib/line-auth.ts:6`, `DEFAULT_LINE_CHANNEL_SECRET` |
| Copied into client settings | `61aae23bcbdce7e2506e44e8dc7907b9051962c5` | `src/app/admin/settings/page.tsx:90`, preset handler |
| Both copies removed | `9c3edba820603edcc1bad7f7633829feed3a732b` | Server-only LINE configuration |
| Secure follow-up merged | `c42d9ef89b29d6afa40fd425718262af54b8bf11` | Included `15a2bcc98c51c4bc93f857b3066518bde2c5f481` |
| Client copy reintroduced, October 3, 2026, 09:32 PDT | `3811659bf8bf96ac4becd6376163f70e961b6624` | `src/app/admin/settings/page.tsx:90` |

The exposed credential is a **Messaging API channel secret**, paired with public channel ID `2011760874`, rather than an already-issued bearer access token. The initial helper passed the pair as `client_id` and `client_secret` to `POST https://api.line.me/v2/oauth/accessToken`, which issues a 30-day short-lived access token. The parent commit contains no exact copy of this secret. An exact-value search found the client preset as the sole copy in the baseline tracked tree; all ten fetched remote branch tips were checked, and only `main` contained it. Historical reachable blobs still contain copies.

Source exposure is confirmed with high confidence. Live validity, unauthorized use, GitGuardian incident metadata/status, deployed code, and provider revocation state were not verified. No request used the exposed secret. `SECURITY.md` is a template; the explicit server-only credential boundary comes from `docs/line-production.md`.

The baseline also restored unsafe configuration paths: notify GET returned complete credentials without authentication; notify/webhook read credentials from Firestore, persisted generated tokens there, and admin settings stored credentials in localStorage. A rotation performed against that code could expose the replacement.

## Code remediation

The patch removes the current client literal and restores the repository's existing server-only LINE implementation from `15a2bcc`, preserving notification toggles, large authenticated property payloads, and image resolution. It:

- Reads `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` only from server environment variables.
- Returns presence flags, never credential values or fragments, from settings/status endpoints.
- Authenticates staff settings and listing notifications; rejects public credential overrides.
- Saves only nonsecret notification preferences in Firestore and ignores legacy credential fields.
- Removes credential inputs/presets and clears the three legacy browser credential keys when settings loads.
- Requires valid webhook signatures; staff simulation uses authenticated, explicitly dry execution.
- Uses explicitly configured staff recipients and reports provider rejections as failures.
- Checks tracked/staged files for this incident's value and embedded LINE credential literals in CI.

This intentionally ends browser/Firestore credential configuration and automatic OAuth issuance. Supply an explicit access token in the server runtime. Group/broadcast fallback, LINE Notify tokens, and enrolling customers as staff recipients are not part of the server-only flow. LINE Notify itself ended service on March 31, 2025.

Local validation: lint, typecheck, all 44 tests, the production build, and static export passed. The patch also preserves the published-property photo endpoints and uploaded-cover handling deployed from `5e5cf6cf8347da8f2ced5d70e17fac516b948920`. Static export required a temporary directory on the repository's filesystem because the existing build script uses `rename` across the default `/tmp` mount. The proposed staged patch and production artifacts contained zero matches for the incident credential. A full local-history scan found four contaminated blobs across the two affected paths. The scanner was also checked against a synthetic reintroduced client preset in a shallow repository and against a bare history mirror. These checks establish source cleanup, not provider revocation or validation of an as-yet-unsupplied replacement. Notification preference reads remain subject to deployed Firestore permissions.

Commit/merge and deploy this patch before supplying replacement credentials to the app. The local change alone does not alter GitHub `main`, deployed bundles, or provider credentials. If immediate deployment is impossible, restrict the exposed deployment and rotate the provider secret immediately, then keep the replacement out of that deployment until the patch is live.

## Exact rotation procedure

1. In [LINE Developers Console](https://developers.line.biz/console/), select the provider and **Messaging API** channel with ID **2011760874**, associated with OA **@930xzcyi**. Confirm both identifiers; do not rotate a separate LINE Login channel.
2. Under **Basic settings → Channel secret**, click **Reissue** and complete the confirmation. Store the new value directly in a password manager/secret manager. The old secret must cease authenticating OAuth issuance and webhook signatures. Do not merely change the repository's channel ID or replace a bearer token while leaving the exposed secret active.
3. Treat tokens minted while that secret was exposed as compromised too. Under **Messaging API → Channel access token (long-lived)**, use **Issue/Reissue** as presented by the console, invalidate the previous long-lived token immediately (choose no validity grace period), and save the replacement privately. For this incident, a long-lived token matches the app's explicit environment-token configuration. A separately managed short-lived/v2.1 token is also supported, but its expiry/renewal must be managed outside this client UI.
4. Revoke every known old short-lived or long-lived token using **POST `https://api.line.me/v2/oauth/revoke`**, with `Content-Type: application/x-www-form-urlencoded` and body field `access_token`. Known v2.1 tokens instead use **POST `https://api.line.me/oauth2/v2.1/revoke`** with `client_id`, the current `client_secret`, and `access_token`. Use a trusted secret-aware client with response/body logging disabled; do not put values in command arguments or URLs. A 200 revoke response is not proof that a supplied token was previously valid.
5. Do not assume reissuing the channel secret or long-lived token revokes independently minted short-lived tokens. The legacy `/v2/oauth/accessToken` flow has no documented API to list all outstanding tokens. Ask LINE support to confirm/invalidate outstanding tokens for this channel when unknown tokens may exist. If that cannot be established, record the residual window: short-lived tokens can last 30 days after the last possible issuance; stateless tokens last 15 minutes and cannot be revoked. If immediate complete invalidation is required, coordinate channel replacement/retirement with LINE support. OA continuity and channel migration require a provider decision.
6. In the correct **Vercel project → Settings → Environment Variables**, replace **`LINE_CHANNEL_SECRET`** and **`LINE_CHANNEL_ACCESS_TOKEN`** in **Production**, and in each Preview/Development scope that actually uses this channel. Use sensitive/server-only entries; never add a `NEXT_PUBLIC_` prefix or expose them through `next.config`'s `env` map. Configure `LINE_TARGET_USER_ID` and optional comma-separated `LINE_ADMIN_USER_IDS` with approved staff user IDs. Tokens and secrets must belong to the same channel. Redeploy the patched commit to production.
7. Inventory any older Cloudflare Worker, AI Studio runtime, other deployments, CI secrets, local `.env.local`, and secret-manager versions that use this channel. Update or retire them. Remove obsolete deployment aliases/artifacts that serve the vulnerable bundle; do not roll back to a vulnerable build or old environment snapshot. Purge relevant caches. Retain only redacted incident evidence.
8. In the actual Firestore database's **`settings/line_oa`** document, delete credential fields **`channel_secret`**, **`channel_access_token`**, and **`line_notify_token`**. Keep nonsecret preferences. Review deployed rules and restrict access to staff. Clear browser keys `line_channel_secret`, `line_channel_access_token`, and `line_notify_token` on every previously used app origin/browser; the updated settings page clears these keys for visiting users, but cannot clear other users' devices remotely.
9. Review LINE usage/delivery, deployment logs, repository access/forks, and relevant database access for unexpected activity without copying sensitive request contents. Record rotation/revocation timestamps and token class coverage. Resolve GitGuardian only after provider revocation and exposure verification; keep historical detection as an incident record rather than labeling a genuine secret a false positive.

## Verify revocation and replacement

Use hidden-input, in-memory provider requests from an administrator's trusted machine, with HTTP debug logging disabled. For an old short/long-lived token, **POST `/v2/oauth/verify`** with form field `access_token` must reject it; the replacement must return 200 and **`client_id: 2011760874`**. Retain only the HTTP status and nonsecret channel ID/expiry. v2.1 tokens use **GET `/oauth2/v2.1/verify`** with `access_token`; use a trusted client that suppresses URL/query logs because that endpoint puts a token in the query. Never print the full token verification response automatically.

Confirm the old channel secret cannot issue a token via **POST `/v2/oauth/accessToken`**, form fields `grant_type=client_credentials`, `client_id=2011760874`, and `client_secret` supplied privately. Print only the HTTP status. Any unexpected success means revocation failed; privately revoke the newly returned token immediately and reopen remediation. The repository scan below does not contact LINE or establish revocation.

From a real terminal in the patched repository, scan source and the staged snapshot:

```sh
python3 scripts/check-line-credentials.py
git add src/app/admin/settings/page.tsx src/app/api/line/notify/route.ts src/app/api/line/webhook/route.ts src/app/api/line/property-image/route.ts 'src/app/api/properties/[id]/image/route.ts' src/lib/line-property-image.ts tests/line-notify.test.cjs tests/line-webhook.test.cjs scripts/check-line-credentials.py .github/workflows/pages.yml docs/line-credential-incident.md
python3 scripts/check-line-credentials.py --index --prompt
npm run lint
npm run typecheck
npm test
npm run build
python3 scripts/check-line-credentials.py --prompt --build-dir .next
```

Enter the replacement secret and token only at the two hidden prompts. Require **zero matches**. Scan static export artifacts as well if used, with `--build-dir .next-pages` after `npm run build:pages`. The scanner checks exact supplied values and common base64/hex/URL representations, plus literal credential patterns; it is scoped protection, not a comprehensive secret scanner. Also run GitGuardian/ggshield or another redacting secret scanner against source, complete history, and deploy artifacts. Never attach an unredacted scan report.

After deployment:

1. Open `/api/line/webhook`; require the deployed `buildRevision` to match the patched production commit, both presence flags true, and `credentialValidation: presence_only`. Presence is not provider validation.
2. Require unauthenticated **GET `/api/line/notify`** to return **401**. As staff, inspect its response with an in-memory equality check against the replacement; require no secret/token value or fragment, only configuration flags/preferences.
3. Confirm missing/invalid webhook signatures return **401**, including the old literal simulation signature. Confirm an authenticated simulation reports `simulation: true` and sends no real messages.
4. In LINE Console, confirm **Webhook URL** is the production HTTPS `/api/line/webhook`; click **Update → Verify** and enable **Use webhook**. A signed `events: []` verification checks connectivity/HMAC, not bearer-token usability.
5. From a normal LINE user, send **`ดูทรัพย์`**. Receive a published property card and open its detail link. Require real processing with `successfulReplies: 1`, `failedReplies: 0`, `simulation: false`. Send one intentional staff notification and confirm actual receipt by the approved recipient. API acceptance alone does not prove delivery.
6. On each previously affected host, verify localStorage credential keys are absent, Firestore credential fields are deleted, and responses/HTML/JavaScript/source maps/build outputs contain neither replacement value. Download/scan artifacts only in a restricted workspace; compare values in memory and print filenames/counts only. Scan logs locally with the same principle, without exposing matches. Historical cached/forked copies cannot be proven erased by a source scan.

## Proposed history cleanup — not executed

Rotate/revoke first and merge the remediation before rewriting. Freeze pushes, inventory branches/tags/PRs/forks, notify collaborators, and coordinate branch protections. Rewriting changes commit IDs/signatures and can disrupt PRs/releases. Any temporary backup containing the incident must be access-controlled and have a deletion plan; never upload it as a public artifact.

Use **git-filter-repo >= 2.47** in a fresh mirror; this replaces the value across files/renames rather than deleting the whole auth/settings files. Keep the exact-value file outside the mirror and out of Git. Capture both blob replacement and commit/tag message replacement. The following prepares a local rewrite only:

```sh
git clone --mirror https://github.com/benzttr12-sketch/Chantakorn-Property.git Chantakorn-Property-clean.git
cd Chantakorn-Property-clean.git
git fetch origin '+refs/pull/*/head:refs/pull/*/head'
git for-each-ref --format='%(objectname) %(refname)' refs/heads refs/tags > ../line-refs-before.txt
export LINE_CLEANUP_DIR="$(mktemp -d)"
python3 - <<'PY'
import base64, os, pathlib, re, subprocess
from urllib.parse import quote
source = subprocess.check_output(['git', 'show',
    '86c359b6274e55abd9109e044b9a27c1de979b6a:src/lib/line-auth.ts'])
match = re.search(rb'DEFAULT_LINE_CHANNEL_SECRET\s*=\s*(["\'])(.*?)\1', source)
if not match or not match[2]:
    raise SystemExit('Could not locate incident credential; stop and investigate privately.')
value = match[2]
directory = pathlib.Path(os.environ['LINE_CLEANUP_DIR'])
representations = {value, base64.b64encode(value), value.hex().encode(), quote(value.decode(), safe='').encode()}
for name, content in [
    ('incident-values.txt', value + b'\n'),
    ('replacements.txt', b''.join(b'literal:' + item + b'==>REMOVED_LINE_CREDENTIAL\n' for item in sorted(representations))),
]:
    fd = os.open(directory / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
PY
git filter-repo --sensitive-data-removal --replace-text "$LINE_CLEANUP_DIR/replacements.txt" --replace-message "$LINE_CLEANUP_DIR/replacements.txt"
```

If inventory discovers other exposed token values, add them privately to the protected value/replacement files before filtering. Do not populate commands with their values. Keep a copy of the patched scanner outside the mirror and run it there:

```sh
python3 /absolute/path/to/patched/scripts/check-line-credentials.py --history --secret-file "$LINE_CLEANUP_DIR/incident-values.txt"
git for-each-ref --format='%(objectname) %(refname)' refs/heads refs/tags > ../line-refs-after.txt
```

Require zero matches, run a redacting full-history scanner, and compare before/after refs. Check out the rewritten main in a separate clone and rerun lint/types/tests/build. Review `.git/filter-repo/changed-refs` (or `filter-repo/changed-refs` in a bare repository) to identify affected pull requests. Do not use a blind mirror push: it can overwrite/delete unrelated refs.

After the coordinated freeze and review, configure the mirror's `origin` URL again if filter-repo removed it. Push each **reviewed changed branch/tag** with an explicit lease based on its recorded original SHA; for example, substitute the nonsecret old main SHA from `line-refs-before.txt`:

```sh
git push origin --force-with-lease=refs/heads/main:OLD_MAIN_SHA refs/heads/main:refs/heads/main
```

Repeat with the corresponding exact lease for each affected branch/tag. A lease failure means someone changed the remote: stop and reconcile instead of adding `--force`. Restore protections afterward. GitHub's `refs/pull/*` cannot be overwritten; contact **GitHub Support** with the affected PRs, first changed commits, and filter-repo results to remove cached views/PR references and request server garbage collection. Fork owners must independently clean their forks. Require collaborators to fresh-clone or follow filter-repo's sensitive-data cleanup procedure; merging an old branch can reintroduce the original history.

Fetch a fresh mirror from GitHub after Support's cleanup and rescan all advertised refs. Verify the old commit/raw-file URLs are no longer accessible where removal is supported. Private cached/local copies may persist even then. Remove the protected temporary files/directory and obsolete local clones under your organization's secure deletion policy; ordinary file deletion does not guarantee media erasure. History cleanup is exposure reduction, not proof that the original secret was never copied.

## References

- [LINE channel access token types and revocation](https://developers.line.biz/en/docs/basics/channel-access-token/)
- [LINE Messaging API token issuance, verification, and revocation](https://developers.line.biz/en/reference/messaging-api/#issue-shortlived-channel-access-token)
- [LINE webhook signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [GitHub sensitive-data removal](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
