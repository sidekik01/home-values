# Home Values

A responsive Spokane home-value interface with a server-side county parcel lookup. Plain HTML, CSS, JavaScript, and Node.js; no runtime dependencies.

## Run

- `npm run dev` serves the site and API at http://localhost:3001 (Node.js 20.18.1+).
- `npm run build` copies static assets to `dist/`.
- `npm test` runs county adapter/API validation tests.
- Vercel deploys `dist/` and the Node function at `api/county.js` using the included configuration.

## County lookup

`POST /api/county` with JSON `{ "query": "1116 W BROADWAY AVE" }` or a standard parcel number such as `35182.4601`.

The adapter resolves Spokane County's public Parcels item `228db1be1d6940a3b5e3f2104e470134` from ArcGIS, discovers its actual service URL and field schema, then queries up to nine records and displays eight with a refinement hint when more exist. It never automatically assumes an address match: the visitor confirms a returned address/parcel first. Queries accept street addresses and standard five-digit/four-digit parcel IDs. Searches with a city should use a comma, although trailing Spokane/Spokane Valley with optional WA and ZIP is also normalized.

Source: https://gisdatacatalog-spokanecounty.opendata.arcgis.com/datasets/228db1be1d6940a3b5e3f2104e470134_0

The parcel search requests and returns only allowlisted property fields. The optional full-detail lookup fetches a county SCOUT HTML summary, which can include owner/taxpayer information; the parser discards those fields and returns only the property sections needed for this site. Raw county HTML is not returned to the browser or persisted. Values are labeled as county assessments, with source assessment/tax years when available. Retrieval time is distinct from the source's update time. Null values remain unavailable; zero is retained.

Searches use POST to avoid address-bearing site URLs. The application does not persist search queries or property responses. County and hosting providers may process request metadata. Metadata/schema is cached in-process for one hour; property responses are not cached. Requests have a 12-second upstream timeout, field/schema validation, destination allowlisting, SQL literal escaping, bounded result counts, and safe errors. A source failure never falls back to fictional estimates.

## Full county details

After a visitor confirms a parcel, `POST /api/county-details` with `{ "parcel": "35114.0815" }` fetches that parcel’s SCOUT `Summary.aspx?PID=…` page and, independently, county school boundary data.

The HTML adapter verifies the displayed parcel identity, then matches table headers rather than page-specific CSS IDs. It extracts assessment history by tax year, sale/transfer records, annual tax charges and remaining balances, building characteristics, classification, and assessment neighborhood. A/V property tax is kept separate from total charges, which may include fees or interest. Above-grade room-count limitations are displayed. Multiple buildings remain separate, and basement areas are not silently added to gross living area.

School lookup gets the selected parcel polygon from the county GIS and intersects it with the official OpenData/Boundary school-district and school-boundary layers. Metadata controls which name/type fields are requested. Boundary results do not guarantee current school assignment or eligibility. Source failures are independent; they do not remove the basic parcel record. Failed or missing detail sections stay clearly unavailable.

## Current limits

The visitor confirmed the original parcel lookup works in Vercel preview. Full-detail/SCOUT HTML extraction and school boundaries are new and have been tested with controlled fixtures and simulated API responses, but not yet verified against live responses from this workspace: outbound county connections remain blocked.

The county can change its page structure or GIS schema. The detail adapter uses identity checks and returns explicit missing/partial/error states rather than unrelated or fictional data. Data is retrieved on demand with bounded result sizes and timeouts; responses are not cached by the application. No bulk crawl is performed.

Embedded county JPEG/PNG images are extracted from the identity-verified SCOUT summary when present. JPEG bytes mislabeled as PNG are normalized to JPEG. Small images, labeled logos/maps/sketches, unsupported image formats, duplicates, and oversized payloads are excluded. The display labels images as county records without asserting a capture date. Single images have no carousel arrows; multiple images support buttons and keyboard navigation. Missing or broken images retain an honest fallback. Remote image links and images inserted only by county-side JavaScript are not retrieved by this adapter.

Zillow and Realtor.com are not connected. Obtain licensed provider access before adding their estimates/photos.

## Verification

- `npm run build`: passed.
- `npm test`: 28 passing adapter/API tests, covering normalization, query construction, destination validation, response mapping, private-field exclusion, missing/zero values, bounded/duplicate/no results, schema changes, upstream errors, and API input validation.
- Chromium UI checks with mocked API responses at desktop and 390px mobile widths: candidate confirmation, property display, missing provider/photo states, accordions, empty/error states, source text escaping, sample flow, privacy dialog, no horizontal overflow, no browser errors.
- Local API failure path verified against the currently blocked network: returns a controlled 503 instead of fabricated data.
- Basic live parcel lookup: confirmed by the user in Vercel preview.
- Full SCOUT and school-boundary live verification: pending.
- Full-detail Chromium checks with simulated responses verify all five sections, assessment graph, exact tax cents, zero-dollar transfers, source links, mobile overflow, and preservation of the basic result on detail failure.

## County image verification

28 data tests pass, including embedded MIME correction, invalid/duplicate/excluded sources, payload bounds, and parcel identity. Chromium checks with controlled responses confirm actual JPEG/PNG decoding, carousel buttons and keyboard, one-image controls, no-image fallback, and mobile width. Live image extraction for parcel 36282.0408 must still be checked in preview; workspace county access remains blocked. The supplied base64 image was used to identify the format, not hardcoded as a photo for arbitrary properties.
