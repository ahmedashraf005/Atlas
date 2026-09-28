# Segment 5 report

## Result

Done with documented deviations: bidding, counter responses, seller allocation and simulated counterparties work on `seg-5`; all checks pass and nothing was committed or pushed.

## Acceptance criteria

- [x] Buyers can submit, amend, withdraw, accept counters and decline counters — `tests/integration/segment-5/bidding.test.ts` and `tests/e2e/bidding.spec.ts`.
- [x] Sellers can review bids after close, send at most three counters, preview allocation, accept with a backup, or decline every bid — integration tests verify guard failures, rollback, trade quantities, share reservations and backup assignment.
- [x] Bids remain sealed — the Live seller model selects counts without bid rows; buyer composer and My bids use public listing projections and the buyer's own bids. Integration tests check serialized models for leakage and sandbox isolation.
- [x] Allocations are recomputed on the server — the strict allocation schema rejects extra quantities, duplicate selections, foreign bid IDs and invalid backups. Trades and audit entries are persisted in the action transaction.
- [x] Simulated sellers and buyers complete both golden paths without reloads — E2E verifies L-2019 counter acceptance becomes a trade, and the seller's L-2031 counter is accepted before allocation. Integration tests also cover decline, near-reserve counters, skipped jobs, duplicate prevention, paused auto-pilot and switching to a job's acting persona.
- [x] Competing bids work from the toolbar and Live listing page — the seeded seller receives buyer_e's deterministic bid; the response and seller's Live page disclose no bid price.
- [x] Company ordering is L-2019, L-2027, L-2031 for buyer_a — the segment 3 expectation and a new integration assertion verify involved listings first, then earliest close, then reference.
- [x] Mobile composer and ladder have no page overflow in either theme — E2E tests at 390 px verify scrolling stays inside the table card. Desktop scenarios run at 1440 px.
- [x] No browser console or page errors — every E2E scenario uses the existing error-checking fixture.
- [x] `pnpm check`, then `pnpm test:e2e`, pass sequentially — 2,464 unit/integration tests in 41 files, followed by 45 Chromium E2E scenarios.
- [x] Seed data, domain rules, schema, migrations, dependencies, design documents and AGENTS.md remain unchanged.

## Commands run

| Command | Result |
| --- | --- |
| `git switch -c seg-5` from clean `main` | Passed; working in `/Users/ahmedashraf/dev/atlas`, without a worktree |
| Baseline `pnpm check` | Passed: 2,419 tests and production build |
| Baseline `pnpm test:e2e`, after check completed | Passed: 42 scenarios |
| `pnpm typecheck` | Passed after correcting new types |
| `pnpm exec biome check --write <changed files>` | Applied formatting; final full lint passes with no errors or warnings |
| Targeted Vitest runs for bid display and segment 5 integration | Passed; final coverage run includes 23 new unit cases and 22 new integration cases |
| Final `pnpm check` | Passed: tokens, TypeScript, Biome, coverage, 2,464 tests and production build |
| Final `pnpm test:e2e`, after check completed | Passed: 45 scenarios in 33.3 seconds, default port 3100 |
| `git diff --check` | Passed |
| Protected-path diff inspection | No changes to AGENTS.md, docs, domain, seed, schema, migrations or dependency manifests |

The initial new E2E run passed 40 of 45 scenarios. The failures were test assumptions: fixed trade references despite background trades, unscoped locators matching hidden tables or Next's route announcer, and the foundation expectation that competing bids were disabled. Those assertions now target the intended behavior; no tests were skipped or weakened. A new visibility test also confirmed that removing buyer_b's grant does not remove participation supplied by the seeded bid/trade; a separate nonparticipant fixture verifies hidden prices.

### Coverage

Aggregated from the final `coverage/coverage-summary.json`:

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `src/domain/**` | 98.99% | 95.33% | 100.00% | 99.50% |
| `src/lib/**` | 100.00% | 98.85% | 100.00% | 100.00% |
| `src/server/**` | 82.80% | 76.25% | 81.02% | 87.39% |

Existing domain/lib coverage thresholds pass unchanged. Server coverage remains reporting-only. The shared bid badge mapping has 100% coverage for every metric.

## Decisions and deviations

- `prompts/segment-5.md` was absent from the checkout. The full Segment 5 specification supplied in Ahmed's message was used; no prompt file was created or modified.
- Branch creation was explicitly authorized by the task, overriding AGENTS.md's general prohibition. No commit or push was made.
- Shared creation and allocation services live in `src/server/bidding.ts` and `src/server/allocation.ts`. Human actions and the simulated seller call these same services; state changes use `runTransition`.
- `seller_decide` jobs use `entity: "listing"`, the listing ID, the actual seller ID and the non-null event marker `DECIDE`. This reuses the existing pending-job uniqueness constraint without a schema migration. Existing automation rows are unchanged.
- Competing bids execute immediately through the demo action rather than adding a job kind. Simulated users are resolved from the specified seeded handles because non-persona users do not have persona keys. Missing or pending eligible grants are approved by the simulated company admin and audited before bid creation; denied grants are respected.
- Idempotency keys accept bounded nonempty strings; the browser generates UUID v7 once per composer mount. Database insertion uses `ON CONFLICT DO NOTHING` and a sandbox-scoped lookup, avoiding a failed SQL statement inside a Postgres transaction.
- Framework-free display/maths helpers live in `src/lib/` so server code and client forms can share them. All money and quantity calculations remain bigint; browser props use formatted values and decimal strings. Skipped-fill explanations use the quantity remaining at that bid's rank.
- The backup picker uses labelled native grouped radio inputs, providing browser keyboard behavior without a dependency or additional UI primitive.
- New bid tables share the bid badge mapping. The company page retains its segment 3 contextual labels because this prompt restricts changes to that read model to the ordering fix.
- The existing foundation scenarios were updated only to remove the three segment 5 placeholders and expect the now-enabled competing-bid control. The segment 3 integration test changes only its listing order expectation.
- Trade references are sandbox-wide. With auto-pilot on, the +7-day jump can create a trade on L-2027 before the visitor accepts L-2031; the L-2031 E2E result was T-3002 and T-3003. Tests assert two created references rather than assuming they start at T-3001.
- No dependencies or migrations were needed.

### Registered job kinds

| Kind | Behavior |
| --- | --- |
| `transition` | Existing simulated counterparty transitions, including buyer counter acceptance |
| `access_decision` | Existing company access decisions |
| `seller_decide` | New simulated seller: allocate eligible bids with a backup, counter a near-reserve bid, or decline all |

## Ladder values after +7 days

Fresh sandbox, seller persona, L-2031, without first simulating another bid:

- Quantity: **12,000 sh**; minimum fill: **2,000 sh**; reserve: **AED 34.00**; bids: **2 to review**.
- Status: **Window closed · your move**; **3 of 3 counters left**.
- Decision deadline: T0 + 19 days, twelve days after a precisely timed +7-day jump. Real-time display can round the remaining duration down as time passes.

| Rank | Buyer | Certainty | Price | Band | Quantity / Min fill | Total | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Investor #B-204 | New on Atlas | AED 35.20 | Within band | 6,000 sh / 2,000 sh | AED 211,200 | Awaiting seller decision |
| 2 | Investor #B-352 | New on Atlas | AED 34.80 | Within band | 12,000 sh / 6,000 sh | AED 417,600 | Awaiting seller decision |

Both are above the reserve. Selecting both allocates **6,000 sh each**, with proceeds **AED 420,000**, average **AED 35.00**, and no remainder. After countering Investor #B-352 at **AED 35.00** and its simulated acceptance, selecting both shows proceeds **AED 421,200** and average **AED 35.10**.

Adding buyer_a's **AED 35.50 × 5,000** bid, then accepting buyer_a and buyer_c with buyer_d as backup, creates **5,000** and **6,000** share trades, releases **1,000 shares**, and attaches the backup to buyer_c's lower-priced trade. Proceeds are **AED 388,700**, average **AED 35.34**.

The competing-bid action on fresh L-2031 adds Investor #B-409 at **AED 36.87 × 12,000**, minimum fill **6,000 sh**. The price stays sealed until close.

## Skipped or deferred

- Trade list and trade rooms remain the existing `TODO(segment-6)` placeholders; “Open trade” points to the correct created trade ID.
- Company/operator consoles and later-segment pages retain their existing placeholders.
- No Segment 5 feature was deferred.

## Files created or changed

- `src/app/(app)/bids/page.tsx` — real My bids Server Component.
- `src/app/(app)/bids/_components/my-bids.tsx` — counter confirmation cards and Active/Past tables.
- `src/app/(app)/listings/[id]/bid/page.tsx` — public bid composer and blocking states.
- `src/app/(app)/listings/[id]/bid/_components/bid-form.tsx` — bid maths, review confirmation, amendment and withdrawal.
- `src/app/(app)/listings/[id]/page.tsx` — seller/operator listing view, redirects, sealed counts and created trades.
- `src/app/(app)/listings/[id]/_components/bid-ladder.tsx` — ranked ladder, counters, allocation preview, backup selection and confirmations.
- `src/app/(app)/listings/[id]/_components/competing-bid.tsx` — listing-level competing-bid control.
- `src/app/_actions/bids.ts` — thin async bid action delegates.
- `src/app/_actions/listings.ts` — thin async seller action delegates.
- `src/components/shell/demo-actions.ts` — thin delegate for competing bids.
- `src/components/shell/demo-controls.tsx` — enable competing bids in desktop/mobile menus and show the safe success toast.
- `src/lib/bid-badges.ts` — shared bid status/outcome display mapping.
- `src/lib/bid-maths.ts` — pure totals, comparisons, allocation preview, average rounding and deterministic competing price.
- `src/server/actions/bids.ts` — pipeline actions for submission, amendment, withdrawal and counter responses.
- `src/server/actions/listings.ts` — pipeline counter, allocation and decline-all actions.
- `src/server/actions/demo.ts` — competing-bid pipeline definition and wrapper.
- `src/server/allocation.ts` — shared owner checks, counter ordering, authoritative allocation and backup persistence.
- `src/server/bidding.ts` — shared parsing, eligibility, related-party checks, idempotent creation, audit and seller notification.
- `src/server/competing.ts` — deterministic listing/bidder selection and simulated grant/bid creation.
- `src/server/automation.ts` — add seller-decision scheduling rows while preserving existing scheduling behavior.
- `src/server/jobs/index.ts` — register the seller handler.
- `src/server/jobs/seller-decide.ts` — simulated seller decision strategy through shared services.
- `src/server/read/bids.ts` — public composer and buyer-owned My bids display models.
- `src/server/read/listing.ts` — authorized seller/operator display model with sealed Live reads.
- `src/server/read/company.ts` — listing order fix only.
- `src/server/repositories/bids.ts` — scoped listing/buyer reads and conflict-safe idempotent insertion.
- `src/server/repositories/listings.ts` — explicit public lookup and server-internal rows with references.
- `src/server/repositories/trades.ts` — scoped listing/buyer trade reads.
- `src/server/repositories/parties.ts` — beneficial-owner relationship, certainty-of-close record and buyer profile mapping.
- `tests/e2e/bidding.spec.ts` — six bidding/golden-path/mobile scenarios with browser error checks.
- `tests/e2e/foundation.spec.ts` — remove completed placeholders and verify competing bids are enabled.
- `tests/integration/segment-3/discovery.test.ts` — corrected company listing order.
- `tests/integration/segment-5/bidding.test.ts` — 22 backend, privacy, authorization, automation and rollback scenarios.
- `tests/unit/bid-display.test.ts` — 23 badge/maths/rounding/deterministic-price cases.
- `prompts/reports/segment-5.md` — this report.

## For Ahmed to check manually

- In both themes, open Falaj as Buyer A, use L-2031's Bid button, enter 35.50 and 5,000, review the AED 177,500 total, submit, amend, then withdraw.
- On My bids, accept the L-2019 counter and wait for the bid to move to Past with “Accepted · 3,000 sh” and “Open trade”. The destination remains a segment 6 placeholder.
- As Seller, open L-2031 from Holdings, confirm only counts are visible, advance +7 days and compare the ladder with the table above. Counter Investor #B-352 at 35.00, wait for acceptance, select both bids and review AED 421,200 before confirming.
- Reset before testing the toolbar's competing-bid control: the fresh listing should show three sealed bids without disclosing their prices.
- At 390 px, check composer inputs, confirmation dialogs, the ladder's internal horizontal scroll and the backup picker.
