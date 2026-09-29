# Segment 8 report

## Result

Done with documented deviations: the product finish, hardening, documentation and local deployment checks pass on `seg-8`; Next.js 16.3.7 is not yet published, and deployment remains manual. Nothing was committed or pushed.

## Acceptance criteria

- [x] Under the hood, guided tour, notifications and portfolio work in both themes at 1440 px and 390 px — `tests/e2e/finish.spec.ts`, PGlite integration tests and screenshot review.
- [x] State diagrams are generated server-side from the actual machines, rendered through a page-only dynamic Mermaid import in strict mode, follow theme changes, and have accessible transition disclosures. Browser tests check that content fits the viewport, labels retain their size and the starting state is visible, including reduced motion.
- [x] The persisted eight-step tour switches to the required personas and destinations; keyboard focus, Escape and internal redirect validation pass. Notifications are recipient-scoped, contain no prices, show the newest eight, and mark one/all read through audited actions. Buyer A's portfolio shows the seeded settled purchase.
- [x] Fresh per-request nonce CSP and `X-Robots-Tag: noindex, nofollow` are active — the shared browser fixture checks visited page responses and fails on console errors, page errors or CSP violations; the nonce test checks framework script nonces and request-to-request changes. Static assets are intentionally excluded from proxy nonce generation.
- [x] Zero serious or critical axe violations on every specified surface in light and dark, including the editable policy form — `tests/e2e/a11y.spec.ts`, with no excluded axe rules.
- [x] No `TODO(segment` markers remain in `src/`; every page has metadata and a loading skeleton. `ComingSoon` remains only in the development showcase, which is absent from navigation and returns HTTP 404 in production.
- [x] Final `pnpm check`, then `pnpm test:e2e`, then the local production smoke run all pass sequentially. Domain/lib coverage thresholds remain unchanged; server coverage is reported below.
- [x] README, BUILD-LOG, Frankfurt deployment configuration, Node 24 selection, production dependency audit CI and the manual deployment runbook are complete. Migration drift, database-free build and secret hygiene checks pass. Neon connectivity was not tested because no Neon URL was provided.

## Commands run

Build-owning commands were run one after another. Long-running gates used `caffeinate -i` to prevent the Mac sleeping during browser tests.

| Command | Result |
| --- | --- |
| Baseline `pnpm check` | Passed before changes; 2,578 tests and production build green. |
| Baseline `pnpm test:e2e` | Passed after baseline check; 52 tests. |
| Final `pnpm check` | Passed; tokens, TypeScript, Biome (zero errors/warnings), 2,593 tests in 48 files with coverage, and production build. |
| Final `pnpm test:e2e` | Passed; 59 Chromium tests, including both axe journeys, CSP assertions and all prior product flows. |
| `pnpm view next versions --json` | Checked on 29 September 2026; 16.3.7 absent. Retained exact 16.3.6. |
| `pnpm audit --prod --audit-level high` | Passed after patching Mermaid's affected transitive dependency; no known production vulnerabilities. |
| `pnpm db:generate` then `git diff --exit-code drizzle/` | Passed; no migration/schema drift. |
| `pnpm db:smoke` | Passed against PGlite; printed the PGlite driver and completed SELECT 1 plus an interactive transaction. |
| `DATABASE_URL=unavailable-at-build SESSION_SECRET=unavailable-at-build pnpm build` | Passed; no database connection or valid database configuration needed at build time. |
| `pnpm build`, then `pnpm start -p 3300` with `ATLAS_DEV_UI` unset and local test DB/session variables | Fresh production server started successfully for smoke. |
| `SMOKE_URL=http://localhost:3300 pnpm test:smoke` | Passed; one read-mostly test covers landing/headers, Buyer A company chart, bid composer without submission, operator audit verification and Trade diagram rendering. |
| Browser screenshot capture | Both themes and widths reviewed for diagrams, tour, portfolio and notifications; no browser errors or horizontal page overflow. |
| `git log --all --full-history -- .env.local .env` | Empty; neither environment file appears in repository history. |
| `git grep -nE "SESSION_SECRET=\|postgres(ql)?://" $(git rev-list --all)` | Reviewed all matches: documentation/example placeholders and synthetic unit-test URLs only; no real credentials. |
| `rg -n 'TODO\(segment' src` | No matches. |
| `git diff --check` and protected-file diff | Passed; no whitespace errors, and no changes to AGENTS, design documents, seed, domain rules, schema SQL or automation table. |

Intermediate failures were fixed rather than suppressed: strict forms initially included Next's framework metadata; axe exposed an inaccessible scroll region and a form-control name collision; streaming-page waits needed to wait for the destination and toolbar. One E2E run was disrupted by the host sleeping for roughly 36 minutes; subsequent runs prevented sleep. Screenshot review exposed Mermaid's temporary-container viewport measurement and unreadable mobile scaling, both corrected and regression-tested. The final gates listed above are green.

## Coverage

Aggregated from the final `coverage/coverage-summary.json`; percentages use the report's covered/total counts.

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `src/domain/**` | 98.99% | 95.33% | 100.00% | 99.49% |
| `src/lib/**` | 100.00% | 98.79% | 100.00% | 100.00% |
| `src/server/**` | 85.89% | 76.99% | 85.80% | 90.36% |

The existing domain/lib thresholds remain statements 95%, branches 90%, functions 95%, lines 95%. `src/server/**` remains included for reporting with no threshold. HTML and JSON reports are generated under `coverage/` and are not committed.

## Security release and dependency audit (For Ahmed)

As of 29 September 2026, registry inspection shows Next.js **16.3.7 is not published**. Next remains pinned to **16.3.6**; no companion upgrade was attempted without release notes. When 16.3.7 is published, run:

```sh
pnpm add -E next@16.3.7 && pnpm check && pnpm test:e2e
```

Added exact `mermaid@12.0.0` and dev-only `@axe-core/playwright@4.13.0`. Mermaid initially resolved `lodash-es@4.17.21`, affected by the high-severity template code-injection advisory [GHSA-r5fr-rjxr-66jc / CVE-2026-4800](https://github.com/advisories/GHSA-r5fr-rjxr-66jc). A narrow pnpm override resolves that affected transitive dependency to patched **4.18.1**, within the same major. The final production audit reports zero known advisories.

## Decisions and deviations

- `prompts/segment-8.md` was absent. After the missing-file stop, Ahmed supplied the specification in the conversation and instructed proceeding. That supplied specification was used; protected prompt files were not created or edited. BUILD-LOG links only prompt files that actually exist and identifies conversation-supplied specifications.
- Created `seg-8` from clean `main` as explicitly requested, overriding AGENTS' general no-branch rule. The Segment 8 permission to write `docs/BUILD-LOG.md` overrides AGENTS' general prohibition on changing `docs/`; the design files remain untouched.
- Followed the installed Next 16 nonce mechanism and the [official CSP guide](https://nextjs.org/docs/app/guides/content-security-policy): forward both `Content-Security-Policy` and `x-nonce` to the request, and put CSP on the response. Session-cookie forwarding remains intact. Production permits neither script inline execution without a nonce nor `unsafe-eval`; development alone permits eval. **`style-src 'unsafe-inline'` is intentional for Recharts/Mermaid inline styles.**
- The production showcase is now unconditionally unavailable, including when the obsolete `ATLAS_DEV_UI` flag is set. Production paths do not read that flag. To preserve every foundation showcase assertion, Playwright uses a separate development server on default port 3102, with independent PGlite storage. Product tests remain on the default production port 3100 and static `/icon.svg` readiness. Development output uses `.next/dev`.
- Next's development startup appended its generated instructions to AGENTS. Only that exact generated appendix was removed after verification; the tracked AGENTS file is identical to the original.
- Strict Zod parsing now strips reserved `$ACTION_` FormData fields supplied by Next before validating user input. This was necessary for the existing landing persona forms once actions became strict. A regression test proves arbitrary user fields such as an injected actor are still rejected.
- Discover's mandate checkbox is named `matchesMandates`: the former `matches` name shadowed the native `HTMLFormElement.matches()` method and broke axe. The read model accepts both query names for compatibility; integration tests verify both.
- Labelled, focusable scroll regions were added to tables, desktop demo controls and diagrams. The narrowly justified Biome exceptions allow keyboard scrolling, including Safari; no guard or axe rule was disabled.
- Mermaid rendering waits for fonts and uses the actual Atlas font family and CSS theme tokens. Rendering is serialized because Mermaid configuration is global. SVG geometry transitions are disabled so reduced-motion styles cannot delay the layout measurement. The mounted SVG's content bounds determine its viewport; wide diagrams keep readable labels, scroll within their card and open at the starting node. The single sanitized-SVG guard exception is path-specific and self-tested.
- Domain rules and schema SQL were off-limits, so notification actions reuse the existing sandbox-member authorization and enforce recipient ownership in sandbox-scoped repositories. Their audit entries use the existing sandbox entity. Already-read requests are idempotent and append nothing when no row changes.
- Portfolio groups the viewer's settled Atlas purchases by remaining holding, caps displayed shares at the remaining quantity, and lists source trades. It does not show unrelated pre-existing holdings.
- `engines.node` is `24.x` to make Vercel select Node 24 explicitly; `vercel.json` contains only `regions: ["fra1"]`.
- The secret-history search includes harmless synthetic URL fixtures in unit tests in addition to documentation and `.env.example`. Those fixtures use `host`/`example.test` and replacement values; none is a real connection or session secret. No credential removal was required.
- The smoke suite performs persona changes and audit verification only within its own new visitor sandbox; it never submits a bid, tampers with an audit entry or moves money. The local production test server was stopped after verification.

## Skipped or deferred

- Next.js 16.3.7 upgrade — not published yet; the exact later command is above. No source TODO was left.
- Neon migration/connectivity and Vercel deployment — manual preparation only; no Neon URL was supplied and no deployment was performed. The five steps below are the runbook.
- Public repository links — shown only when `NEXT_PUBLIC_REPO_URL` is set; no fake link was added.

## Values to compare manually

| Surface/persona | Seeded value |
| --- | --- |
| Buyer A portfolio | Falaj Robotics · Ordinary · **4,000 sh** · source **T-1036**; acquisition is T0 − 13 days. |
| Buyer A notifications | **1 unread**; “The seller countered your bid on L-2019”. |
| Company admin notifications | **1 unread**; “Decide on the right of first refusal for T-1042”; clicking opens T-1042 and reduces unread to **0**. Opening alone leaves it unread. |
| Guided tour | Eight steps: Buyer A company → bids → trades; Seller holdings; Company console; Operator operations → audit; final Under the hood with the current persona. |
| Under the hood | Four generated machines, the expanded transition/role tables, eleven sale steps, ten threat controls and the architecture diagram. |

## Files created or changed

- `.env.example` — Document optional public repository URL and remove the obsolete production showcase flag.
- `.github/workflows/ci.yml` — Add the high/critical production dependency audit gate.
- `README.md` — Rewrite product, setup, architecture, security, testing and deployment documentation.
- `docs/BUILD-LOG.md` — Record all segments, verification, deviations and actual prompt/report inventory.
- `next.config.ts` — Add noindex/nofollow and remove the resolved CSP marker.
- `package.json` — Pin Mermaid/axe, add test:smoke and select Node 24.x.
- `playwright.config.ts` — Keep production readiness/default port and preserve showcase tests on a separate dev server.
- `playwright.smoke.config.ts` — Require SMOKE_URL and run Chromium without starting a server.
- `pnpm-lock.yaml` — Lock allowed additions and patched transitive lodash-es.
- `pnpm-workspace.yaml` — Narrow override for affected transitive lodash-es.
- `prompts/reports/segment-8.md` — This complete verification, decisions, file inventory and deployment report.
- `src/app/(app)/bids/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/companies/[slug]/documents/[documentId]/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/companies/[slug]/documents/[documentId]/page.tsx` — Add document page metadata.
- `src/app/(app)/companies/[slug]/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/company/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/company/policy/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/dev/ui/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/dev/ui/page.tsx` — Disable the showcase unconditionally in production and remove resolved markers.
- `src/app/(app)/discover/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/discover/page.tsx` — Rename the mandate control to avoid shadowing the form matches method.
- `src/app/(app)/holdings/[id]/list/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/holdings/[id]/list/page.tsx` — Add listing composer metadata.
- `src/app/(app)/holdings/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/holdings/page.tsx` — Add Holdings metadata.
- `src/app/(app)/layout.tsx` — Load recipient notifications and mount the tour panel.
- `src/app/(app)/listings/[id]/bid/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/listings/[id]/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/ops/audit/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/ops/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/portfolio/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/portfolio/page.tsx` — Replace the placeholder with remaining Atlas-purchased shares and source trade links.
- `src/app/(app)/trades/[id]/documents/[documentId]/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/trades/[id]/documents/[documentId]/page.tsx` — Add trade document metadata.
- `src/app/(app)/trades/[id]/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/trades/[id]/page.tsx` — Add trade room metadata.
- `src/app/(app)/trades/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/under-the-hood/_components/mermaid-diagram.tsx` — Strict lazy SVG rendering, theme tokens, stable viewport and readable scrollable diagrams.
- `src/app/(app)/under-the-hood/_components/state-machines.tsx` — Machine tabs, generated counts and accessible transition tables.
- `src/app/(app)/under-the-hood/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/(app)/under-the-hood/page.tsx` — Implement sale steps, machines, controls, architecture and build links.
- `src/app/_actions/notifications.ts` — Thin async server action delegates.
- `src/app/loading.tsx` — Route loading skeleton using the shared Atlas page skeleton.
- `src/app/page.tsx` — Enable Start guided tour and mount the landing tour panel.
- `src/components/atlas/page-skeleton.tsx` — Reusable page loading skeleton.
- `src/components/shell/demo-controls.tsx` — Make the desktop control overflow region keyboard-scrollable.
- `src/components/shell/notifications-bell.tsx` — Unread bell, newest-eight menu, mark-read navigation and mark-all.
- `src/components/shell/top-bar.tsx` — Place the recipient's notifications bell in the shell.
- `src/components/shell/tour-panel.tsx` — Persisted eight-step floating tour, safe persona navigation and keyboard behavior.
- `src/components/ui/table.tsx` — Label and focus table scroll containers for keyboard accessibility.
- `src/env.ts` — Validate optional public repository URL and avoid reading the old flag in production.
- `src/lib/audit-display.ts` — Describe both notification audit actions.
- `src/lib/csp.ts` — Pure exact nonce-policy generation for production/development.
- `src/lib/notification-text.ts` — Price-free notification wording and safe unknown-template fallback.
- `src/lib/tour.ts` — Tour specification, defensive stored-step parsing and internal destination allowlist.
- `src/proxy.ts` — Forward nonce CSP and keep first-request sessions; always block production showcase.
- `src/server/actions/demo.ts` — Extend persona switching with a validated internal next destination.
- `src/server/actions/notifications.ts` — Strict, owned, transactional and audited mark-read actions.
- `src/server/actions/pipeline.ts` — Strip Next-reserved FormData metadata before strict input validation.
- `src/server/read/discover.ts` — Accept both the new mandate query name and legacy matches.
- `src/server/read/notifications.ts` — Newest-eight display model, unread count and safe entity destinations.
- `src/server/read/portfolio.ts` — Format remaining Atlas purchases without leaking bigint.
- `src/server/read/under-the-hood.ts` — Generate diagrams/transition rows and sandbox-aware explanatory links.
- `src/server/repositories/notifications.ts` — Recipient-scoped reads/locks/updates and amount-free bid targets.
- `src/server/repositories/portfolio.ts` — Sandbox/owner-scoped remaining holdings joined to settled purchase trades.
- `tests/e2e/a11y.spec.ts` — Axe journeys over all requested product surfaces in both themes.
- `tests/e2e/consoles.spec.ts` — Wait for the ready toolbar before reading auto-pilot state.
- `tests/e2e/demo-controls.spec.ts` — Apply the CSP/error watcher to the second independent browser context.
- `tests/e2e/dev-ui-gate.spec.ts` — Assert production 404 with the obsolete flag both unset and set.
- `tests/e2e/finish.spec.ts` — Diagram geometry/themes, eight-step tour, notification navigation, portfolio and nonce checks.
- `tests/e2e/fixtures.ts` — Fail on visited-page missing headers, CSP violations and browser errors.
- `tests/e2e/foundation.spec.ts` — Retain showcase assertions on dev, wait for streamed UI and remove implemented placeholders.
- `tests/e2e/global-setup.ts` — Clear the separate showcase PGlite test directory.
- `tests/integration/segment-8/finish.test.ts` — Notification ownership/idempotency/audit, safe switching, portfolio, diagrams and strict-form regressions.
- `tests/smoke/smoke.spec.ts` — Read-mostly deployed product/security smoke path.
- `tests/unit/audit-display.test.ts` — Include notification actions in exhaustive audit-label coverage.
- `tests/unit/env.test.ts` — Public repository validation and production flag isolation.
- `tests/unit/guards.test.ts` — Path-specific strict Mermaid insertion exception and adversarial self-tests.
- `tests/unit/segment-8.test.ts` — Notification template coverage, redirect/storage safety and exact CSP behavior.
- `vercel.json` — Select only Frankfurt fra1.

## For Ahmed to check manually

- At 1440 px and 390 px, in light and dark: open all four machine tabs, scroll wide diagrams, expand the transition tables and toggle theme.
- Start the tour on the landing page; use Take me there, Back/Next, reload and Escape. Check the floating panel/bottom sheet and focus.
- As company admin, open and dismiss the notification menu (count stays 1), then click the ROFR notice (opens T-1042; count becomes 0).
- As Buyer A, inspect Portfolio's Falaj holding and T-1036 link. Test the empty portfolio with a persona without a settled purchase.
- Set `NEXT_PUBLIC_REPO_URL` only if the repository is public; check its repository and BUILD-LOG links. Replace README's `<!-- DEMO_URL -->` placeholder after deployment.

## For Ahmed

1. Neon: create a project in AWS Frankfurt, database `atlas`; copy the **pooled** connection string.
2. Locally: run `DATABASE_URL="<neon url>" pnpm db:migrate`, then `DATABASE_URL="<neon url>" pnpm db:smoke`.
3. Vercel: import the GitHub repository; framework Next.js. Set `DATABASE_URL` to the Neon URL, `SESSION_SECRET` to a new `openssl rand -base64 48` value different from local, and `NEXT_PUBLIC_REPO_URL` to the repository URL if public. Do **not** set `ATLAS_DEV_UI`. Deploy.
4. Run `SMOKE_URL=https://<project>.vercel.app pnpm test:smoke`.
5. Open the URL in a private window on desktop and phone: no login prompt; landing loads.
