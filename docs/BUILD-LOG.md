# Atlas build log

This record summarizes the segment and fix prompts and their implementation reports. It records implementation and verification; it is not the AI disclosure.

## Segment 0 — Foundation and design system

Goal: establish the approved interface, application shell and test harness.

- Added the Atlas tokens, Plex typography, restyled Radix components and reusable primitives.
- Built the sidebar, toolbar, responsive navigation, themes and placeholder routes.
- Added the development UI showcase and production flag gate.
- Added unit/component, design-token, architecture-guard and browser tests, plus CI.

Verification: token regeneration, TypeScript, Biome, unit/component tests, production build and Chromium E2E; desktop/mobile screenshots in both themes. The report records a non-synced temporary copy used for final checks after iCloud reads stalled.

Decisions: cookie-based theme rendering, a request-time HTTP 404 showcase gate and a narrowly scoped expected-404 browser diagnostic exception. Prompt: [segment-0.md](../prompts/segment-0.md). Report: [segment-0.md](../prompts/reports/segment-0.md).

## Segment 1 — Pure domain core

Goal: express marketplace rules as pure TypeScript transition tables and functions.

- Implemented holding, listing, bid and trade machines with explicit roles and guards.
- Added eligibility policies, allocation, fair-value pricing and liquidation waterfalls using integer money.
- Added authorization, effective-time deadlines, canonical audit hashing and contact redaction.
- Added deterministic Mermaid generation, exhaustive transition matrices and property tests.

Verification: domain/unit/property tests with the required coverage gate, architecture guards, full check and unchanged foundation E2E. The report records local filesystem recovery during verification.

Decisions: the transition engine injects the actor, audit verification accepts a trusted head checkpoint, and only the lowest-priced allocation receives a backup. Prompt: [segment-1.md](../prompts/segment-1.md). Report: [segment-1.md](../prompts/reports/segment-1.md).

## Segment 2 — Data, sessions and action pipeline

Goal: persist the domain, isolate demo visitors and apply effects atomically.

- Added Drizzle/Postgres schema, constraints and generated migrations, with PGlite for local/tests and Neon for deployment.
- Added signed sessions, lazy fictional seeding, sandbox lifecycle and request clocks.
- Added sandbox-scoped repositories, a transactional action pipeline and persisted transition/effect services.
- Added checkpointed audit append/verification, effective-time deadlines and simulated counterparty jobs.
- Wired the persona, time, auto-pilot, ROFR and reset controls.

Verification: migration drift, PGlite smoke and concurrency/isolation/constraint/backend integration tests; full check and E2E sequentially. No Neon URL was available in that task.

Decisions: one module-level Neon Pool with short idle timeouts; yearly caps count settled sales plus reserved shares; custom jobs use savepoints. The prior concurrent-build stop was a false failure, corrected with sequential gates. Prompt: [segment-2.md](../prompts/segment-2.md). Report: [segment-2.md](../prompts/reports/segment-2.md).

## Segment 3 — Buyer discovery

Goal: populate buyer discovery, company information and approved access.

- Built the landing persona picker, directory filters and mandate matching.
- Reproduced the company reference with trade bands, history charts and precomputed exit waterfalls.
- Added policy-aware access requests, NDA acceptance, redacted Q&A and auto-pilot access decisions.
- Added authorized company documents and identity/time watermarks.

Verification: PGlite read-model/privacy/action tests, trade-price authorization matrix, E2E and visual review in both themes/widths; full check then E2E.

Decisions: access jobs reuse existing text columns; participation includes holdings, bids and trades. Static `/icon.svg` E2E readiness avoids initializing PGlite before global setup. The original listing-order fixture conflict was corrected in Segment 5. Prompt: [segment-3.md](../prompts/segment-3.md). Report: [segment-3.md](../prompts/reports/segment-3.md).

## Segment 4 — Seller holdings and listing creation

Goal: let sellers claim verified shares and create eligible listings.

- Built Holdings, policy eligibility cards, Add holding and resubmission.
- Built the integer-math create-listing review form and owned listings table.
- Wired verification, submission, approval and confirmed withdrawal to existing transitions.
- Added configurable E2E ports with port-specific persistent test databases.

Verification: seller PGlite/unit tests, full check and E2E on default and alternate ports; visual checks in both themes/widths and migration drift.

Decisions: reused central price visibility and participation; recent audited request IDs prevent duplicate listing creation. Work ran sequentially in the checkout. Prompt: [segment-4.md](../prompts/segment-4.md). Report: [segment-4.md](../prompts/reports/segment-4.md).

## Segment 5 — Bidding, counters and allocation

Goal: take either side from a sealed bid to a created trade.

- Built buyer composer/amendment/withdrawal, My bids and counter responses.
- Built count-only Live listings and the post-close bid ladder/allocation preview.
- Added server-recomputed acceptance, backup assignment and decline-all through shared services.
- Added simulated seller decisions and deterministic competing bids.
- Corrected company listing order to involved rows, then soonest close, then reference.

Verification: integer helper/badge unit tests, PGlite authorization/privacy/allocation/automation scenarios, full check and buyer/seller/mobile E2E.

Decisions: custom seller jobs reuse existing text columns; competing bids execute immediately rather than as another job kind. Idempotency conflicts return the existing bid. Prompt: [segment-5.md](../prompts/segment-5.md). Report: [segment-5.md](../prompts/reports/segment-5.md).

## Segment 6 — Trades and trade room

Goal: complete company approvals, escrow and settlement from one trade room.

- Built role-scoped Trades, legal next-step actions, parties, checklist, escrow and timeline.
- Added trade-only auto-pilot reconciliation using the unchanged scheduler.
- Added locked fictional payment instructions and simulated 800ms passkey step-up.
- Added authorized watermarked trade documents and redacted/payment-warning messages.

Verification: state/role unit matrix exercises offered events through the machines; PGlite full paths, four-eyes and isolation tests; full check, both golden-path E2E and responsive visual review.

Decisions: historical seed timeline data is explicitly labelled Demo snapshot; new history uses real audit actors. Existing domain-compatible cancellation events were retained. Prompt: [segment-6.md](../prompts/segment-6.md). Report: [segment-6.md](../prompts/reports/segment-6.md).

## Segment 7 — Company/operator consoles and audit

Goal: expose company decisions, transfer rules, operations queues and integrity proof.

- Built the unified company queue and shared manual/automatic access-decision service.
- Built policy viewing/editing with bounded inputs and audited changes.
- Built listing review, escrow/release, disputes and flagged-message queues.
- Built checkpointed audit filtering/pagination, snapshot diffs and midpoint tampering.
- Added a tested raw audit-write exception for the single-function tamper demo.

Verification: PGlite decision/policy/queue/tamper scenarios, action enumeration and guard self-tests; full check then console E2E, and desktop/mobile light/dark visual review.

Decisions: operator re-check excludes the reviewed listing's own reservation; the seller table gained the required rejection reason. Tampering uses existing operator audit permission. Prompt: [segment-7.md](../prompts/segment-7.md). Report: [segment-7.md](../prompts/reports/segment-7.md).

## Segment 8 — Product finish, hardening and deployment preparation

Goal: finish the explanatory product surfaces, verification and deployment documentation.

- Built generated strict-mode Mermaid diagrams, transition disclosures and linked security/architecture explanations.
- Added the eight-step persisted tour, safe internal redirect allowlist, recipient-owned notifications and real portfolio.
- Added nonce CSP, noindex headers, axe checks, CSP/error assertions and a read-mostly smoke suite.
- Added complete page metadata/loading states, production dependency audit CI and the Frankfurt/Node 24 deployment preparation.
- Rewrote README and this log; preserved the seed, domain rules, schema SQL and automation table.

Verification: unit/guard and PGlite integration tests, the full check, browser/CSP/axe tests in both themes, and local production smoke; the final command results are recorded in the Segment 8 report.

Decisions: inline styles remain permitted for Recharts/Mermaid; Next 16.3.7 was not published at registry inspection. Mermaid's vulnerable transitive lodash-es is pinned to a patched same-major release. The showcase is now unconditionally unavailable in production; its existing browser checks run on a development server after the production build finishes. Strict action parsing strips Next's reserved FormData metadata before validating user fields. Production deployment and Neon migration/smoke are manual runbook steps, not performed by the task. Prompt: [segment-8.md](../prompts/segment-8.md). Report: [segment-8.md](../prompts/reports/segment-8.md).

## Prompt and report inventory

The inventory links each specification and its report.

| Segment | Prompt | Report |
| --- | --- | --- |
| 0 | [prompts/segment-0.md](../prompts/segment-0.md) | [report](../prompts/reports/segment-0.md) |
| 1 | [prompts/segment-1.md](../prompts/segment-1.md) | [report](../prompts/reports/segment-1.md) |
| 2 | [prompts/segment-2.md](../prompts/segment-2.md) | [report](../prompts/reports/segment-2.md) |
| 3 | [prompts/segment-3.md](../prompts/segment-3.md) | [report](../prompts/reports/segment-3.md) |
| 4 | [prompts/segment-4.md](../prompts/segment-4.md) | [report](../prompts/reports/segment-4.md) |
| 5 | [prompts/segment-5.md](../prompts/segment-5.md) | [report](../prompts/reports/segment-5.md) |
| 6 | [prompts/segment-6.md](../prompts/segment-6.md) | [report](../prompts/reports/segment-6.md) |
| 7 | [prompts/segment-7.md](../prompts/segment-7.md) | [report](../prompts/reports/segment-7.md) |
| 8 | [prompts/segment-8.md](../prompts/segment-8.md) | [report](../prompts/reports/segment-8.md) |

The additional [repository-move report](../prompts/reports/repo-move.md) records the relocation away from iCloud-synced paths.

## Fixes

- Fix A: [prompt](../prompts/fix-a.md) · [report](../prompts/reports/fix-a.md).
- Fix B: [prompt](../prompts/fix-b.md) · [report](../prompts/reports/fix-b.md).
