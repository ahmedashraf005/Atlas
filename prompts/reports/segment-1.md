# Segment 1 report

## Result

Done with documented API and verification-environment deviations; the domain core, coverage gate and unchanged foundation E2E suite pass.

## Acceptance criteria

- [x] All requested domain modules exist, without an `index.ts` barrel. Changes are confined to domain code, domain tests, guards, coverage configuration, package metadata/lockfile and this report. No UI, database or server implementation was added.
- [x] Four transition tables implemented and tested: exhaustive state/event matrices, allowed and forbidden roles, successful applies/effect arrays, guard failures, version increments, immutable fixtures and structural reachability checks. See `holding.test.ts`, `listing.test.ts`, `bid.test.ts`, `trade.test.ts`, `machine.test.ts` and `scenarios.test.ts`.
- [x] Required worked examples pass: money parsing/rounding, the six-trade weighted band, all three waterfall exits, allocation, redaction, deadline fast-forward and deterministic Mermaid output.
- [x] `pnpm test:coverage` and `pnpm check` pass: 2,191 tests across 30 files; global coverage is 99.52% lines, 95.56% branches, 100% functions and 98.91% statements. Biome reports zero errors and zero warnings.
- [x] All guard tests and self-tests pass, including the three added domain rules. Domain imports are limited to domain modules, framework-free lib modules and `node:crypto` in `audit.ts`.
- [x] Unchanged Segment 0 E2E passes: all 26 Chromium tests, including the browser console/page-error fixture, production showcase gate, themes, routes, security headers, keyboard access and mobile navigation.
- [x] This report records error codes, notification templates, ambiguity resolutions and coverage per file.

## Commands run

| Command | Result |
| --- | --- |
| `node --version` / `pnpm --version` | Node 24.16.0 / pnpm 11.15.1 |
| Baseline `pnpm check` in Desktop workspace | Failed on filesystem/worker import timeouts before any source changes; not a business-rule regression |
| `pnpm install --frozen-lockfile && pnpm check` on the exact published Segment 0 commit in a local temporary directory | Passed: 157 baseline tests and production build |
| `pnpm add -D -E fast-check @vitest/coverage-v8@4.0.18` | Installed only permitted dev dependencies: fast-check 4.10.2 and coverage-v8 4.0.18 |
| `pnpm typecheck` | Passed after correcting a test's discriminated-union narrowing |
| `pnpm exec biome check --write src/domain tests/unit/domain tests/unit/guards.test.ts vitest.config.ts package.json` | Passed; formatted files and fixed the reported unused-variable/non-null-assertion warnings without relaxing rules |
| `pnpm test` | Initial property test incorrectly returned a Vitest assertion result; corrected its callback to return normally |
| `pnpm test:coverage` | Passed with all thresholds; every property test uses at least 200 runs and retains fast-check seed reporting |
| Final `pnpm check` | Passed: token comparison, TypeScript, Biome, 2,191 tests with coverage and Next.js production build |
| Final `PLAYWRIGHT_BROWSERS_PATH=/tmp/atlas-playwright-browsers pnpm test:e2e` | Passed: 26/26 Chromium tests against a fresh production build |
| Final `pnpm install --frozen-lockfile` in the local mirror | Passed; lockfile reproducible and up to date |
| Byte-for-byte source comparison | All 46 domain/test files plus package.json, pnpm-lock.yaml, vitest.config.ts and guards match the verified local mirror |

Successful checks were run in `/tmp/atlas-segment1.mVkuZL`. Desktop/iCloud files, including Git metadata, repeatedly became `hidden,compressed,dataless`, causing reads to stall. The baseline mirror was obtained from the exact already-published commit `59f20654db542f808fc2ebc129756d614b73151d`; it passed before implementation began. Source changes were made in the actual workspace, tested in the mirror and mechanically formatted files copied back. No tests or timeouts were weakened. A subsequent Desktop dependency installation/check stalled again; those task-owned processes were stopped. The mirror remains available for inspection. The default browser cache was not altered.

## Decisions and deviations

- The prompt's baseline stop rule was applied to a verified local snapshot of the same commit after the Desktop run proved unreliable due to cloud-offloaded files. This workaround was communicated during implementation. Direct Desktop command completion is not claimed.
- `pnpm-lock.yaml` necessarily changes alongside the expressly permitted dependency additions, despite its omission from the acceptance criterion's file whitelist. No other dependency was added or upgraded. `coverage/` was already ignored, so `.gitignore` is unchanged.
- Trade release guards/applies require the acting operator's user ID, but the supplied `TradeCtx` omitted the actor. The engine injects the actual `actor` into its internal context, overriding any caller-supplied actor; `TradeCtx.actor` is optional for callers. Tests verify that forged context actors cannot bypass the four-eyes rule. Public transition signatures are unchanged.
- An unanchored hash chain cannot detect deletion of its final entry: the remaining prefix is a valid shorter chain. `verifyChain(entries)` retains the specified API and behavior; an optional second argument `{ count, headHash }`, obtained from trusted storage, additionally detects tail truncation. Property tests delete every possible position with this checkpoint, and test ordinary interior deletion/swapping without it. Segment 2 must store a trusted checkpoint if completeness, not just prefix integrity, is required.
- `createTradesFromAllocation` assigns the backup only to the lowest-priced allocation. At equal prices it chooses the last bid in deterministic price/time/id ranking. Prices always come from the authoritative bids, not the allocation's supplied price field.
- Creation authorization is checked against the existing resource: `holding.create` uses a sandbox; `listing.create` accepts the seller's holding or listing; `bid.create` uses its listing. Policy actions use the company resource, and audit/sandbox actions use the sandbox resource. Wrong resource kinds are denied.
- Seller/buyer trade permissions require both the appropriate role and the relationship. System actors receive only the table's explicit system events; even public view actions are denied to system actors.
- Quantity-changing helpers reject non-positive quantities, including release and sale, before checking availability. Invalid dates and impossible allocation/pricing inputs are rejected rather than silently coerced.
- Canonical JSON uses recursive code-point key order, including integer-like keys; unsupported values, sparse/undefined array elements, accessors, symbol keys, non-plain objects and cycles are rejected. Undefined object properties are omitted. Shared acyclic references are permitted.
- Blackout windows are start-inclusive/end-exclusive; all active windows are reported. The latest lock-up/blackout end determines `nextEligibleAt`. First-three eligibility failures force sellable quantity to zero, as specified.
- The fair-value trade window includes both endpoints and excludes future trades. Waterfall rounding residue goes to the final ordinary class; an all-preferred valid class set conserves proceeds too.
- Phone candidates outside 9–15 digits remain untouched; overlapping email/URL matches are resolved without double-redaction. URL punctuation is preserved. Redaction kinds are returned once, in first-occurrence order.
- Coverage thresholds apply globally to the specified domain/lib include set, as configured by Vitest. Individual module coverage is disclosed below; no coverage exclusions or ignored branches were added.
- No commits, pushes, branches or PRs were created for Segment 1.

### DomainErrorCode contract

`INVALID_TRANSITION`, `FORBIDDEN_ROLE`, `GUARD_FAILED`, `VALIDATION`, `INSUFFICIENT_SHARES`, `POLICY_BLOCKED`, `SELF_DEALING`, `DUPLICATE_BID`, `BID_WINDOW_CLOSED`, `FORBIDDEN`.

Only `VALIDATION` constructors include field `issues`; only `POLICY_BLOCKED` includes policy `failures`.

### Notification templates for Segment 2

| Entity | Templates |
| --- | --- |
| Holding | `holding_verification_requested`, `holding_verified`, `holding_rejected` |
| Listing | `listing_review_requested`, `listing_live`, `listing_rejected`, `window_closed`, `listing_expired` |
| Bid | `countered`, `counter_accepted`, `counter_declined`, `counter_lapsed`, `bid_accepted`, `bid_backup`, `bid_rejected` |
| Trade | `counterparty_signed`, `rofr_notice`, `funds_due`, `rofr_waived`, `rofr_exercised`, `trade_cancelled`, `wire_sent`, `register_update_due`, `funds_confirmed`, `release_due`, `settled`, `dispute_raised`, `dispute_resolved` |

### Coverage per file

Percentages from the final V8 JSON summary. `types.ts` contains only erased types and therefore has no executable statements (the text reporter renders zero counters; the JSON summary treats its empty coverage set as 100%).

| File | Lines | Branches | Functions | Statements |
| --- | ---: | ---: | ---: | ---: |
| src/domain/allocation.ts | 100 | 100 | 100 | 100 |
| src/domain/audit.ts | 100 | 93.75 | 100 | 100 |
| src/domain/authz.ts | 97.36 | 99 | 100 | 97.61 |
| src/domain/bid.ts | 100 | 91.42 | 100 | 98.33 |
| src/domain/constants.ts | 100 | 100 | 100 | 100 |
| src/domain/deadlines.ts | 97.82 | 93.33 | 100 | 92.30 |
| src/domain/effects.ts | 100 | 100 | 100 | 100 |
| src/domain/errors.ts | 100 | 100 | 100 | 100 |
| src/domain/holding.ts | 100 | 95.45 | 100 | 100 |
| src/domain/listing.ts | 100 | 96 | 100 | 97.91 |
| src/domain/machine.ts | 100 | 97.50 | 100 | 100 |
| src/domain/machines.ts | 100 | 100 | 100 | 100 |
| src/domain/mermaid.ts | 100 | 100 | 100 | 100 |
| src/domain/money.ts | 100 | 100 | 100 | 100 |
| src/domain/policy.ts | 100 | 100 | 100 | 100 |
| src/domain/pricing.ts | 97.87 | 94.11 | 100 | 98.24 |
| src/domain/redact.ts | 100 | 68.42 | 100 | 100 |
| src/domain/result.ts | 100 | 100 | 100 | 100 |
| src/domain/roles.ts | 100 | 100 | 100 | 100 |
| src/domain/time.ts | 100 | 100 | 100 | 100 |
| src/domain/trade.ts | 100 | 95.58 | 100 | 100 |
| src/domain/types.ts | n/a | n/a | n/a | n/a |
| src/lib/clock.ts | 100 | 100 | 100 | 100 |
| src/lib/format.ts | 100 | 100 | 100 | 100 |
| src/lib/utils.ts | 100 | 100 | 100 | 100 |
| **Total** | **99.52** | **95.56** | **100** | **98.91** |

## Skipped or deferred

- No required domain module deferred.
- Applying effects, database transactions, sessions, notifications and trusted audit-checkpoint persistence remain Segment 2 responsibilities; this segment returns effects only. No server implementation or UI behavior was faked.
- UI remains the Segment 0 foundation. No new TODOs or untagged placeholders were introduced.

## Files created or changed

- `src/domain/result.ts`, `errors.ts` — typed success/failure results and domain error constructors.
- `src/domain/constants.ts`, `time.ts`, `money.ts` — shared constants, pure UTC time arithmetic and bigint-only money/input operations.
- `src/domain/roles.ts`, `types.ts`, `effects.ts` — preserved existing roles, actor/entity contracts and transactional effect vocabulary.
- `src/domain/machine.ts` — validated immutable transition engine and available-event selection.
- `src/domain/holding.ts`, `listing.ts`, `bid.ts`, `trade.ts`, `machines.ts` — four transition tables, constructors, quantity operations and machine registry.
- `src/domain/policy.ts`, `pricing.ts`, `allocation.ts` — transfer eligibility, weighted fair value, liquidation waterfall and deterministic pay-as-bid allocation.
- `src/domain/authz.ts`, `deadlines.ts` — centralized sandbox/relationship authorization and effective-time deadline processing.
- `src/domain/audit.ts`, `redact.ts`, `mermaid.ts` — canonical hash chain/checkpoints, contact redaction and deterministic state diagrams.
- `tests/unit/domain/*.test.ts`, `tests/unit/domain/helpers/fixtures.ts` — one test file per module, frozen fixture builders, exhaustive matrices, properties and end-to-end domain scenarios.
- `tests/unit/guards.test.ts` — domain numeric-parsing, console and randomness guards with self-tests.
- `vitest.config.ts` — V8 domain/lib coverage reporting and required global thresholds.
- `package.json`, `pnpm-lock.yaml` — two exact dev dependencies, `test:coverage` and coverage-enabled `check`.
- `prompts/reports/segment-1.md` — this report.

## For Ahmed to check manually

- Review the operator identity injection and trusted-checkpoint argument before integrating Segment 2 actions and audit storage.
- Inspect the machine tables beside the segment prompt, especially the two signatures, four-eyes release, counter expiry, backup assignment and dispute resume paths.
- Review the notification-template list above for Segment 2's handler mapping.
- Open `/tmp/atlas-segment1.mVkuZL/coverage/index.html` to inspect the disclosed uncovered branches; global thresholds are met without exclusions.
- Open `/dev/ui` in light and dark themes, and `/discover` at 390px, to confirm the untouched foundation remains visually intact. The automated foundation suite passed all 26 cases.
- For reliable direct Desktop commands, make the repository/dependencies locally available using Finder's download/keep-downloaded controls, or work from a non-cloud-synced directory; then run `pnpm install --frozen-lockfile`, `pnpm check` and `pnpm test:e2e`. Do not treat the interrupted Desktop installation as a completed check.
- Review and commit when satisfied. Segment 1 has deliberately not been committed or pushed.
