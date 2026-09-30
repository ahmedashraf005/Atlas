# Fix B report

## Result
Done. Fix B and the four additional polish items are implemented on `fix-b`; no commit was made.

## Changes
- **B1:** Discover, company listings, My bids and the bid ladder keep their key information and actions visible at 1054 px; compact rows retain the hidden-column details.
- **B2:** Shared pluralisation, resettable Discover filters, view-only document labels, clearer holdings and price-input wording, rounded relative days, updated counter copy and consistent persona labels.
- **B3:** Consistent eligible-buyer text, round-implied Qamra estimate and no-trades copy, 0.5× exit slider, shared trade status labels, decided listing counts and audited withdrawal date.
- **B4:** Denied buyers see no request action; investor-type denials explain allowed types, while restricted-organisation denials remain generic. Policy-ineligible buyers do not see mandate matches.
- **B5:** Settled escrow shows its release and date; completed timeline steps no longer say they are waiting, and simulated funds confirmation identifies the escrow agent.
- **B6:** Audit actors, entity labels, chain status/count, filter labels and GST snapshot times are clarified.
- **B7:** The tour docks bottom-left, can minimise, and sends Buyer A back to bids when step 3 has no in-progress trade.
- **B8:** Price ticks, wrapping, active nav state, menu alignment, skip-link offset, toolbar focus, past-bid order and decline-all treatment are polished.
- **Additional:** Dynamic absolute titles for company, company document, listing, trade room and trade document pages; sandbox-aware 404 text; BUILD-LOG prompt/report links; live demo URL in README.

## Verification
| Command | Result |
| --- | --- |
| Baseline `pnpm check` then `pnpm test:e2e` | Both green before edits |
| `pnpm exec vitest run tests/integration/segment-3/discovery.test.ts` | 12 passed |
| Final `pnpm check` | Green: 52 test files, 2,611 tests, production build |
| Final `pnpm test:e2e` | Green: 68 browser tests |
| `git diff --check` | Green |

## Decisions and deviations
- At 1024–1279 px, company listings and My bids also collapse quantity/window details into the first cell so action buttons truly fit at 1054 px; all values remain visible.
- The repository currently lacks `prompts/segment-1.md`, `segment-2.md`, and `segment-5.md` through `segment-8.md`. Per Ahmed’s direction, BUILD-LOG links their expected paths anyway. The missing files were not created.
- The pre-existing untracked `prompts/fix-b.md` and `stash@{0}` were left untouched. Playwright’s generated appendix to `AGENTS.md` was removed after testing, restoring that file exactly to HEAD.

## Changed paths
- `README.md` — added the live-demo URL below the title.
- `docs/BUILD-LOG.md` — linked every segment and fix to its expected prompt and report paths.
- `prompts/reports/fix-b.md` — recorded results, deviations and every changed path.
- `src/app/(app)/bids/_components/my-bids.tsx` — kept laptop-width actions visible and made compact rows retain totals.
- `src/app/(app)/companies/[slug]/_components/band-chart.tsx` — used even, rounded price ticks and gave the newest trade right-side space.
- `src/app/(app)/companies/[slug]/_components/value-at-exit.tsx` — defaulted the slider to 0.5× and explained preferred-share priority.
- `src/app/(app)/companies/[slug]/documents/[documentId]/page.tsx` — set document metadata and removed the repeated document heading.
- `src/app/(app)/companies/[slug]/page.tsx` — fit listing actions at laptop width, clarified access, and set company metadata.
- `src/app/(app)/discover/page.tsx` — compacted laptop columns and remounted filters when Clear changes the URL.
- `src/app/(app)/layout.tsx` — passed trade availability to the tour panel.
- `src/app/(app)/listings/[id]/_components/bid-ladder.tsx` — kept buyer identities and actions visible in the laptop ladder.
- `src/app/(app)/listings/[id]/page.tsx` — set listing metadata and softened the decline-all button.
- `src/app/(app)/ops/audit/_components/audit-controls.tsx` — removed stale parallel verification status after refresh.
- `src/app/(app)/ops/audit/page.tsx` — showed the verified count in the header and capitalized filters.
- `src/app/(app)/trades/[id]/documents/[documentId]/page.tsx` — set document metadata and removed the repeated title.
- `src/app/(app)/trades/[id]/page.tsx` — set trade metadata and improved document-row wrapping.
- `src/app/not-found.tsx` — explained why sandbox-specific links do not transfer between visitors.
- `src/app/page.tsx` — used the shared persona labels on landing cards.
- `src/components/atlas/figure.tsx` — kept figure values on one line.
- `src/components/atlas/skip-link.tsx` — moved the focused skip link clear of the logo.
- `src/components/shell/demo-controls.tsx` — kept focus outlines visible and aligned the ROFR menu item.
- `src/components/shell/nav-link.tsx` — made the Operations root match only its own route.
- `src/components/shell/tour-panel.tsx` — docked the tour left, added minimise, and redirected step 3 when needed.
- `src/config/personas.ts` — unified persona labels between toolbar and landing.
- `src/domain/money.ts` — made invalid price input explain the accepted decimal format.
- `src/lib/audit-display.ts` — gave seed, reset and sandbox actions accurate actor and action labels.
- `src/lib/format.ts` — rounded multi-day relative times to the nearest day.
- `src/lib/plural.ts` — added a shared singular/plural formatter.
- `src/server/read/audit.ts` — resolved audit entities to refs or names and displayed snapshot times in GST.
- `src/server/read/bids.ts` — used shared count wording, counter copy and newest-first past bids.
- `src/server/read/company.ts` — clarified round-implied values, buyer policy access and listing/document labels.
- `src/server/read/consoles.ts` — used consistent buyer-type and count wording.
- `src/server/read/discover.ts` — used shared counts and policy-aware mandate matching.
- `src/server/read/holdings.ts` — renamed available shares to Not listed and adjusted count wording.
- `src/server/read/landing.ts` — used shared persona labels.
- `src/server/read/listing.ts` — corrected decided bid counts, trade badges and withdrawal time.
- `src/server/read/tour.ts` — checked whether Buyer A has an in-progress trade for tour step 3.
- `src/server/read/trades.ts` — kept completed timeline steps final and clarified escrow release attribution.
- `src/server/repositories/audit.ts` — added a sandbox-scoped read for a listing withdrawal audit time.
- `tests/e2e/a11y.spec.ts` — updated axe coverage for dynamic page headings.
- `tests/e2e/buyer-discovery.spec.ts` — updated discovery and company copy expectations.
- `tests/e2e/consoles.spec.ts` — updated console/audit copy expectations.
- `tests/e2e/demo-controls.spec.ts` — updated shared persona-label expectations.
- `tests/e2e/finish.spec.ts` — updated tour and document expectations.
- `tests/e2e/fix-a.spec.ts` — updated the Company console figure expectation.
- `tests/e2e/fix-b.spec.ts` — checked laptop table actions, filter reset, metadata and document copy.
- `tests/e2e/seller-listing.spec.ts` — updated holding, listing and parser wording expectations.
- `tests/e2e/trades.spec.ts` — updated trade document wording and title expectations.
- `tests/integration/segment-3/discovery.test.ts` — checked denial and no-trades language and mandate policy gating.
- `tests/integration/segment-4/holdings.test.ts` — updated the Not listed quantity expectation.
- `tests/integration/segment-6/trades.test.ts` — updated the released-escrow summary expectation.
- `tests/smoke/smoke.spec.ts` — updated the company-page title expectation.
- `tests/unit/audit-display.test.ts` — covered sandbox actor labels and action names.
- `tests/unit/bid-validation.test.ts` — covered the decimal parse wording.
- `tests/unit/format.test.ts` — covered nearest-day relative time.
- `tests/unit/plural.test.ts` — covered singular, regular plural and irregular plural forms.

## For Ahmed
- Review the four tables at 1054 px and the audit/tour states in both themes. The expected BUILD-LOG links for the absent prompt files will resolve when those prompt files are added.
