# Production availability checks

Run `node scripts/production-health.mjs` from Node 22 or later. No installation,
provider credential, Firebase session or paid monitoring service is required.
The exit status is nonzero if any check fails after at most two attempts.

The monitor checks both apex and www using Google and Cloudflare validating DNS
resolvers, the expected Cloudflare nameservers, registry suspension/expiry,
verified TLS certificates (14-day warning), homepage/login HTTP content and
popup security headers, the same-origin Firebase helper, public catalog CORS,
one published cover image, and rejection of anonymous/forged staff credentials.
Domain registration warns at 30 days. Empty catalogs are allowed. It never
signs in, reads customer/private media, changes accounts or writes production.
JSON/HTML responses are bounded; image bodies are sampled to 1 KiB and cancelled
even if the server ignores the Range header. Output contains fixed check IDs and
failure codes only. No raw provider errors or listing bodies enter artifacts.

## GitHub Actions and notifications

`Production health` runs hourly at minute 17 UTC on main, or manually through
Actions -> Production health -> Run workflow. PRs run synthetic contract tests
only; production traffic and schedules begin only after merge. Permissions are
`contents: read`; the workflow cannot deploy or open/comment on issues.
Redacted reports expire after seven days. Check the Actions-minute allowance
before increasing frequency; this workflow adds no billing configuration.

The repository owner should enable GitHub Actions web/email notifications,
optionally selecting **failed workflows only**. Scheduled notifications go to
the schedule actor under GitHub's rules. No notification delivery has been
verified merely by adding this file. GitHub's native failure notifications may
repeat during an outage; there is no stateful incident deduplication here.
See [GitHub workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

Schedules can be delayed or dropped, run only from the default branch, and can
be disabled after 60 days of inactivity in public repositories. An hourly
workflow is a basic watchdog, not a guaranteed uptime service. See
[scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Responding to a failure

1. Read the failed fixed check ID in the run summary. Retry the workflow once
   to distinguish an ongoing fault from a resolver/provider transient.
2. For DNS failures, inspect registrar contact-verification status, nameservers
   and the parent DS record. Compare both public resolvers; do not change
   nameservers or disable protections just to silence the check. DNSSEC must
   match the active DNS provider. See [Cloudflare DNSSEC troubleshooting](https://developers.cloudflare.com/dns/dnssec/troubleshooting/).
3. For catalog/image failures, inspect Worker health, CORS, D1/R2 and quota.
   HTTP 200 on the homepage does not prove that listing data loaded.
4. For login/helper failures, compare first-party helper rewrites, COOP/CSP,
   Firebase authorized domains and exact Google OAuth redirect URIs for both
   hosts. Preserve existing URIs and authorization checks.
5. Verify recovery with a new passing run and a real browser/mobile check.

This is infrastructure/auth-configuration monitoring. A passing result does
not prove Google account selection, logout, admin authorization for a real
identity, LINE reply delivery, backup restore, or behavior on physical phones.
Keep the existing auth regression suites and human end-to-end checks as release
gates. DNSSEC being unsigned is not itself treated as an outage by this script;
validating resolver failures are.
