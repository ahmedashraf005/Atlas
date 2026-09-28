# Segment 4 report

## Result

Done with the documented sequential-run scope extensions — Holdings, Add holding, Create listing, Your listings, Resubmit and Withdraw are implemented, and all final gates pass.

## Acceptance criteria

- [x] Seller pages and actions work with seeded data — 14 PGlite integration tests in `tests/integration/segment-4/holdings.test.ts` and six seller E2E scenarios cover the requested flows and edge states. Screenshots reviewed in light and dark themes at 1440px and 390px.
- [x] Policy, parsing and committed quantity use the existing domain engine — Falaj's reserved shares count toward the yearly cap; Wadi quantity/minimum-fill failures and Qamra's lock-up/blackout failures are tested. Server and client use the domain money/share parsers; money arithmetic remains `bigint`.
- [x] Auto-pilot verification and listing approval appear without manual reload — E2E tests observe pending holdings becoming verified and listings becoming live through the existing shell polling. Integration tests verify the concrete company admin and second operator approver, simulated audit actor, reservation and exact deadline.
- [x] Sequential checks pass — final `pnpm check` passes 2,419 tests across 39 files; both final E2E runs pass all 42 scenarios, on ports 3100 and 3200.
- [x] File ownership follows the user overrides — additional repository and test infrastructure paths are listed individually below with reasons. Seed, domain rules, shell/demo controls, company/discover routes, automation and refresh remain unchanged. No schema or migration changes and no new dependencies.
- [x] Double-submit and shared visibility decisions are documented below. No application changes were committed or pushed; work remains on `seg-4`.

## Commands run

| Command | Result |
| --- | --- |
| `git switch -c seg-4` | Created from clean `main`, whose head was `205a65c Segment 3: buyer discovery` |
| Baseline `pnpm check` | Passed: 2,387 tests, existing coverage thresholds and production build |
| Baseline `pnpm test:e2e` | Passed: 38 scenarios; started after baseline check finished |
| `pnpm exec biome check --write …` | Formatted only the implementation/test files touched by this segment |
| Development `pnpm typecheck` and `pnpm lint` | Missing verification-component import and an incorrect test repository method were corrected; subsequent checks passed with no warnings |
| `pnpm exec vitest run tests/integration/segment-4 tests/unit/seller-listing.test.ts` | Passed: 14 integration and 18 unit tests. An earlier test-fixture run was interrupted because it queried the database outside the active transaction; the persona ID is now loaded before that transaction |
| Intermediate `pnpm test:e2e` | First configurable-port run passed 38 existing scenarios. First feature run passed 40 and failed two test locators; the alert locator was narrowed and the own-holding ID is read from its rendered card |
| Final `pnpm check` | Passed: tokens, TypeScript, Biome (218 files, no errors/warnings), 2,419 tests with coverage, and Next production build |
| Final `pnpm test:e2e` | Passed: 42 scenarios on default port 3100 |
| Final `E2E_PORT=3200 pnpm test:e2e` | Passed: 42 scenarios on port 3200 |
| `pnpm db:generate` | No schema changes; nothing to migrate |
| `git diff --exit-code drizzle/` | Passed: no migration drift |
| `git diff --check` | Passed |
| Protected-path diff check | Passed: no changes to AGENTS, docs, domain, seed, shell/demo controls or company/discover routes |
| Production browser review on port 3102 | Light/dark screenshots for holdings, listing details/review and Add holding at both widths; no browser errors and no page overflow. Review server stopped afterward |

All `pnpm check`, build and E2E commands were run sequentially. The final gates were rerun after adding malformed-ID validation to the listing-page loader.

### Coverage

| Scope | Lines | Branches | Functions | Statements |
| --- | --- | --- | --- | --- |
| Domain and lib | 99.53% | 95.61% | 100% | 98.92% |
| `src/server/**` | 85.20% | 79.36% | 78.47% | 81.74% |

The existing domain/lib thresholds are unchanged. Server coverage remains reporting only.

## Decisions and deviations

- The sequential-run overrides take precedence over the prompt's worktree and parallel-branch instructions. All work used `~/dev/atlas` on `seg-4`, created from main after Segment 3 was merged.
- **Shared price visibility:** no local permission helper was added. `holdingFacts` calls `can(actor, "company.viewTradePrices", resource)` and uses `discovery.participates` plus the approved-grant lookup. A shareholder participates in Falaj, so the seller sees its trade band; Wadi's member visibility allows prices; operator-only visibility suppresses prints and uses the public waterfall estimate. Unit and integration tests exercise this shared rule. There is no visibility helper to reconcile at merge time.
- **Double-submit protection:** a `listing.create` audit entry records `after.clientRequestId` alongside the draft snapshot and reference. The repository looks for that request ID within the last ten minutes of sandbox time, scoped by sandbox, actor and action. The already locked sandbox serializes concurrent requests. A matching request returns the previous owned listing without another reservation, job or creation audit entry. Concurrent-call integration coverage confirms one listing and one reservation. No schema change was needed.
- Listing creation records its explicit creation audit entry and the transition engine's `SUBMIT` audit entry in the same transaction. The action performs policy preflight to return specific `POLICY_BLOCKED` failures, then `runTransition` independently recomputes policy facts before reserving shares. It does not accept a caller-supplied actor or policy result. The pipeline rolls back errors; blocked attempts leave no draft or reference increment.
- Action facades follow Segment 3's thin async delegate pattern, rather than bare exports in a `"use server"` module.
- Acquisition dates are interpreted as midnight in Asia/Dubai. The date input's maximum uses sandbox today in that timezone. Malformed route IDs are validated before a UUID database query and return not found.
- Live totals stay exact even for the parser's largest valid inputs. If the dimensionless `diffBps` result exceeds its safe numeric range, the comparison displays `—` while the money total remains exact.
- The existing relative formatter floors day counts. A newly approved five-day window can therefore show `in 4 days` after a moment has elapsed; its persisted deadline is exactly approval time plus five days. Tests retain that formatter behavior and verify the exact deadline separately.

### Files outside the original ownership list

- `src/server/repositories/holdings.ts` — added a sandbox-and-owner-scoped holdings read; avoids loading another user's holdings in the read model. Authorized by the repository override.
- `src/server/repositories/listings.ts` — added a sandbox-and-seller-scoped owner projection including references and the seller's own reserve. Authorized by the repository override.
- `src/server/repositories/bids.ts` — added an aggregate count query for one sandbox-scoped listing, so the seller's Live listing read never fetches sealed bid prices. Authorized by the repository override.
- `src/server/repositories/audit.ts` — added the sandbox/actor/request-ID lookup required for audit-backed idempotency. No audit update/delete function was added. Authorized by the repository override.
- `tests/e2e/global-setup.ts` — unavoidable companion to task 4.0: deletes the new port-specific PGlite directory, rather than the old shared directory. The separate existing showcase-gate cleanup remains.
- `tests/e2e/fixtures.ts` — unavoidable companion to task 4.0: makes the existing, narrowly scoped expected `/nope` HTTP-404 diagnostic use the configured port. Console/page errors are still collected and asserted; the exception was not broadened.

`playwright.config.ts` retains Segment 3's static `/icon.svg` readiness URL. Base URL, readiness URL, start argument and the main E2E database directory use the configured port. No TypeScript schema change or SQL migration was necessary.

## Seeded values for comparison

At fresh sandbox time, the seller's cards appear in this order:

| Company | Total / reserved / sold / available | Eligibility | Reference | Demand |
| --- | --- | --- | --- | --- |
| Falaj Robotics | 30,000 / 12,000 / 0 / 18,000 sh | You can sell up to 3,000 shares now. | Fair value AED 34.20–36.10 · Last trade AED 35.80 | 4 buyers |
| Wadi Ledger | 10,000 / 0 / 0 / 10,000 sh | You can sell up to 10,000 shares now. | Fair value USD 2.95–3.30 · Last trade USD 3.30 | 2 buyers |
| Qamra Health | 4,000 / 0 / 0 / 4,000 sh | You can't list these shares yet. | Estimate AED 18.50 from the last round | 1 buyer |

Falaj's terms show `15,000 shares (50%)`, `12,000 shares` already committed, `1,000 shares` minimum lot and `30 days` ROFR. Wadi shows `10,000 shares (100%)`, `0 shares` committed, `2,000 shares` minimum lot and `30 days` ROFR.

With the fixed test seed time of 28 Sep 2026, Qamra has exactly these failures: `Lock-up ends 30 Dec 2026.` and `Sales are paused until 8 Oct 2026 (Series B fundraising).` Its earliest listing date is 30 Dec 2026. Live sandbox dates move with its seeding time.

Your listings initially contains L-2031: Falaj Ordinary, `12,000 sh`, minimum `2,000 sh`, reserve `AED 34.00`, `2 sealed`, Live and Withdraw.

The Wadi listing form defaults to `10000` quantity, `2000` minimum fill and five days. Reserve `3.00` produces `USD 30,000`; quantity `5000` produces `USD 15,000`, with `Within the fair-value band`. Submission returns `L-3001`; 5,000 shares become reserved, then the simulated second operator approves it.

## Skipped or deferred

- No required Segment 4 flow is deferred.
- Listing detail and sealed-bid review remain Segment 5 work, with the existing `TODO(segment-5)` in `src/app/(app)/listings/[id]/page.tsx`. The requested listing/review links point to that existing route.
- No new companies, people or dependencies were introduced; all displayed identities come from the unchanged fictional seed.

## Files created or changed

- `playwright.config.ts` — configurable E2E port, static readiness and port-specific main database.
- `src/app/(app)/holdings/page.tsx` — live holdings cards, empty state and seller listings table.
- `src/app/(app)/holdings/_components/holding-card.tsx` — verification, quantities, market context and listing link.
- `src/app/(app)/holdings/_components/eligibility-panel.tsx` — policy reasons, limits, pending and rejected states.
- `src/app/(app)/holdings/_components/add-holding-dialog.tsx` — company/class selection, evidence/date fields and action errors.
- `src/app/(app)/holdings/_components/resubmit-holding.tsx` — pipeline-backed resubmission and feedback.
- `src/app/(app)/holdings/_components/withdraw-listing.tsx` — danger confirmation, withdrawal and domain-error toast.
- `src/app/(app)/holdings/[id]/list/page.tsx` — owned holding loader, blocked state and listing/market layout.
- `src/app/(app)/holdings/[id]/list/_components/create-listing-form.tsx` — details/review steps, ownership confirmation and submission.
- `src/app/(app)/holdings/[id]/list/_components/listing-preview.ts` — pure integer total/comparison and fast field validation.
- `src/app/_actions/holdings.ts` — thin async server-action facades.
- `src/server/actions/holdings.ts` — create/resubmit holding and create/withdraw listing action definitions.
- `src/server/read/holdings.ts` — formatted own-holdings/listings models, policy facts, shared visibility and ordering/badges.
- `src/server/read/create-listing.ts` — owned listing form model with validated route ID and decimal strings for arithmetic.
- `src/server/repositories/holdings.ts` — own holdings query.
- `src/server/repositories/listings.ts` — owned listings query.
- `src/server/repositories/bids.ts` — count-only listing bid query.
- `src/server/repositories/audit.ts` — recent creation request lookup.
- `tests/integration/segment-4/holdings.test.ts` — 14 PGlite seller, policy, isolation, automation, audit and duplicate-request tests.
- `tests/unit/seller-listing.test.ts` — 18 preview, bounds, ordering, status, visibility and date tests.
- `tests/e2e/seller-listing.spec.ts` — six seller scenarios covering the requested flows and responsive/theme behavior.
- `tests/e2e/foundation.spec.ts` — only removed the two holdings placeholder entries.
- `tests/e2e/global-setup.ts` — port-specific database reset.
- `tests/e2e/fixtures.ts` — port-aware expected 404 diagnostic.
- `prompts/reports/segment-4.md` — this report.

## For Ahmed to check manually

- In both themes at 1440px and 390px, choose Seller and inspect `/holdings`: card ordering, Falaj's remaining cap, Qamra's two reasons, demand and the owner-only reserve/count columns. The wide listing table scrolls inside its card.
- Add a Wadi Ordinary holding with a past acquisition date; watch pending verification become Verified without reloading. Try an invalid quantity or a future date to inspect field feedback.
- List Wadi shares: enter reserve 3.00, change quantity from 10,000 to 5,000, inspect the live total, move forward/back and confirm values remain. Check the ownership checkbox and watch Atlas review become Live.
- Withdraw the new listing, cancel once before confirming, then check its status and restored available quantity. Withdraw L-2031 to inspect bid rejection and the released 12,000 shares.
- Visit Qamra's owned create-listing route and a malformed/unknown holding route; check policy reasons and the not-found result respectively.
- Review the repository/test infrastructure extensions above. No commit or push was made.
