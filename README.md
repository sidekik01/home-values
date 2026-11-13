# Home Values

A responsive Spokane home-value interface with a server-side county parcel lookup. Plain HTML, CSS, JavaScript, and Node.js; no runtime dependencies.

## Run

- `npm run dev` serves the site and API at http://localhost:3001 (Node.js 18+).
- `npm run build` copies static assets to `dist/`.
- `npm test` runs county adapter/API validation tests.
- Vercel deploys `dist/` and the Node function at `api/county.js` using the included configuration.

## County lookup

`POST /api/county` with JSON `{ "query": "1116 W BROADWAY AVE" }` or a standard parcel number such as `35182.4601`.

The adapter resolves Spokane County's public Parcels item `228db1be1d6940a3b5e3f2104e470134` from ArcGIS, discovers its actual service URL and field schema, then queries up to nine records and displays eight with a refinement hint when more exist. It never automatically assumes an address match: the visitor confirms a returned address/parcel first. Queries accept street addresses and standard five-digit/four-digit parcel IDs. Searches with a city should use a comma, although trailing Spokane/Spokane Valley with optional WA and ZIP is also normalized.

Source: https://gisdatacatalog-spokanecounty.opendata.arcgis.com/datasets/228db1be1d6940a3b5e3f2104e470134_0

The response exposes only allowlisted property fields; owner names and owner/taxpayer mailing addresses are neither requested nor returned. Values are labeled as county assessments, with source assessment/tax years when available. Retrieval time is distinct from the source's update time. Null values remain unavailable; zero is retained.

Searches use POST to avoid address-bearing site URLs. The application does not persist search queries or property responses. County and hosting providers may process request metadata. Metadata/schema is cached in-process for one hour; property responses are not cached. Requests have a 12-second upstream timeout, field/schema validation, destination allowlisting, SQL literal escaping, bounded result counts, and safe errors. A source failure never falls back to fictional estimates.

## Current limits

County integration is implemented and tested against controlled fixtures, but a real county response has not yet been verified: this build environment's outbound policy blocks the county and ArcGIS hosts. Verify a known parcel and address against SCOUT in the Vercel preview before merging. The county feed or catalog may change, reject queries, or be unavailable; the UI reports that state and links to SCOUT.

This is a parcel-data integration, not a full SCOUT scraper. The feed may omit property type descriptions, year built, beds, baths, square footage, photos, neighborhood/schools, and historical assessment, price, or tax records. Those sections show honest unavailable states and a county link rather than invented details. Annual taxes are not inferred from taxable value. No provider or legal claim is made that public records are guaranteed current or suitable for every use.

Zillow and Realtor.com are not connected. Obtain licensed provider access before adding their estimates/photos. **Explore a sample comparison** remains available separately and is explicitly fictional.

## Verification

- `npm run build`: passed.
- `npm test`: 13 passing adapter/API tests, covering normalization, query construction, destination validation, response mapping, private-field exclusion, missing/zero values, bounded/duplicate/no results, schema changes, upstream errors, and API input validation.
- Chromium UI checks with mocked API responses at desktop and 390px mobile widths: candidate confirmation, property display, missing provider/photo states, accordions, empty/error states, source text escaping, sample flow, privacy dialog, no horizontal overflow, no browser errors.
- Local API failure path verified against the currently blocked network: returns a controlled 503 instead of fabricated data.
- Live county data and deployed function verification: pending.
