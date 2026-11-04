# Public Songkhla appraisal lookup

The homepage shortcut and callout open `/land-valuation`. The same tool is
linked from Services, the sitewide footer and sitemap. This public feature
uses no Firebase/customer/staff records and makes no writes or authenticated
API calls. It works in Next server hosting and the static Pages export.

## Source and freshness

Source: Treasury Department, Land Valuation dataset, Songkhla resource
`5e45fa23-62f1-44d9-9a15-af2ec2d99469` in the
[Treasury catalog](https://catalog.treasury.go.th/dataset/land-valuation).
Its public access and declared `Open Data Common` license are retained with
publisher attribution and the source link. The
[government catalog mirror](https://data.go.th/dataset/land-valuation)
references the same resource.

On 2026-11-04 the live Treasury resource metadata's MD5
`32ecc5296ab5fcfde2bbc63e72db9304` and 42,785,363-byte size matched the supplied
`land_90_songkhla.csv`. The local file's SHA-256 is pinned in
`src/data/songkhla-land-source.json`. The source separately reports a file
modification on 2026-01-20 and content-update date 2026-06-10. The UI labels
that content-update date and the catalog-check date; neither is presented as
an individual parcel's effective appraisal period. The CSV has no period/year
column. It is a dated snapshot of the latest catalog resource checked, not a
live Treasury query. No future appraisal year is inferred.

EVAPRICE is displayed as baht per square wah, consistent with the Treasury's
[public appraisal instructions](https://www.treasury.go.th/th/services/land-assessment/search-condo-price).
The calculator multiplies the selected source rate by user-entered deed area
(1 rai = 400 square wah, 1 ngan = 100 square wah). It does not estimate market
prices, buildings, taxes or transaction fees. The result points users to
[official Treasury lookup](https://assessprice.treasury.go.th/) for validation.

## Data checks and delivery

- 1,127,154 source rows, seven expected numeric columns, no invalid/empty rows.
- The six-field numeric reference has 1,469 duplicate keys; 1,468 have
  conflicting prices. Every source row is preserved, including the identical
  duplicate and every conflicting price. No average, minimum or last-write
  winner is substituted. Results with multiple rows require explicit selection.
- Raw identifier strings retain leading zeros. Numeric equivalence is used
  only for matching, including Thai digit input; sheet filenames pad map3 to
  four digits. Original CSV line numbers are shown for traceability.
- No coordinates, owner names, deed numbers or boundaries are available from
  this file. UTM sheet identifiers are not treated as latitude/longitude.
- The builder emits 1,646 static sheet files, 35,112,134 bytes in total; the
  largest is 486,244 bytes. The homepage does not fetch sheet files. A query
  loads only its selected sheet, with a 2 MiB response cap and 15-second
  timeout. The UI retains at most three sheets, displays 20 results per page,
  and cancels/ignores obsolete searches and clears selected rates on edits.
- Content-addressed asset paths have immutable browser caching on Next/Vercel.
  Static hosts apply their own cache policy; the versioned path and
  `force-cache` fetch work without a runtime API or database. Reads use
  `credentials: same-origin` so an existing Vercel Protection session also
  covers Preview assets. Validated relative paths cannot transmit cookies to
  other hosts; no Firebase bearer token is requested or attached.
  Page/index data does not receive the immutable asset policy.

## Reproduce and refresh

```powershell
node scripts/build-songkhla-land.mjs --check-source
node scripts/build-songkhla-land.mjs --build C:\absolute\path\land_90_songkhla.csv
node --test tests/songkhla-land.test.cjs tests/sitemap.test.cjs
```

The builder verifies live official metadata and the pinned SHA-256 before
processing. It rejects changed columns/dialects, invalid numeric fields,
oversized files or sheets, and an existing version directory. Generated index
and per-sheet checksums remain reviewable in Git. The raw 42 MB CSV is not
required in the repository or browser.

For a new release, first inspect the current official resource and download
the revised CSV. Review its scope, update dates, units, license and quality;
update the pinned metadata/hashes and `verifiedAt` only after those checks.
Build a new version directory and commit the new index/integrity report with
it. Retain previously published version URLs during their cache lifetime.
Do not relabel the current snapshot as a new year without new source evidence.
There is no automatic production data refresh or new paid service.

## Validation

Tests exercise source identity, conflicting duplicates, leading zeros, exact
matching, invalid inputs, source drift, malformed/truncated assets, safe area
arithmetic, immutable cache boundaries, and hashes/counts of every shipped
sheet. Browser checks cover actual lookup, no-results, conflicting 530/330-baht
records without automatic selection, selected-rate calculation, clearing old
results on edit, homepage navigation and a 390px mobile viewport. A restricted
example produced 550 square wah × 450 baht = 247,500 baht. These checks do not
certify Treasury's individual parcel data or replace official verification.
