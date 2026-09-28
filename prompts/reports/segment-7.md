# Segment 7 report

## Result
Done with the documented narrow scope additions: company decisions, transfer policy editing, operator queues and checkpointed audit verification/tampering work on `seg-7`; final gates are green and no commit or push was made.

## Acceptance criteria
- [x] Company admins can clear every decision type from one queue — `tests/integration/segment-7/consoles.test.ts` covers seeded ROFR/question values, holding verification/rejection, access approval/denial and register-update queue entries. ROFR and register work opens the existing authorised trade room. Answer publication and buyer visibility pass E2E.
- [x] Transfer policy view/edit works with strict bounds, valid blackout windows, buyer types and sandbox-scoped investor restrictions — integration and E2E verify a 500-share minimum, blackout eligibility, forbidden roles, extra fields and invalid inputs. Existing trade deadlines stay unchanged. Share-lot validation and persistence use bigint; edit values cross the client boundary as decimal strings.
- [x] Operators can review listings and see money movement, disputes and flagged messages — integration verifies the reservation-aware policy re-check, approval, required rejection reasons, released shares, funded balances, approval counts and payment/contact categories. The review E2E covers approval and rejection, including the seller's reason display.
- [x] State changes use `runTransition` or authorised, audited pipeline handlers — strict facades never accept actors or events. Human and simulated access decisions share the same service. Company activity reads select metadata rather than private audit snapshots.
- [x] Audit verification and tamper demonstration work — midpoint tampering produces `HASH_MISMATCH` at the exact sequence, marks the row and survives re-verification; reset restores a clean chain. Additional integration checks cover 50-row pages, filters, sequence gaps, broken links, end truncation and checkpoint-only mismatch explanations.
- [x] The raw audit update is confined to `src/server/demo/tamper.ts` — the architecture guard still rejects ORM audit updates/deletes everywhere, rejects raw audit updates elsewhere, rejects raw deletes and requires the demo file to export only `tamperAudit`. Self-tests prove these restrictions.
- [x] Shared descriptions cover every machine event and literal/helper-generated server action string — enumeration test passes without fallback for known actions. Snapshot differences ignore `version`. `audit-display.ts` has 100% statements, branches, functions and lines.
- [x] Final `pnpm check`, then `pnpm test:e2e`, pass sequentially — 2,578 tests across 46 unit/integration files, production build, no Biome errors/warnings, then all 52 Chromium scenarios in 59.9 seconds. Existing coverage thresholds remain unchanged.
- [x] Both themes and responsive layouts checked — E2E includes light/dark mobile consoles. The auxiliary production review checked company, policy view/edit, operations and audit in four theme/width combinations (1440px/390px), with no page overflow or browser errors; representative screenshots were inspected.
- [x] Every changed path is listed below. Seed, domain rules, schema/migrations, automation/refresh, shell/demo controls, dependency manifests, AGENTS and design files are unchanged.

## Commands run
No `check`, `build` or `test:e2e` executions overlapped.

| Command | Result |
| --- | --- |
| Read AGENTS, design README/mockup and Segment 2–6 reports | Completed before implementation. |
| `git switch -c seg-7 main` | Created from clean main in `/Users/ahmedashraf/dev/atlas`; no worktree. |
| Baseline `pnpm check` | Passed: 2,558 tests and production build. |
| Baseline `pnpm test:e2e`, after check finished | 50 passed in 56.8 seconds. |
| Targeted Vitest and development `pnpm typecheck` | Passed after implementation/fixture corrections; final gate contains all new cases. |
| `pnpm exec biome check --write <changed files>` | Applied formatting only to changed source/tests; final full lint has zero warnings/errors. |
| Intermediate `pnpm check` | Passed initially with 2,575 tests; expanded coverage exposed an enumeration-test mistake that prefixed an already-qualified bid action with `trade.`. Corrected the enumerator, without weakening coverage. |
| First feature `pnpm test:e2e` | 51 passed, one failed: a global review-row locator also matched recent activity after approval. Scoped it to Listing review; the rerun passed all 52. |
| Auxiliary production server + Playwright visual script | Twenty route/theme/width checks reported `overflow: false`, errors `[]`; screenshots inspected and tampering exercised in all four contexts. Temporary server stopped. |
| Final `pnpm check` | Passed: tokens, TypeScript, Biome (277 files), 2,578 coverage tests and production build. Includes malformed share-lot validation regression. |
| Final `pnpm test:e2e`, after final check finished | 52 passed in 59.9 seconds on default port 3100. |
| `git diff --check`; protected-path diff | Passed; protected paths unchanged. |

Integration tests use in-memory PGlite; E2E uses the existing isolated PGlite configuration. No Neon, deployment or migration change was part of this segment. Final gate logs are `/tmp/atlas-seg7-check.log` and `/tmp/atlas-seg7-e2e.log`; auxiliary screenshots/results are under `/tmp/atlas-seg7-visual/`.

### Coverage
Aggregated from the final coverage summary:

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `src/domain/**` | 98.99% | 95.33% | 100.00% | 99.50% |
| `src/lib/**` | 100.00% | 98.70% | 100.00% | 100.00% |
| `src/server/**` (reporting only) | 85.27% | 77.34% | 84.56% | 89.83% |
| `audit-display.ts` | 100.00% | 100.00% | 100.00% | 100.00% |

## Decisions and deviations
- `prompts/segment-7.md` remains absent from the checkout. After the initial file-existence stop, Ahmed supplied the full specification again and clarified that it was in the message. That follow-up was treated as authorisation to use the pasted specification; no protected prompt was created or changed.
- Branch creation was explicitly requested, overriding AGENTS' general prohibition. Nothing was committed, pushed or published.
- The required shared access-decision extraction adds `src/server/access-decision.ts` and minimally updates the existing job handler. Automatic decisions and manual approvals/denials now use identical authorisation, policy evaluation, locking, auditing and notification logic; stale automatic jobs still skip with `ALREADY_DECIDED`.
- Two files outside the console ownership list changed minimally: `src/server/read/holdings.ts` adds one owned-listing rejection-reason field, and `src/app/(app)/holdings/page.tsx` renders that reason. This was necessary for 7.4/7.6's explicit requirement that the seller's listings table show the operator rejection reason; the existing table omitted it. Both behaviors are covered in the new E2E. No other holdings behavior changed.
- Operator policy preview removes only the reviewed listing's already-reserved quantity from the holding and committed total before calling `evaluateListing`. Every other reservation and settled quantity still counts. Otherwise a full-position listing would fail its own re-check after successful submission. The transition rules remain unchanged.
- Pending holdings are ordered by their latest submission/resubmission audit time, with acquisition time only as a fallback when no submission metadata exists. Deadline-free requests/questions use their real sandbox submission dates.
- Blackout date inputs are interpreted at midnight GST; the policy engine's existing exclusive end boundary is retained. Existing deadlines are persisted unchanged rather than recomputed during policy updates.
- `demo.tamperAudit` uses the existing operator-only `audit.verify` permission, avoiding an off-limits domain-action change. Tampering deliberately bypasses the audit append process as specified; verification is a read operation and adds no domain audit entry.
- Audit status distinguishes an invalid entry/link/sequence from a valid shorter chain or invalid trusted checkpoint by separately verifying the stored entries. No domain verification rule changed. Only an actual entry hash mismatch gets the “Changed after writing” badge.
- The tamper confirmation uses the existing AlertDialog primitives with cancel-first focus, controlled from the dropdown selection. This opens the confirmation directly without changing the shared ConfirmDialog API or introducing an intermediate button.
- `tests/e2e/foundation.spec.ts` removes only `/company`, `/company/policy`, `/ops` and `/ops/audit` placeholder cases, replaced by the real console suite. No test was skipped or weakened.
- No dependencies, schema changes or migrations were needed. No fictional identities beyond the unchanged seed were introduced.

## Console values for the seed
These are fresh-snapshot values before counterparties advance the seeded trade. The fixed integration clock is T0 = **28 Sep 2026, 14:00 GST**. Browser audit counts include any persona/toolbar actions already performed.

### Company admin — Falaj Robotics

| Field | Value |
| --- | --- |
| Header | Falaj Robotics |
| Meta | Company console · you approve every transfer of your shares on Atlas |
| Decisions waiting | 2 |
| Live listings | 2 — L-2031 and L-2027 |
| Trades in progress | 1 — T-1042 |
| Settled on Atlas (180 days) | AED 143,200 — T-1036 |
| First queue item | Right of first refusal · T-1042 |
| ROFR detail | 2,500 sh at AED 36.00 to Omar Qasim |
| ROFR deadline | T0 + 26 days; 24 Oct 2026, 14:00 GST in the fixture |
| First action | Open trade, primary |
| Second queue item | Question from Investor #B-204 |
| Question | When will the FY2026 audited accounts be available? |
| Question action | Answer textarea and secondary Publish answer |
| Pending verifications/access/register updates | None initially |
| Recent company activity | None initially: historical seed rows were inserted as a snapshot, with only a sandbox seed audit entry. |

Live countdowns can floor to 25 days shortly after seeding, using the existing formatter. With auto-pilot on, the company persona remains responsible for its own decision. To freeze all queues while inspecting, turn auto-pilot off.

### Falaj transfer policy

| Rule | Value |
| --- | --- |
| ROFR / funding | 30 days / 5 days |
| Minimum lot / lock-up | 1,000 shares / 12 months |
| Yearly limit | 50% |
| Blackouts | None |
| Eligible buyers | Family offices, High-net-worth individuals, Funds, Angel syndicates |
| Restricted organisation | Dune Logistics Ventures |
| Trade price visibility | Participants in your company |

### Operator — fresh snapshot

| Figure / queue | Value |
| --- | --- |
| Listings to review | 0 |
| Releases waiting | 0 |
| Open disputes | 0 |
| Held in escrow | AED 0 |
| Review / money movement / disputes / flagged messages | Empty |
| Initial audit chain | Verified, one `sandbox.seed` entry before any toolbar actions |
| Initial audit actor/action | Atlas (deadline) / Demo data created |

The operator's auto-pilot catch-up can subsequently advance T-1042; those queues then reflect its current state. For example, a marked wire shows “Confirm funds”, funding shows **AED 90,000** held, and register upload shows “Approvals 0 of 2”. After Noor approves once, the console shows “You approved — waiting for a second operator”.

## Skipped or deferred
- No Segment 7 feature is deferred. Existing Segment 8 placeholders remain untouched.

## Files created or changed
- `prompts/reports/segment-7.md` — Acceptance evidence, commands, decisions, full inventory and seeded console values.
- `src/app/(app)/company/_components/activity.tsx` — Shared console activity table with formatted actors, actions and entity links.
- `src/app/(app)/company/_components/decision-control.tsx` — Pipeline-backed confirmations, required rejection reasons, access controls and answer form.
- `src/app/(app)/company/page.tsx` — Company figures, unified deadline-ordered decision queue and recent activity.
- `src/app/(app)/company/policy/_components/policy-form.tsx` — Policy view/edit form, buyer and organisation choices, blackout rows and save confirmation.
- `src/app/(app)/company/policy/page.tsx` — Authorised company policy page and breadcrumbs.
- `src/app/(app)/holdings/page.tsx` — Display the operator rejection reason under the seller listing status.
- `src/app/(app)/ops/audit/_components/audit-controls.tsx` — Verify feedback and the controlled danger confirmation opened directly from Demo tools.
- `src/app/(app)/ops/audit/page.tsx` — Chain status, GET filters, pagination and accessible snapshot disclosures.
- `src/app/(app)/ops/page.tsx` — Operator review, escrow/release, disputes, flagged messages and recent activity.
- `src/app/_actions/audit.ts` — Thin async verification and tamper-demo delegates.
- `src/app/_actions/company-console.ts` — Thin async delegates for holding verification/rejection, access decisions and answers.
- `src/app/_actions/ops.ts` — Thin async listing-review delegates.
- `src/app/_actions/policy.ts` — Thin async policy-update delegate.
- `src/lib/audit-display.ts` — Action/actor descriptions and canonical top-level snapshot differences.
- `src/lib/policy-display.ts` — Shared investor-type and price-visibility labels.
- `src/server/access-decision.ts` — Shared authorised policy evaluation, grant decision, audit and buyer notification.
- `src/server/actions/audit.ts` — Operator-only pipeline actions for verification and the explicit tamper demo.
- `src/server/actions/company-console.ts` — Strict action definitions for company decisions and redacted answers.
- `src/server/actions/ops.ts` — Strict approve/reject actions through runTransition.
- `src/server/actions/policy.ts` — Bounded, strict policy validation, sandbox-scoped restrictions and audited persistence.
- `src/server/demo/tamper.ts` — The sole raw audit update; changes the midpoint snapshot without changing its hash.
- `src/server/jobs/access-decision.ts` — Delegate automatic decisions to the same service as the company console.
- `src/server/read/audit.ts` — Consistent chain/checkpoint verification, filtered pages and formatted differences.
- `src/server/read/consoles.ts` — Authorised display-ready company/operator models and metadata-only activity.
- `src/server/read/holdings.ts` — Expose the owned listing rejection reason to the seller table.
- `src/server/read/policy.ts` — Formatted policy groups and decimal-string edit values.
- `src/server/repositories/consoles.ts` — Sandbox-scoped console reads, submission timestamps, policy/answer locks and versioned writes.
- `tests/e2e/consoles.spec.ts` — Six console/policy/audit scenarios, including both mobile themes and rejection reasons.
- `tests/e2e/foundation.spec.ts` — Remove only the four completed Segment 7 placeholder cases.
- `tests/integration/segment-7/consoles.test.ts` — Fourteen PGlite scenarios for queues, decisions, policy, review, privacy, audit and malformed inputs.
- `tests/unit/audit-display.test.ts` — Five tests enumerating action coverage and checking actors, diffs and policy labels.
- `tests/unit/guards.test.ts` — Narrow raw UPDATE exception and single-export restriction, with self-tests.

## For Ahmed to check manually
- In both themes at 1440px and 390px, choose Company admin and compare the two seeded queue entries/figures above. Publish an answer containing a phone number, then view Falaj as Buyer A and check the redaction.
- Turn auto-pilot off before adding a Falaj holding or requesting buyer access. Verify/reject the holding from the company queue; inspect blocked approval and the buyer notification after an access decision.
- Open Transfer policy, edit the minimum lot to 500, confirm and inspect the seller's Falaj terms. Try buyer types, organisation restrictions, visibility and blackout dates; Cancel should leave the stored policy intact.
- As Seller with auto-pilot off, submit a Wadi listing; switch to Operator, review the policy badge and approve. Repeat with rejection and confirm the seller table shows the reason and restored shares.
- Follow T-1042 to inspect wire confirmation, approval counts, disputes and payment/contact messages in the operator console. Money-moving actions remain in the trade room with its existing step-up confirmation.
- On Audit log, Verify chain, filter/search, expand the hash disclosure, and use Demo tools → Tamper. Check the exact changed row and broken-chain status, then Reset demo and verify again. Audit tables scroll inside their cards on mobile.

All 33 changed paths are listed above. The temporary review server is stopped; work remains uncommitted on `seg-7`.
