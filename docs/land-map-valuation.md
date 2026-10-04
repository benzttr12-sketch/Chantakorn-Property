# Land map and official appraisal lookup

The staff valuation page displays real map imagery and stored or entered coordinates. Selecting a listing pins its known location. Empty coordinates create no pin. The map is not a cadastral survey and never generates parcel boundaries or deed identifiers.

Official services:

- Department of Lands: https://landsmaps.dol.go.th/
- Treasury appraisal search: https://assessprice.treasury.go.th/
- Treasury search manual: https://assessprice.treasury.go.th/assessprice/assessprice_manual.pdf

The official DOL citizen-services page links these services. The Treasury manual describes searches by deed number and province, adding district and survey page to distinguish parcels. Its alternative search uses land number and map sheet; missing records require the responsible Treasury office. No supported public parcel API, coordinate/deed deep link or permitted cadastral embed was established. The application opens the official services and prepares search details; it does not scrape their internal endpoints or claim government verification.

## Staff workflow

1. Choose an existing listing, or enter the parcel location and deed search details. Use the map, paste latitude/longitude, or use device location. Confirm the actual parcel in LandsMaps.
2. Copy search details and open Treasury search. Match the deed, area and location. Record the exact price per square wah, appraisal period, date checked, and a reference to the result or official printout.
3. Enter the deed area in rai/ngan/square wah. Calculation uses entered area times entered rate, excluding buildings. Asking prices from other land-sale listings in the same province and district are shown only as asking-price comparisons.
4. Save. Production Firebase records go to staff-only `settings/land_valuation_<listing ID>` (or `workspace` for an unlinked parcel), not to the public property document. The appraisal pin is stored with this private record. Local/demo backend saves only in the current browser. Supabase requires a private-storage implementation and does not report a false save.

The displayed transfer fee is an illustration of the ordinary 2% rate. It excludes tax, exemptions and temporary reduced rates; check the actual amount with the land office. A calculated report is not an official appraisal certificate.

## Verification

`npm test` covers explicit input, provenance, fractional area, invalid/overflow cases, comparables, API capabilities and private persistence. `npm run lint`, `npm run typecheck`, and `npm run build` check the application. Browser verification covers map layers, real coordinate selection, missing-data states, calculation, save/reload and mobile layout using the local backend with clearly marked test values.

`GET /api/landsmaps` advertises external official lookup and `officialDataFetched: false`; legacy query parameters do not fabricate results. `POST` performs manual calculation only and returns 400 for invalid input. Neither endpoint queries or returns saved staff records.
