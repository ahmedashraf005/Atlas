# Segment 6 report

## Result
Done with the documented snapshot-history and domain-compatible cancellation choices; final checks are green on `seg-6`, with no commit or push.

## Acceptance criteria
- [x] Trades list and room work for every persona and for new segment-5 trades — 15 PGlite integration scenarios and the buyer/operator browser paths. Buyer A sees completed T-1036, Buyer B sees T-1042, company admins see company trades, operators see all, and Layla's seller persona initially has no trades.
- [x] Every trade event uses `runTransition`; the next-step card offers legal actions only — the unit matrix checks all nine states against seller, buyer, company admin, operator and system actors, then executes every offered event through the domain machine. Extra fields and unrelated parties are rejected.
- [x] Trade-only catch-up obeys the existing planner, persona rule and de-duplication — a fresh Buyer B sandbox gets one WAIVE job due in five seconds; company-admin/off/switching cases pass. A second refresh opens no transaction when nothing is missing or due. No holding, listing or bid reconciliation was added.
- [x] Both golden paths settle through auto-pilot — the integration test completes Buyer A's new counter-path trade; browser tests cover Buyer B's wire-to-settlement path and the human operator's distinct second approval. Simulated actors appear with “(auto-pilot)” and system deadlines with “Atlas (deadline)”.
- [x] Fixed payment instructions, redaction, payment-change warnings and step-up work — message isolation/rate-limit tests, 800ms component tests and browser assertions for “Confirm with passkey” and “Verifying passkey…”. Company admins receive no thread data. Documents are authorised server-side and watermarked for the viewer.
- [x] Final `pnpm check`, then `pnpm test:e2e`, passed sequentially — 2,558 tests in 44 unit/integration files; 50 Chromium E2E scenarios. Existing coverage thresholds remain unchanged. Browser fixtures report no console/page errors.
- [x] Visual verification at 1440px and 390px in both themes — screenshots inspected; no horizontal page overflow. Next step precedes the lower stacked cards on mobile. The operator reason dialog requires text and successfully cancels a trade.
- [x] Full changed-path inventory and Buyer B's T-1042 values are recorded below. Protected files and the existing automation scheduling table were verified unchanged.

## Commands run
All `check`, `build` and `test:e2e` executions were sequential; none overlapped.

| Command | Result |
| --- | --- |
| `git switch -c seg-6` from clean `main` | Passed; explicitly authorised by the segment instruction. |
| Baseline `pnpm check` | Passed before changes. |
| Baseline `pnpm test:e2e` | 45 passed, after baseline check completed. |
| `pnpm view motion version`; `pnpm add motion@13.4.4` | Installed the permitted dependency at an exact version. |
| Targeted `pnpm exec vitest run …` | New unit/integration scenarios passed after implementation fixes. |
| `pnpm typecheck`; `pnpm exec biome check --write <changed files>` | Development diagnostics fixed; final gate has no errors or Biome warnings. |
| `pnpm test:coverage` | 2,558 passed after adapting the existing target-job assertions. |
| Intermediate `pnpm check` | Type/lint diagnostics were fixed. One later run suffered a long host pause and wall-clock timeouts, including a synchronous guard test; an unchanged rerun passed. No timeout threshold or guard was weakened. |
| First implementation `pnpm test:e2e` | 49 passed; the operator test timed out on a case-sensitive landing-card selector before reaching the room. Selector corrected. |
| Subsequent `pnpm check`, then `pnpm test:e2e` | Passed; all 50 browser scenarios. |
| Final `pnpm check` | Passed: tokens, TypeScript, Biome, 2,558 coverage tests and production build. |
| Final `pnpm test:e2e` | 50 passed in 52.2 seconds on default port 3100, after final check completed. |
| Temporary production server + Playwright visual script | Four theme/width combinations: no overflow/errors; required-reason cancellation passed. Auxiliary script syntax/ambiguous-locator mistakes were corrected before its successful run. Server stopped afterward. |
| `git diff --check`; protected-path diff and planner comparison | Passed; no domain, seed, schema, migration, shell/demo-control, AGENTS or design changes; scheduling table byte-for-byte unchanged. |

Integration databases were in-memory PGlite. E2E used the existing PGlite/default-port configuration. No deployment or Neon verification was part of this segment.

### Coverage

Percentages aggregate the final coverage-summary counters for each directory.

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `src/domain/**` | 98.99% | 95.33% | 100.00% | 99.50% |
| `src/lib/**` | 100.00% | 98.56% | 100.00% | 100.00% |
| `src/server/**` (reporting, no threshold) | 84.46% | 77.02% | 83.04% | 89.03% |
| New `trade-display.ts` | 100.00% | 98.34% | 100.00% | 100.00% |

## Decisions and deviations
- `prompts/segment-6.md` was absent from the checkout. The complete Segment 6 specification supplied in the user message was used; no protected prompt was created or edited.
- Created `seg-6` from `main` as explicitly instructed, overriding AGENTS' general prohibition on creating branches. No worktree, commit, push or PR was created.
- Seed history has only `sandbox.seed`, not replayed trade audit events. Historical fallback lines are labelled “Demo snapshot”. T-1036's ROFR decision date is inferred from its funding deadline minus the policy funding period, explicitly labelled “date inferred”; no simulated audit history was invented. New events use actual audit metadata.
- Trade creation is an effect of listing allocation and has no separate `trade.create` audit entry. A metadata-only allocation lookup attributes “Bid accepted” to the actual seller, including auto-pilot. It never selects the reserve-containing listing snapshots.
- The existing domain permits `CANCEL_BY_OPERATOR` in five active states, but not `Disputed`. “Cancel trade” in a disputed room delegates to the existing `resolveCancel` action; the next-step card offers “Cancel and refund”. No transition rule changed.
- The sandbox write lock serialises first-message thread creation, so one thread per trade needs no new SQL constraint or migration. Only redacted message text and category flags reach storage/audit; a `payment_change` category preserves the warning.
- Register documents reconstruct before/after quantities at their document time from holdings and completed quantity history, including exercised trades. Later settlements do not rewrite an earlier extract's figures; a test checks T-1036's extract after T-1042 settles. History queries select no other trade prices.
- Shared Watermark extraction changes only the authorised company document page and the new component. Its existing content/access logic remains intact.
- `package.json` and `pnpm-lock.yaml` necessarily changed for the explicitly permitted motion dependency. Motion is used only for newly completed timeline steps; reduced motion disables that feedback.
- Foundation removes only `/trades` and `/trades/demo-id` placeholder cases, now replaced by real trade tests. Existing backend/segment-4 job assertions target their own entities because trade catch-up legitimately adds a concurrent pending WAIVE job; their original behavior remains tested.

## T-1042 values for Buyer B

These are the initial room values before auto-pilot waives. Live dates are relative to seeding; the fixed integration fixture uses T0 = **28 Sep 2026, 14:00 GST**.

| Field | Value |
| --- | --- |
| Header | Trade T-1042 |
| Meta | Falaj Robotics · Ordinary shares |
| Status | Company deciding; no Buyer B “Your move” badge yet |
| Quantity | 2,500 sh |
| Price per share | AED 36.00 |
| Total | AED 90,000 |
| Stored escrow reference | ESC-T-1042 |
| Seller | Karim Nasser · Holder #S-198 |
| Buyer | Omar Qasim · Investor #B-117 |
| Company | Falaj Robotics · ROFR 30 days |
| Next step | Waiting on Falaj Robotics to decide on the right of first refusal. |
| Auto-pilot helper | Usually a few seconds in this demo. |
| ROFR deadline | T0 + 26 days; 24 Oct 2026, 14:00 GST in the fixture |
| Bid accepted | Done; Karim Nasser · Holder #S-198; T0 − 20 days; Demo snapshot |
| Agreement signed | Done; seller and buyer signatures at T0 − 4 days; Demo snapshot |
| Right of first refusal | Current; waiting on Falaj Robotics with the deadline |
| Remaining timeline | Funds in escrow → Register updated → Released, initially upcoming |
| Checklist | Seller/buyer signed; remaining items unchecked; Release approvals 0 of 2 |
| Escrow | Nothing held yet. |
| Documents | Share transfer agreement |
| Messages | No messages yet. Keep all communication about this trade here. |

After auto WAIVE, Buyer B sees the locked payment block: **Atlas Client Escrow (demo)**; **Demo Bank of the Emirates**; **AE07 0000 0000 0000 0000 000 (fictional)**; **ESC-T-1042**; **AED 90,000**. No field is editable. The buyer marks the wire with simulated step-up. Auto-pilot then confirms funds, updates the register and obtains distinct approvals from **Tariq Mansour** and **Noor Khalil** before settlement. With the operator persona, Noor's second approval remains the human's step.

## Skipped or deferred
- None within Segment 6. The device passkey is explicitly simulated as specified; real authentication is not claimed. Existing later-segment placeholders remain.

## Files created or changed
- `package.json` — Pin the permitted motion dependency to 13.4.4.
- `pnpm-lock.yaml` — Lock motion and its transitive packages.
- `src/app/(app)/companies/[slug]/documents/[documentId]/page.tsx` — Use the extracted Watermark without changing company-document content or access rules.
- `src/app/(app)/trades/[id]/_components/actions.tsx` — Confirmation, reason dialogs, More menu and completion-safe success toasts.
- `src/app/(app)/trades/[id]/_components/messages.tsx` — Thread display, redaction/payment warnings and message form.
- `src/app/(app)/trades/[id]/_components/next-step.tsx` — Legal next-step controls and fixed, fictional payment instructions.
- `src/app/(app)/trades/[id]/_components/timeline.tsx` — Six-step timeline with 150ms completion feedback and reduced-motion support.
- `src/app/(app)/trades/[id]/documents/[documentId]/page.tsx` — Server-authorised, watermarked trade documents.
- `src/app/(app)/trades/[id]/page.tsx` — Render the authorised trade room and its summary/sidebar cards.
- `src/app/(app)/trades/_components/trades-list.tsx` — In-progress/completed tabs and responsive trade table.
- `src/app/(app)/trades/page.tsx` — Render the authorised trade list with live data.
- `src/app/_actions/trades.ts` — Thin async delegates for every trade action.
- `src/components/atlas/confirm-dialog.tsx` — Optional 800ms simulated passkey confirmation; preserve cancel-first focus.
- `src/components/atlas/watermark.tsx` — Shared decorative, accessible watermark overlay.
- `src/lib/trade-display.ts` — Pure status, waiting-party, next-step, cancellation and payment-warning helpers.
- `src/server/actions/trades.ts` — Strict pipeline definitions for all trade events and redacted messages.
- `src/server/automation.ts` — Read-only missing-trade planning and locked reconciliation using the existing table.
- `src/server/read/trades.ts` — Display-ready lists, room/timeline and generated document models.
- `src/server/refresh.ts` — Reconcile in the shared transaction refresh; preserve the no-write fast path.
- `src/server/repositories/audit.ts` — Sandbox-scoped trade entries and allocation actor metadata, without listing snapshots.
- `src/server/repositories/documents.ts` — Ordered sandbox-scoped trade documents.
- `src/server/repositories/escrow.ts` — Ordered sandbox-scoped trade escrow events.
- `src/server/repositories/messages.ts` — Sandbox-scoped thread/message reads and serialised first-thread creation.
- `src/server/repositories/trades.ts` — Visible trade rows, row lookup and price-free register quantity history.
- `tests/e2e/foundation.spec.ts` — Remove only the two completed trade-route placeholder scenarios.
- `tests/e2e/trades.spec.ts` — Seven browser scenarios, including both polling paths, step-up, messages and both mobile themes.
- `tests/integration/backend.test.ts` — Keep existing job assertions scoped to their target while asserting the new catch-up job.
- `tests/integration/segment-4/holdings.test.ts` — Assert the target holding verification job independently of trade catch-up.
- `tests/integration/segment-6/trades.test.ts` — Fifteen PGlite scenarios covering catch-up, visibility, settlement, documents, messages and disputes.
- `tests/unit/components/step-up.test.tsx` — Timing, cancel focus, cancellation and unmount safety for step-up.
- `tests/unit/trade-display.test.ts` — Seventy-seven tests for the display/action matrix and payment-change detection.
- `prompts/reports/segment-6.md` — Acceptance evidence, decisions, coverage, changed paths and exact T-1042 values.

## For Ahmed to check manually
- In both themes at 1440px and 390px, choose Buyer B → Trades → T-1042. With auto-pilot on, wait for locked payment instructions, confirm the wire with passkey, then watch six completed steps and open the completion certificate.
- With auto-pilot off, use the company-admin persona for Waive/Buy/Refuse, then inspect the audit actor in the timeline.
- As operator with auto-pilot on, wait for Tariq's first release approval and perform Noor's second approval. Repeating the same operator's approval is rejected.
- Buyer A → My bids → accept the L-2019 counter → Past → Open trade. Sign, mark the wire when prompted and watch the new trade settle.
- Send a payment-change message and a contact-detail message. Check the warning/redaction, then switch to company admin and confirm the thread is absent.
- Check the More reason dialogs and the historical register extracts; T-1042 shows seller 8,000 → 5,500 sh and buyer 0 → 2,500 sh, while T-1036 retains its earlier figures.

Temporary visual screenshots are under `/tmp/atlas-seg6-visual/`; they are not committed project artifacts. The task's temporary server has been stopped.
