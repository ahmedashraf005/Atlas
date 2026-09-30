# Fix A report

## Result

Done on `fix-a` from `main`. No commit or push was made.

## Fixes

- **A1 — Scoped auto-pilot:** A pure participation rule now limits job creation, trade catch-up, execution, and pending-job polling to entities involving the current persona. Unrelated jobs stay pending; deadline events remain independent of auto-pilot. This preserves Buyer B's seeded T-1042 and Falaj's six-trade price band while Buyer A explores.
- **A2 — Laptop toolbar:** At 1024–1279 px, the persona selector remains at least 220 px wide and a Time menu exposes all three clock jumps. At 1280 px and wider the individual buttons remain visible; the horizontal scrolling strip is gone. The tour names the toolbar time controls.
- **A3 — Early form validation:** Bid fields validate on blur and before review, show linked inline errors, focus the first invalid field, and clear errors when edited. Server field issues use the same presentation. The first submission now says “Bid placed on L-2031.” based on the form's initial mode. The create-listing form also validates on blur and focuses its first invalid field.
- **A4 — State diagrams:** Embedded diagrams fit and align to their card. Mermaid uses wider label bounds and more node/rank spacing. Each diagram has a natural-size scrollable dialog that opens at the top left; transition tables remain the precise reference.
- **A5 — Security links:** “See it” controls switch to the appropriate persona before following a server-allowlisted route. Buyer B's T-1042 and Seller's L-2031 are the concrete trade/listing examples. The shill-bidding rule is plain text.
- **A6 — Traded total:** The company console now totals non-related-party ordinary-share trade prints from the same 180-day source as the public company page: **AED 528,600 from 6 trades** for seeded Falaj.
- **A7 — First load and health:** Removed the root app-table skeleton. `/api/health` runs `SELECT 1`, responds `{ "ok": true }` with `Cache-Control: no-store`, and receives no session cookie from the proxy. The smoke suite checks it.

## Verification

| Command | Result |
| --- | --- |
| Baseline `pnpm check`, then `pnpm test:e2e` | Passed before edits; 59 E2E tests |
| Final `pnpm check`, then `pnpm test:e2e` | Passed sequentially; 2,608 unit/integration tests and 66 E2E tests |

New and updated tests cover the participation matrix, Buyer A's untouched T-1042 after 10 minutes and 45 seconds of browser idle time, paused queued jobs, Buyer A's complete counter-to-settlement path, the existing Buyer B trade/access and seller listing/counter paths, bid validation and toast text, toolbar widths, diagram bounds and full-size scrolling, every role-aware security link, the six-print console figure, and the health endpoint without a session. The existing operator four-eyes E2E path now reaches the trade through an involved Buyer B before the operator acts.

## Changed paths

- `src/app/(app)/holdings/[id]/list/_components/create-listing-form.tsx` — blur errors and first-invalid focus.
- `src/app/(app)/listings/[id]/bid/_components/bid-form.tsx` — bid errors, review gate, and submit toast.
- `src/app/(app)/under-the-hood/_components/mermaid-diagram.tsx` — fitted diagram and full-size dialog.
- `src/app/(app)/under-the-hood/_components/see-it.tsx` — persona-switch form buttons.
- `src/app/(app)/under-the-hood/page.tsx` — render persona-aware security controls.
- `src/app/api/health/route.ts` — database health response.
- `src/app/loading.tsx` — removed incorrect root skeleton.
- `src/components/shell/demo-controls.tsx` — responsive Time menu and fixed-width persona selector.
- `src/components/shell/top-bar.tsx` — keep the laptop controls in view.
- `src/lib/bid-maths.ts` — pure bid field validation.
- `src/lib/persona-involvement.ts` — pure job participation rule.
- `src/lib/tour.ts` — time-control wording.
- `src/proxy.ts` — no session minting for health checks.
- `src/server/actions/company.ts` — scope access-decision scheduling.
- `src/server/automation.ts` — scope transition/custom job scheduling and trade reconciliation.
- `src/server/health.ts` — injected database `SELECT 1` check.
- `src/server/read/consoles.ts` — ordinary trade-print total and caption.
- `src/server/read/under-the-hood.ts` — concrete role-aware destinations.
- `src/server/refresh.ts` — scope due-job execution and pending count.
- `src/server/repositories/trades.ts` — sandbox-scoped trade lookup by ref.
- `tests/e2e/bidding.spec.ts` — invalid quantity and first-submit toast.
- `tests/e2e/consoles.spec.ts` — seeded traded total.
- `tests/e2e/finish.spec.ts` — diagram fit assertion.
- `tests/e2e/fix-a.spec.ts` — idle, toolbar, diagram, security-link and health regressions.
- `tests/e2e/trades.spec.ts` — operator four-eyes route under scoped auto-pilot.
- `tests/integration/backend.test.ts` — scoped job expectations.
- `tests/integration/health.test.ts` — database readiness without sandbox creation.
- `tests/integration/segment-5/bidding.test.ts` — seller participation and order-independent trade assertion.
- `tests/integration/segment-6/trades.test.ts` — unrelated persona, queued job and full Buyer A trade regressions.
- `tests/integration/segment-7/consoles.test.ts` — six-print figure and caption.
- `tests/smoke/smoke.spec.ts` — health check without a cookie.
- `tests/unit/bid-validation.test.ts` — bid field boundary messages.
- `tests/unit/persona-involvement.test.ts` — entity/role participation matrix.
- `prompts/reports/fix-a.md` — this report.

## For Ahmed

Create a free uptime monitor that requests `https://atlas-marketplace-greenstone.vercel.app/api/health` every 5 minutes. It keeps the function and Neon database warm. Existing uncommitted `polish` work was preserved in `stash@{0}` before branching; it was not applied to `fix-a`.
