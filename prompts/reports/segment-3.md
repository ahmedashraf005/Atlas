# Segment 3 report

## Result
Done with documented deviations — buyer discovery, policy-based access, Q&A and watermarked documents are implemented; final checks and browser tests pass.

## Acceptance criteria
- [x] Landing, Discover, Company page, NDA request, Q&A and document viewer use live sandbox data. Reviewed the company page in light/dark at 1440px and 390px; landing, discovery and financials viewer were also inspected. Mobile tables scroll inside their cards without horizontal page overflow.
- [x] Buyer privacy — public listing projections exclude the reserve, bid queries select only the viewer's bids, read-model tests check private fields and prices, and the trade-price authorization matrix covers every visibility mode. Documents require server-side authorization and return no model for unauthorized viewers.
- [x] Access auto-pilot — integration and E2E tests verify buyer B is denied Wadi access and approved Qamra access. Both decisions appear through the existing polling without manual reload. Audit entries identify a simulated company administrator; stale decisions are skipped with `ALREADY_DECIDED`.
- [x] Final `pnpm check` then `pnpm test:e2e` pass sequentially: 2,387 unit/integration tests across 37 files, zero Biome warnings/errors, production build, and 38 E2E scenarios. The browser fixture collected no console or page errors in the passing run.
- [x] File ownership — original scope plus Ahmed's explicit override was followed. Every changed path and unavoidable extra change is listed below. Seed, shell/demo controls, existing domain rules, holdings/listing routes, design files and AGENTS.md remain untouched.
- [x] This report records exact buyer A values and the specification conflicts resolved below.

## Commands run
| Command | Result |
| --- | --- |
| Baseline `pnpm check` | Passed: 2,324 tests and production build |
| Baseline `pnpm test:e2e` | Passed: 33 scenarios; started after baseline check finished |
| `pnpm add recharts@3.10.1` | Added the only permitted new dependency, pinned exactly |
| Targeted Vitest runs | Passed: 12 Segment 3 integration tests and 31 trade-price matrix tests |
| `pnpm db:generate` | No schema changes; nothing to migrate |
| `git diff --exit-code drizzle/` | Passed; existing migrations unchanged |
| Final `pnpm check` | Passed: tokens, typecheck, Biome (204 files), coverage thresholds, 2,387 tests and production build |
| Final `pnpm test:e2e` | Passed: 38 scenarios in 24.3 seconds |
| Production Playwright visual review on port 3102 | Light/dark desktop/mobile screenshots inspected; collected errors `[]`, mobile overflow `false`. Temporary server stopped afterward |
| `git diff --check` | Passed |

No check, build or E2E build commands ran concurrently. Intermediate failures in action facade compilation, tooltip setup and E2E readiness were fixed; no failing tests were deleted or weakened. In the foundation test file, only the two permitted placeholder entries were removed.

Final logs: `/tmp/atlas-seg3-check.log`, `/tmp/atlas-seg3-e2e.log`. Review screenshots are under `/tmp/atlas-seg3-*` and are not repository artifacts.

### Coverage
| Scope | Lines | Branches | Functions | Statements |
| --- | --- | --- | --- | --- |
| Domain/lib | 99.53% | 95.61% | 100% | 98.92% |
| Server | 82.96% | 77.97% | 75.79% | 79.66% |

Existing thresholds remain unchanged; server coverage remains reporting-only. E2E coverage is additional to these Vitest figures.

## Buyer A values for comparison
A fresh sandbox seeded on 28 Sep 2026 shows the following Falaj Robotics values. Dates move with the seeding date; countdowns naturally tick down after insertion.

| Field | Value |
| --- | --- |
| Metadata | Warehouse automation · Series B · Incorporated in ADGM |
| Verification | Company onboarded and verified |
| Open listings | 2 open listings |
| Matching mandate | Late-stage UAE tech |
| Last round price | AED 42.00 |
| Round caption | Series B preferred · Mar 2026 |
| Fair-value band | AED 34.20–36.10 |
| Band caption | From 6 trades in the last 180 days |
| Last Atlas trade | AED 35.80 |
| Trade caption | 4,000 ordinary shares · 15 Sep 2026 |
| ROFR | 30 days |
| Minimum lot | 1,000 sh |
| Buyer joinder | Required |
| Eligible buyers | All professional investors |
| Chart | Six ordinary-share prints; related-party print excluded; preferred round line AED 42.00 |
| Default exit valuation | AED 462M |
| Default Series B / Series A / Ordinary payout per share | AED 42.00 / AED 42.00 / AED 42.00 |
| Minimum exit valuation | AED 115.5M |
| Minimum Series B / Series A / Ordinary payout per share | AED 42.00 / AED 10.50 / AED 0.00 |
| Q&A | Two answered questions; other buyers' unanswered question absent |
| Info pack | Access approved; NDA accepted 25 Sep 2026; three documents |

Listing rows appear in this order:

| Listing | Quantity | Min fill | Seller | Buyer A status/action |
| --- | --- | --- | --- | --- |
| L-2019 | 3,000 sh | 1,000 sh | Holder #S-102 | Your bid · AED 34.00; Countered at AED 35.50; Respond; highlighted |
| L-2031 | 12,000 sh | 2,000 sh | Holder #S-214 | Live; Bid |
| L-2027 | 5,500 sh | All or none | Holder #S-198 | Live, Closing soon; Bid |

At the fixed integration clock, the counter shows `41h left`. During visual review it showed `40h left`, since real time had elapsed. L-2019 closed 26 Sep 2026; L-2031 closes 3 Oct 2026; L-2027 closes 29 Sep 2026. L-2008 is absent.

Discover shows three companies: Falaj `AED 34.20–36.10` with two open listings and Matches; Qamra `AED 18.50 est.`; Wadi `USD 2.95–3.30`. Both “Open listings only” and buyer A's “Matches my mandates” filters leave Falaj. Mandate ticket is `AED 250,000 – AED 2,000,000`.

## Decisions and deviations
- Work remains sequential in the current checkout on `seg-3`, as instructed. The prerequisite prompt commit `51b3177` was made on main only under Ahmed's earlier explicit authorization. No Segment 3 application changes were committed or pushed.
- The approved HTML mockup contains an older fair-value band. The live page uses the prompt's/domain-computed `AED 34.20–36.10`, retaining the reference's layout and tokens.
- The prose asks for all viewer-involved listings and ascending close time, while its exact fixture expects L-2008 absent and L-2019, L-2031, L-2027. The implementation follows that explicit fixture: active viewer bids bring rows into discovery; historical accepted bids do not, and the remaining rows use descending close time. History remains in the later bids/trades segments.
- The visibility test asks to hide buyer B's Falaj prices after deleting their grant, but the participant definition also includes bids and trades; buyer B already has both. The implementation follows the stated authorization rule. Tests verify that deleting the grant alone retains participant visibility, and that a genuinely uninvolved buyer gets “Not disclosed”, no chart points and no band coordinates. Company administrators and operators remain privileged; Wadi's members mode needs no grant.
- Public waterfall estimates remain available from public round information even when trade prices are restricted. Monetary calculations use bigint; chart coordinates and dimensionless bar ratios are the numeric client boundary. The 1× waterfall step is taken directly from post-money; endpoint anchors also use integer arithmetic.
- The existing “Enter the demo” link remains on the landing page so the foundation entry scenario keeps working without changing that test outside its permitted deletions. All five persona cards also use the existing switch action.
- Installed Next/Turbopack rejects bare action re-exports in a `"use server"` file with “Only async functions are allowed to be exported”. `src/app/_actions/company.ts` therefore exports thin async delegates to `defineAction` actions; it contains no business logic.
- `src/server/repositories/grants.ts` adds sandbox-scoped lookup, locked load and optimistic decision persistence. Existing insertion is reused for pending creation; the sandbox transaction lock serializes idempotent requests.
- `src/server/automation.ts` adds a custom skipped-result type and internal rollback signal. `src/server/refresh.ts` consumes that result within the existing savepoint, restores its checkpoint after rollback and records the skip code. The scheduling table, persona rule and existing transition behavior are unchanged.
- **Unavoidable extra: `src/server/db/schema.ts`** changes only the TypeScript type of the existing text `automation_jobs.entity` column to accept `company`. Access jobs use entity `company`, company ID as `entity_id`, buyer ID in the existing `event` text column, and the administrator as acting party. PostgreSQL already supports this representation, so no SQL migration is necessary; generation and drift checks pass.
- **Unavoidable extra: `src/server/repositories/discovery.ts`** provides public listing reads, buyer-scoped bid reads and participation queries. The existing repository APIs lacked these privacy-safe aggregate reads; keeping them in a repository preserves AGENTS.md's read boundary.
- **Unavoidable extra: `playwright.config.ts`** changes only the readiness URL from `/` to `/icon.svg`. Playwright starts its server before global setup; the new dynamic landing page would initialize PGlite before setup deletes the E2E directory. A static readiness URL prevents opening a database that setup then removes. Database configuration and test setup behavior are otherwise unchanged.
- `package.json` and `pnpm-lock.yaml` change only to add the authorized exact Recharts dependency. Recharts composition and reference APIs were checked against the [official documentation](https://recharts.github.io/api/ComposedChart/) and installed types.
- `ALREADY_DECIDED` belongs to custom job outcomes rather than user-facing action errors; `src/server/errors.ts` was not changed. Runtime registered kinds are now `transition` and `access_decision`.

## Skipped or deferred
- Guided tour remains visibly disabled with `TODO(segment-8)` in `src/app/page.tsx` and its availability tooltip.
- Bid/respond destinations remain the existing later-segment routes; no segment 5 implementation was added.
- No required backend/UI work remains deferred. The specification conflicts above are explicit deviations, not silently bypassed tests.

## Files created or changed
- `package.json` — exact Recharts runtime dependency.
- `pnpm-lock.yaml` — dependency resolution.
- `playwright.config.ts` — static readiness URL.
- `src/app/page.tsx` — live landing and persona picker.
- `src/app/(app)/discover/page.tsx` — GET filters, company directory and mandates.
- `src/app/(app)/companies/[id]/page.tsx` — obsolete placeholder removed for the slug route.
- `src/app/(app)/companies/[slug]/page.tsx` — live company page.
- `src/app/(app)/companies/[slug]/_components/band-chart.tsx` — accessible Recharts history, tooltip, legend and hidden table.
- `src/app/(app)/companies/[slug]/_components/value-at-exit.tsx` — precomputed waterfall slider.
- `src/app/(app)/companies/[slug]/_components/request-access-dialog.tsx` — NDA acceptance and pending/error states.
- `src/app/(app)/companies/[slug]/_components/ask-question.tsx` — validated question action form and feedback.
- `src/app/(app)/companies/[slug]/documents/[documentId]/page.tsx` — authorized document rendering and watermark.
- `src/app/_actions/company.ts` — thin Next action boundary.
- `src/config/demo-documents.ts` — fictional financials and document specifications.
- `src/domain/authz.ts` — requested trade-price permission only.
- `src/server/actions/company.ts` — pipeline-backed access and question actions, audit and notifications.
- `src/server/read/landing.ts` — persona card model.
- `src/server/read/discover.ts` — filter validation and display-ready directory/mandate model.
- `src/server/read/company.ts` — visibility-aware company, waterfall and document models.
- `src/server/jobs/access-decision.ts` — simulated administrator policy decision.
- `src/server/jobs/index.ts` — registration imports.
- `src/server/repositories/grants.ts` — grant lookup/locking/decision persistence.
- `src/server/repositories/discovery.ts` — sandbox-scoped public and viewer-specific reads.
- `src/server/automation.ts` — typed custom skip outcome.
- `src/server/refresh.ts` — handler registration and skip/savepoint handling.
- `src/server/db/schema.ts` — TypeScript entity type extension only; SQL unchanged.
- `tests/unit/domain/authz.test.ts` — existing exhaustive matrix includes the new action.
- `tests/unit/company-prices.test.ts` — three modes × five roles × participant flags, plus unrelated administrator test.
- `tests/integration/segment-3/discovery.test.ts` — 12 database scenarios covering values, leakage, visibility, filters, waterfall, access, questions, documents, skipped jobs and serialization.
- `tests/e2e/buyer-discovery.spec.ts` — seven browser scenarios, including automatic decisions, redaction, slider change, themes and mobile layout.
- `tests/e2e/foundation.spec.ts` — only the Discover and company placeholder entries deleted.
- `prompts/reports/segment-3.md` — this report, replacing the blocked report.

The pre-existing change to `prompts/reports/repo-move.md` was not edited. No seed, shell/demo control, design or AGENTS.md changes were made.

## For Ahmed to check manually
- Open `/`, choose each persona and confirm its home route. Hover the disabled guided-tour control for the availability explanation.
- On `/discover`, test sector/stage, open-only and mandate filters. Scroll the company table within its card to inspect all columns at narrow widths.
- Compare `/companies/falaj-robotics` as buyer A with the values above, in both themes. Move the exit slider; verify the preferred classes retain priority at low valuations.
- Open all three Falaj documents: inspect financials, generated class percentages/preferences and transfer policy summary, including the identity/time watermark.
- Switch to buyer B and request Wadi and Qamra access; leave the page open to see automatic denial/approval. Submit a Qamra question with contact details and confirm redaction.
- Review the documented ordering/participation conflicts and the minimal extra paths before committing. All Segment 3 changes remain uncommitted on `seg-3`.
