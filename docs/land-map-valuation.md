# Land map and official appraisal lookup

The staff valuation page displays real map imagery and stored or entered coordinates. Selecting a listing pins its known location. Empty coordinates create no pin. The map is not a cadastral survey and never invents parcel boundaries or deed identifiers. It can render red outlines from user-imported GeoJSON, manually drawn sketches, or an explicitly selected excerpt of licensed DOL open data.

Official services:

- Department of Lands: https://landsmaps.dol.go.th/
- Treasury appraisal search: https://assessprice.treasury.go.th/
- Treasury search manual: https://assessprice.treasury.go.th/assessprice/assessprice_manual.pdf

The official DOL citizen-services page links these services. The Treasury manual describes searches by deed number and province, adding district and survey page to distinguish parcels. Its alternative search uses land number and map sheet; missing records require the responsible Treasury office. No supported public parcel API, coordinate/deed deep link or permitted cadastral embed was established. The application opens the official services and prepares search details; it does not scrape their internal endpoints or claim government verification.

## Staff workflow

1. Choose an existing listing, or enter the parcel location and deed search details. Use the map, paste latitude/longitude, or use device location. Confirm the actual parcel in LandsMaps.
2. Copy search details and open Treasury search. Match the deed, area and location. Record the exact price per square wah, appraisal period, date checked, and a reference to the result or official printout.
3. Enter the deed area in rai/ngan/square wah. Calculation uses entered area times entered rate, excluding buildings. Asking prices from other land-sale listings in the same province and district are shown only as asking-price comparisons.
4. Save. Production Firebase records go to staff-only `settings/land_valuation_<listing ID>` (or `workspace` for an unlinked parcel), not to the public property document. The appraisal pin is stored with this private record. Local/demo backend keeps private drafts only in memory for the current page session; refreshing discards them. It does not persist private coordinates or deed details in browser storage. Supabase requires a private-storage implementation and does not report a false save.

The displayed transfer fee is an illustration of the ordinary 2% rate. It excludes tax, exemptions and temporary reduced rates; check the actual amount with the land office. A calculated report is not an official appraisal certificate.

## Verification

`npm test` covers explicit input, provenance, fractional area, invalid/overflow cases, comparables, API capabilities and private persistence. `npm run lint`, `npm run typecheck`, and `npm run build` check the application. Browser verification covers map layers, real coordinate selection, missing-data states, calculation, temporary local save/read, mocked Firebase save/reload, and mobile layout using the local backend with clearly marked test values.

`GET /api/landsmaps` advertises external official lookup and `officialDataFetched: false`; legacy query parameters do not fabricate results. `POST` performs manual calculation only and returns 400 for invalid input. Neither endpoint queries or returns saved staff records.

## Red parcel outlines

Use “ดูรูปแปลงจริงจากข้อมูลเปิดกรมที่ดิน” to view 100 actual adjacent polygons from Nam Ron, Mueang Phetchabun. The dataset was published in 2021 and is not Songkhla coverage or a current nationwide LandsMaps feed. Previewing it preserves the selected listing’s private pin and appraisal; it cannot be saved as that listing’s boundaries. Source attribution, coverage and transformation accuracy remain visible in fullscreen. See [DOL open parcel source](dol-open-parcel-source.md) for the original licensed download and reproducible transformation details.

For the selected property, use “วาดแนวเขต” and click at least three corners, then finish the polygon. Repeat for multiple plots; these are marked as user sketches. GeoJSON import accepts WGS84 Polygon/MultiPolygon geometry with up to 500 features, 10,000 coordinates and 512 KiB, retaining only plain-text labels and imported/sketch provenance. Actual title boundaries require a lawful, correctly georeferenced source or verification on the official LandsMaps site.

Private geometry is saved separately to staff-only `settings/land_boundaries_<listing ID>` or `workspace`, allowing maps to be saved before the deed area/appraisal is known. Failed server reads block edits and writes. Local mode keeps private drafts only in memory and discards them on refresh. Red lines do not automatically provide Treasury rates or alter the deed area used for calculation.
