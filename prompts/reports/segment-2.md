# Segment 2 report

## Result
Done — the backend, isolated demo sessions, action pipeline, transitions, audit chain, deadlines, auto-pilot and demo controls are implemented; all final checks pass.

## Acceptance criteria
- [x] Schema, generated migrations and database constraints — PGlite migration/constraint integration tests pass; regeneration produces no changes.
- [x] Signed sessions and isolated, lazily seeded sandboxes — session unit tests, concurrent first-request integration test, purge/cascade tests and two-context E2E isolation test pass.
- [x] Action pipeline, transition service, effects and trusted audit checkpoint — integration tests cover authorization, optimistic conflicts, transaction rollback, allocations, backup promotion, settlement, refunds, notifications, documents and audit integrity.
- [x] Effective-time deadlines and persona-aware auto-pilot — scheduling unit tests and integration scenarios cover clock jumps, human turns, escrow exception, distinct release approvers, disabled auto-pilot and stale/unknown jobs. Visibility-aware polling is tested.
- [x] Demo controls — persona navigation, +1/+7/+30 days, auto-pilot, ROFR mode and confirmed reset are wired through server actions; demo-controls E2E tests pass.
- [x] Full checks and coverage — `pnpm check` passes with 2,324 tests across 35 files; `pnpm test:e2e` passes all 33 scenarios, including the existing shell scenarios. Browser error collection reports no errors.
- [x] Database smoke — PGlite connection, `SELECT 1` and an interactive transaction pass. No Neon URL was provided, so Neon smoke was not run.
- [x] Report includes fictional names, pool guidance, registered job kinds and schema decisions below.

## Commands run
| Command | Result |
| --- | --- |
| Baseline `pnpm check` | Passed: 2,191 tests and production build |
| Baseline `pnpm test:e2e` | Passed: 26 scenarios; run after baseline check finished |
| `pnpm db:generate` | Generated the initial migration; subsequent regeneration reports no schema changes |
| `git diff --exit-code drizzle/` | Passed; generated files also compared byte-for-byte before and after regeneration because the new migration is not yet committed |
| `pnpm db:migrate` | Passed against local PGlite; repeat application is idempotent |
| `pnpm db:smoke` | Passed; driver reported PGlite |
| Final `pnpm check` | Passed: tokens, typecheck, Biome (187 files, no warnings/errors), tests with coverage and production build |
| Final `pnpm test:e2e` | Passed: 33 scenarios |
| `DATABASE_URL=unavailable-at-build SESSION_SECRET=unavailable-at-build pnpm build` | Passed; build does not initialize the database or require valid runtime credentials |
| `git diff --check` | Passed |

All check, build and E2E commands were run sequentially after resuming.

### Coverage
| Scope | Lines | Branches | Functions | Statements |
| --- | --- | --- | --- | --- |
| Domain and lib | 99.52% | 95.56% | 100% | 98.91% |
| `src/server/**` (35 files) | 79.31% | 76.41% | 68.82% | 75.98% |

The existing domain/lib thresholds remain unchanged: lines 95%, branches 90%, functions 95%, statements 95%. Server code is included in reporting without a threshold, as requested. Next action wrappers and request viewer behavior also have E2E coverage that is not included in Vitest's coverage numbers.

## Decisions and deviations
- The previous concurrent-run build-lock stop was a false baseline failure; sequential baseline runs passed.
- `prompts/segment-2.md` was absent from the checkout. Implementation followed the complete Segment 2 specification supplied in the conversation; no protected prompt file was created.
- Dependencies added are limited to the allowed list and pinned exactly: `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11, `@neondatabase/serverless` 1.1.0, `@electric-sql/pglite` 0.5.8, `jose` 6.2.12 and `uuid` 14.0.2.
- Mutable entity/profile tables have version columns. Tables with explicitly specified composite primary keys retain those keys without artificial IDs. Audit actor IDs and roles support the system actor as text. Audit JSON null is stored as JSON `null`, preserving both the non-null constraint and canonical hash input.
- A partial unique index also prevents duplicate pending automation jobs for the same entity, event and acting user. All required constraints are expressed in Drizzle; no hand-edited SQL or custom SQL migration was needed.
- Generated migration snapshots are excluded from Biome formatting so regeneration owns their bytes. Source linting and guard tests remain enforced.
- `holdings.committedQty` is the single repository calculation for the yearly cap: settled quantities during the previous 12 months plus current reserved quantity. Transition eligibility uses it.
- Audit verification reads the chain and trusted checkpoint within a locked transaction to obtain a consistent snapshot. Nested transitions re-read the current head before appending.
- Custom job handlers execute inside a savepoint: a handler error rolls back its changes before the job is marked skipped. Action handler errors roll back the complete action transaction.
- The sandbox row supplies the canonical active persona after the signed session identifies the sandbox. Persona changes and resets also rewrite the signed cookie.
- Reset creates a fresh seed entry and then records the successful reset in the new sandbox's chain. The deleted sandbox and all its data cascade away.
- Thin `"use server"` facades live in `src/components/shell/demo-actions.ts`; they delegate to the pipeline-backed server implementations. This accommodates Next's directive requirement while keeping `import "server-only";` first in every `src/server` module.
- Added the missing `sandbox.setRofrMode` authorization action with exhaustive role tests. The toolbar uses its existing local horizontal scrolling at narrower desktop widths, with persona labels kept on one line.
- CLI execution resolves the server-only guard under the React server condition; schema generation uses a narrowly scoped resolution hook. Runtime application imports remain guarded.

### Neon pool approach
`getDb()` lazily creates and reuses one module-level Neon WebSocket `Pool`, with a maximum of five connections, a ten-second idle timeout and a ten-second connection timeout. Node 24's native WebSocket is configured explicitly; Drizzle uses the pool for interactive transactions. PGlite instead reuses one instance per normalized persistent directory and automatically migrates on first use. In-memory test instances are fresh and independently migrated.

This follows Vercel's recommendation to reuse pools at module scope for Node functions and keep idle connections short-lived, together with Neon's documented WebSocket `Pool` support for interactive transactions: [Vercel connection pooling guidance](https://vercel.com/kb/guide/connection-pooling-with-functions), [Neon serverless driver documentation](https://github.com/neondatabase/serverless/blob/main/README.md). Edge-specific per-request pool examples are not the runtime used here. `@vercel/functions` was not added because it is outside the permitted dependency list; deployment-specific lifecycle integration remains for segment 8. No connection is opened at build time.

### Registered job kinds
| Kind | Registration and behavior |
| --- | --- |
| `transition` | Built-in runtime handler; executes the domain event as the targeted simulated user |
| `access_decision` | Extension point for segment 3; not registered yet |
| `seller_decide` | Extension point for segment 5; not registered yet |
| `competing_bid` | Extension point for segment 5; not registered yet |
| Unknown kinds | Marked skipped with `UNKNOWN_KIND` |

`registerJobHandler` exposes custom registration. A test-only rollback handler verifies savepoint behavior; it is not registered in application runtime.

### Fictional names used
Organizations and companies: Palmgate Family Office; Investor B-117; Saffron Secondaries Fund I; Harbour Row Capital; Sidra Angels; Falaj Robotics; Qamra Health; Wadi Ledger; Atlas; Dune Logistics Ventures.

People: Omar Qasim; Layla Haddad; Karim Nasser; Mira Rahman; Hana Saleh; Yousef Darwish; Rania Aziz; Noor Khalil; Tariq Mansour.

These are the supplied fictional seed names; Ahmed should review them for unintended matches to real entities.

## Skipped or deferred
- No required Segment 2 implementation is deferred.
- “Simulate competing bid” remains disabled with `TODO(segment-5)` in `src/components/shell/demo-controls.tsx`.
- Custom access/seller/competing-bid jobs and business pages/read models belong to subsequent segments. Demo document storage keys are seeded; actual files come later.
- Neon deployment and smoke verification await a provided Neon URL in segment 8.

## Files created or changed
- `drizzle.config.ts`, `drizzle/` — schema generation configuration, generated SQL and metadata.
- `scripts/migrate.ts`, `scripts/db-smoke.ts`, `scripts/db-runner.ts`, `scripts/server-only.ts` — migration/smoke commands and server-only-compatible CLI execution.
- `src/server/db/client.ts`, `src/server/db/schema.ts` — lazy driver selection, database types, tables, enums, indexes and integrity constraints.
- `src/server/clock.ts`, `session.ts`, `sandbox.ts`, `viewer.ts` — signed identity, sandbox lifecycle, request clock and request-scoped viewer.
- `src/server/seed/data.ts`, `seed/seed.ts` — exact relative-time fictional snapshot and transactional inserts.
- `src/server/repositories/` — sandbox-scoped aggregate reads/writes, explicit domain mappers, version checks, public listing projection, committed quantities, demand and references.
- `src/server/transitions.ts`, `effects.ts`, `audit.ts` — authorized transition persistence, ordered effects/hooks and checkpointed hash-chain append/verification.
- `src/server/automation.ts`, `refresh.ts` — concrete-party job scheduling, handler registry and chronological lazy processing.
- `src/server/errors.ts`, `ratelimit.ts`, `actions/pipeline.ts`, `actions/demo.ts` — typed errors, fixed-window rate limiting, transactional action core/wrapper and demo controls.
- `src/config/personas.ts` — shared persona metadata; replaces the deleted static `demo-viewer.ts`.
- `src/proxy.ts`, `src/env.ts` — first-request signed cookie forwarding and validated driver URL forms.
- `src/app/(app)/layout.tsx`, `src/components/shell/top-bar.tsx`, `demo-controls.tsx`, `demo-actions.ts`, `auto-refresh.tsx` — real viewer shell, interactive controls and visible-page polling.
- `src/domain/authz.ts` — ROFR-mode sandbox authorization action.
- `tests/integration/helpers/db.ts`, `tests/integration/backend.test.ts` — migrated in-memory PGlite and 23 backend integration scenarios covering the requested cases plus transaction/concurrency regressions.
- `tests/unit/` — session, scheduling, public columns, polling, environment, authorization and guard additions with guard self-tests.
- `tests/e2e/demo-controls.spec.ts`, existing shell E2E tests and Playwright setup/config — signed session/control scenarios, updated enabled-control expectations and isolated PGlite test directories.
- `package.json`, `pnpm-lock.yaml`, `.env.example`, `.gitignore`, `next.config.ts`, `biome.json`, `vitest.config.ts`, `.github/workflows/ci.yml` — pinned dependencies, database commands, runtime packaging, coverage reporting and migration drift CI.
- `prompts/reports/segment-2.md` — this report. The pre-existing change to `prompts/reports/repo-move.md` was left untouched.

## For Ahmed to check manually
- In both themes, switch through buyer A/B, seller, company admin and operator; confirm home routes, navigation and viewer labels.
- At 1440px and 1280px desktop widths and 390px mobile width, inspect the persona selector, time controls and More/menu controls. Desktop controls can scroll locally at narrower widths.
- Advance the clock, toggle auto-pilot, select company exercise mode and reload; confirm settings persist within that browser only.
- Open the reset confirmation, cancel once, then confirm; verify persona is retained and time returns to the real-time offset.
- Review the fictional names above and the committed migration before committing. No commit was made by this task.
