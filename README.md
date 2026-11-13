# Home Values

A responsive Spokane home-value comparison interface built with plain HTML, CSS, and JavaScript. No runtime dependencies.

## Run

- `npm run dev` serves `public/` on port 3000 (requires Python 3).
- `npm run build` creates `dist/` (requires Node.js 18+).
- Vercel configuration is included in `vercel.json`.

## Current scope

This is an interface preview, not a live valuation service. Address submissions do not call a provider or produce invented results. Use **Explore a sample comparison** to view explicitly fictional estimates, sample property details, an illustrative value chart, price and tax histories, and a two-image carousel. The uploaded interior photo is used for the hero and labeled as a design reference in the sample carousel.

## Live data work remaining

Obtain licensed access for Zillow and Realtor.com estimates and listing photos, and confirm a supported Spokane County assessment data source. Add server-side address normalization and property matching, provider adapters with timeouts and partial-result handling, source timestamps, and provider attribution. Keep provider credentials server-side. Do not treat tax assessments as market estimates. Only display returned photos and values for a verified property match; show source-specific unavailable states otherwise.

The neighborhood and schools section intentionally has no fictional school assignments. Privacy and terms text describe the preview and must be updated for the eventual live services and operator contact.

## Verification

Built successfully and checked in Chromium at 1440px and 390px widths: address submission, loading and unavailable states, sample comparison, image navigation, all accordions, legal dialogs, and horizontal overflow. No browser runtime errors.
