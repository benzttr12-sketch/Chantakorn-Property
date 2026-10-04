# รูปแปลงข้อมูลเปิดกรมที่ดิน: ตำบลน้ำร้อน จังหวัดเพชรบูรณ์

`public/data/dol-nam-ron-parcels.geojson` contains 100 actual cadastral polygons from a public Department of Lands dataset. It is an attributed, bounded excerpt for viewing real red parcel outlines. It is **not** a live LandsMaps feed, a current certified survey, a Treasury appraisal dataset, or parcel coverage for Songkhla.

## Official source and attribution

- Provider: กรมที่ดิน / สำนักงานที่ดินจังหวัดเพชรบูรณ์ (Department of Lands, Phetchabun Provincial Land Office).
- Dataset: [รูปแปลงที่ดิน สำนักงานที่ดินจังหวัดเพชรบูรณ์](https://data.go.th/dataset/parcel_phetchaboon).
- Dataset identifier: `acc2f699-cb1c-4e50-aa16-a0d1767143ea`.
- Coverage stated by the official dataset: ตำบลน้ำร้อน อำเภอเมือง จังหวัดเพชรบูรณ์ (Nam Ron subdistrict, Mueang Phetchabun, Thailand). Resource notes describe the land census project supporting maize cultivation after rice harvest.
- Original resource: [รูปแปลงที่ดินตำบลน้ำร้อนจังหวัดเพชรบูรณ์ — xx.zip](https://data.go.th/dataset/acc2f699-cb1c-4e50-aa16-a0d1767143ea/resource/9c9f9756-f462-41e0-a076-cb810265be93/download/xx.zip).
- [Public CKAN metadata](https://data.go.th/api/3/action/package_show?id=parcel_phetchaboon).
- Catalog dataset created: 2021-06-14 06:42:00.583901; catalog metadata modified: 2021-10-31 06:10:25.782530. These catalog timestamps do not specify a time zone.
- Original resource created: 2021-06-14 06:44:58.859762; resource last modified: 2021-06-14 06:44:58.401480. These are publication metadata, not a guaranteed survey measurement date.
- Downloaded and converted: 2026-10-04.

Map attribution: **กรมที่ดิน · ข้อมูลเปิด ต.น้ำร้อน จ.เพชรบูรณ์ · เผยแพร่ 2564 · แปลงพิกัดเป็น WGS84**. The UI must keep the region and historic publication date visible when this layer is selected.

## License evidence

The public CKAN registry identifies the license as **Creative Commons Attributions**, without specifying a version or a license URL. The provider's all-resource ZIP includes `datapackage.json`, which instead labels the license **DGA Open Government License** (`type: ogl`). Preserve both source descriptions; neither establishes a particular Creative Commons version. The excerpt retains attribution, identifies the transformation, and includes no source DBF attributes. It must not imply an endorsement or certification by the Department of Lands.

## Geometry selection and transformation

The original ZIP contains SHP, SHX, DBF and PRJ. Conversion reads **only SHP, SHX and PRJ**; the DBF is never loaded. All 3,925 source geometries were valid Polygon or MultiPolygon geometries; no invalid geometry was repaired or substituted.

Selection is deterministic in the original projected coordinate system:

1. Calculate the center of the source SHP bounding box.
2. Select the parcel whose centroid is nearest that center (1-based SHP record 2833).
3. Grow a connected neighborhood using actual polygon intersection or a projected separation of at most 0.02 meters. The 2 cm tolerance accommodates coordinate rounding gaps and only affects neighbor selection; it never changes the geometry.
4. Select candidates nearest the seed centroid first until 100 polygons are retained.

No vertices are generated, smoothed, simplified, joined, repaired or snapped. Polygon interiors and separate components are preserved by the conversion; this selected excerpt happens to contain 0 interior rings and 0 MultiPolygon features. Ring orientation is normalized to the GeoJSON right-hand convention (outer rings counterclockwise, inner rings clockwise), which changes vertex order only.

The source PRJ is **Indian_1975_UTM_zone_47N**, identified as **EPSG:24047**. It uses Indian 1975 / Everest and projected meters; the raw numbers are not longitude/latitude. The destination is **WGS84, EPSG:4326**, emitted as **longitude, latitude** as required by GeoJSON.

The operation selected by PROJ, constrained to the dataset's Thailand area of interest and with ballpark transforms disallowed, is:

> Inverse of UTM zone 47N + Indian 1975 to WGS 84 (4) (with axis order normalized for visualization)

PROJ reports nominal transformation accuracy of **3 meters**, with its best available non-ballpark operation present. This is the coordinate operation's stated accuracy; the positional quality of the original cadastral dataset and of a displayed imagery/base map is not independently established. Do not use this display to decide a legal boundary, survey distance or land title location without the source agency's confirmation.

Recorded PROJ pipeline:

```text
proj=pipeline step inv proj=utm zone=47 ellps=evrst30 step proj=push v_3 step proj=cart ellps=evrst30 step proj=helmert x=293 y=836 z=318 rx=0.5 ry=1.6 rz=-2.8 s=2.1 convention=position_vector step inv proj=cart ellps=WGS84 step proj=pop v_3 step proj=unitconvert xy_in=rad xy_out=deg
```

Conversion tools: pyshp 3.1.6, pyproj 3.8.0 / PROJ 9.8.1, Shapely 2.1.2. They were used in an isolated conversion environment; the application needs no new runtime dependencies.

## Export content and validation

- Features: **100**.
- Coordinate positions, including closing ring positions: **1,234**.
- UTF-8 file size: **64,687 bytes** (below the 400 KiB / 8,000-position viewer budget).
- WGS84 bounds `[west, south, east, north]`: `[101.16262771252391, 16.31039853515285, 101.17440192201141, 16.319833237045902]`.
- Original resource ZIP SHA-256: `28358a5884fe0f0c422b3f080e9cb5ea7c28d3a854beb2a226359fda8e177530`.
- Export GeoJSON SHA-256: `9f3184bc73976980f5f5886568c823c0b44da610f6628f77f3652a536a446ad1`.

Each feature's only properties are `label: "แปลงข้อมูลเปิด [1-based SHP record index]"` and `origin: "imported"`. The label is a display/reference index, **not a deed number, land number or government identifier**. No owner's name, deed number, DBF attribute, appraisal rate or other personal record is exported.

The original direct resource download was independently checked against the ZIP contained in the all-resource bundle. Every exported geometry was compared to its original SHP geometry after the recorded transformation and orientation normalization and matched exactly. All exported polygons are valid and have closed rings. Vertex precision is retained; no decimal rounding adds displacement.

Selected original SHP record indices, in output order:

```text
2833, 2883, 2884, 2829, 2704, 2866, 2767, 2702, 2703, 2882, 2820, 589, 2584, 3819, 2803, 2827, 600, 2610, 2819, 2609, 2828, 2881, 3002, 3025, 2879, 2599, 614, 209, 43, 3026, 44, 4, 2597, 3807, 2904, 2570, 42, 2885, 2880, 2569, 41, 2586, 210, 2768, 2761, 3813, 2553, 2554, 57, 40, 2779, 3810, 2801, 2905, 2574, 2707, 2906, 2760, 5, 58, 240, 3040, 2589, 2566, 3039, 241, 59, 2834, 2705, 3038, 2903, 2587, 2902, 3041, 556, 2901, 6, 2794, 2961, 2813, 2960, 2916, 162, 2985, 3804, 2932, 2986, 2758, 2886, 2573, 3024, 2815, 2812, 61, 186, 2987, 204, 2762, 3020, 2816
```

## Availability and coverage limits

The official LandsMaps website and unauthenticated public WMS/WFS GetCapabilities candidates returned HTTP 503 from the research environment on 2026-10-04. This does not establish a global outage. No usable documented national/Songkhla cadastral overlay or authorized service contract was established.

This public historic Phetchabun excerpt provides actual multi-parcel viewing. It must never appear around a Songkhla property or replace missing property-specific boundaries. For another location, use the official LandsMaps website or import lawfully obtained georeferenced parcel data with its source and coverage identified.
