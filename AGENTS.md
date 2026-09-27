# AGENTS.md — Atlas Marketplace

Read this whole file before every task. It is the contract for how code is written in this repo.

## 1. What this project is

Atlas is an interview prototype built for Greenstone (Intern, Technology position). It is a regulated
marketplace where shareholders of private UAE startups sell their **existing** shares to professional
investors, and the **company approves every transfer**. No new shares are ever issued; the startup never
raises money on Atlas.

The prototype is deployed free on Vercel and reviewed by a technology panel who will click through it
**without signing up**. It must be correct, secure by construction, fast, and look calm and institutional.
It is a demo with simulated counterparties, not a production system, but the rules it enforces are real.

### Glossary (use these words consistently in code and UI)

| Term | Meaning |
| --- | --- |
| Seller | A shareholder (employee, ex-employee, early angel) selling existing shares |
| Buyer | A professional investor (family office, HNWI, fund) buying shares |
| Company | The startup whose shares are traded; verifies holdings, sets transfer policy, holds the ROFR |
| Operator | Atlas compliance/operations; reviews listings, releases escrow, sees the audit log |
| Holding | A seller's verified position in one share class of one company |
| Listing | A holding (or part of it) offered for sale in a sealed-bid window |
| Bid | A buyer's binding sealed offer on a listing: price per share, quantity, minimum fill |
| Counter | A seller's single counter-price sent to a bidder after the window closes |
| Trade | One accepted bid moving through ROFR, documents, escrow, transfer and settlement |
| ROFR | The company's right of first refusal: it may buy the shares itself at the same price |
| Fair-value band | 25th–75th percentile of recent trade prices, or a waterfall fallback |
| Sandbox | One visitor's isolated copy of all demo data |
| Persona | The demo identity the visitor is currently playing (seller, buyer A/B, company admin, operator) |
| Auto-pilot | Simulated counterparties that approve steps through the same state transitions a human would |

### Source-of-truth files

| File | What it is |
| --- | --- |
| `AGENTS.md` | This file: stack, rules, definition of done |
| `prompts/segment-N.md` | The task you are working on. Detailed spec for one segment |
| `docs/design/README.md` | Atlas brand book: colour roles, type, voice, layout, iconography |
| `docs/design/tokens.json` | Atlas design tokens (colours in light and dark, type scale, spacing, radii, shadow) |
| `docs/design/company-page.html` | The approved visual reference (buyer company page, light theme). Match its density and look |

Priority when they conflict: **segment prompt > AGENTS.md > design README**. Report any conflict you notice.

## 2. How we work

1. **One segment per task.** Build exactly what `prompts/segment-N.md` lists. If you notice something
   outside scope that should exist, write it in your report; do not build it.
2. **Never modify** `AGENTS.md`, anything in `docs/`, or anything in `prompts/` except your report file
   `prompts/reports/segment-N.md`.
3. **Do not commit, push, create branches or open PRs.** Ahmed reviews and commits.
4. **No new dependencies** beyond the stack table (section 3) unless the segment prompt explicitly lists them.
   If one is truly unavoidable, stop and explain in the report instead of adding it.
5. **Placeholders for later segments** must be visibly disabled or clearly labelled, and marked in code with
   `// TODO(segment-N): <what>`. No untagged TODOs. Never fake behaviour that looks real.
6. **APIs may be newer than your training data.** Next.js 16, Tailwind CSS v4, Zod v4, Biome 2 and
   shadcn/ui have breaking changes versus older versions. Before using an API you are unsure of, check the
   installed package (types in `node_modules`, its README/docs) or the official docs. Do not guess.
   Known Next.js 16 facts: `params`, `searchParams`, `cookies()` and `headers()` are async (await them);
   request interception lives in `src/proxy.ts` (the renamed `middleware.ts`), `next lint` no longer exists
   (we use Biome), Turbopack is the default bundler.
7. **Finish every task** by running the full check (`pnpm check`, then `pnpm test:e2e` if the segment has
   e2e tests), fixing failures, and writing the report (section 11). A task is not done with red checks.

## 3. Stack (locked)

Pin exact versions (`.npmrc` has `save-exact=true`). Do not upgrade anything unless the segment prompt says so.

| Area | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 24 LTS | `.nvmrc` = `24`; `engines.node` = `>=24` |
| Package manager | pnpm | Never npm or yarn commands |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | No `any` except in tests with a comment |
| Framework | Next.js 16.3.x, App Router, React Server Components, server actions | Upgrade to 16.3.7 on 30 Sep 2026 (security release) |
| UI runtime | React 19 (bundled with Next) | Forms: `useActionState` + Zod. No form libraries |
| Styling | Tailwind CSS v4 (CSS-first config, no `tailwind.config.*`) | Tailwind default colour palette is disabled; only Atlas tokens exist |
| Components | shadcn/ui (Radix primitives) restyled to Atlas; lucide-react icons | Generated files live in `src/components/ui` |
| Toasts | sonner | Via shadcn `sonner` component |
| Charts | Recharts | From segment 3 |
| Diagrams | mermaid (client-side only, one page) | Segment 8 |
| Motion | motion | Only timeline/state-change feedback, from segment 6 |
| Database | Neon Postgres (free tier, AWS Frankfurt) | From segment 2 |
| ORM | drizzle-orm 0.45.x + drizzle-kit | NOT the 1.0 release candidate |
| DB driver | @neondatabase/serverless via `drizzle-orm/neon-serverless` (WebSocket `Pool`) | Needed for interactive transactions; Node 24 has global WebSocket, no `ws` polyfill |
| Validation | Zod v4 | Every server action input and env vars |
| Server-only guard | server-only | `import "server-only"` at the top of every module in `src/server` and `src/env.ts` |
| Session (demo) | jose (HS256), signed httpOnly cookie | From segment 2 |
| IDs | uuid (`v7`) | Time-sortable |
| Hashing | `node:crypto` SHA-256 | Audit chain |
| Dates | `Intl` APIs via `src/lib/format.ts`; date-fns only if a segment needs date maths | Display timezone Asia/Dubai (GST, UTC+4, no DST) |
| Lint/format | Biome 2 | `biome.json` at root |
| Unit/integration tests | Vitest, fast-check, @testing-library/react + jsdom (component tests), @electric-sql/pglite (from segment 2) | |
| E2E tests | Playwright (Chromium) | |
| Scripts | tsx | For `scripts/*.ts` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |
| Hosting | Vercel Hobby, function region fra1 | |

## 4. Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | `biome check .` / `biome check --write .` |
| `pnpm test` | Vitest unit + integration, run once |
| `pnpm test:e2e` | Playwright against a production build on port 3100 |
| `pnpm tokens` | Regenerate `src/styles/tokens.css` from `docs/design/tokens.json` |
| `pnpm tokens:check` | Fail if `src/styles/tokens.css` is out of date |
| `pnpm check` | `tokens:check` → `typecheck` → `lint` → `test` → `build` (the gate for every segment) |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` | Drizzle (from segment 2) |

## 5. Repository layout

```
AGENTS.md
docs/design/                 design system + approved mockup (read-only)
prompts/                     segment prompts (read-only) + reports/segment-N.md (you write)
scripts/                     build-tokens.ts, etc.
src/
  app/
    layout.tsx               root: fonts, theme, toaster
    page.tsx                 landing + persona picker (segment 3)
    not-found.tsx
    (app)/                   everything inside the app shell
      layout.tsx             sidebar + demo toolbar
      <route>/page.tsx       one folder per page; feature components in <route>/_components/
  components/
    ui/                      shadcn/ui generated components, restyled to Atlas tokens
    atlas/                   Atlas primitives (StatusBadge, Money, Deadline, Figure, SectionCard, …)
    shell/                   app shell (Sidebar, TopBar, NavLink, ThemeToggle, MobileNav)
  config/                    navigation and static config
  domain/                    PURE business rules (segment 1): state machines, policy, pricing, allocation, authz, audit
  server/                    server-only code (segment 2): db, repositories, session, actions pipeline, automation
  lib/                       framework-free helpers: format.ts, clock.ts, utils.ts (shadcn `cn`)
  styles/                    globals.css, tokens.css (generated)
  env.ts                     environment parsing (Zod)
tests/
  unit/                      Vitest, node environment by default
  integration/               Vitest + PGlite (segment 2+)
  e2e/                       Playwright
```

## 6. Architecture rules

1. **Dependency direction:** `app` → `components` → `server` → `domain`, and anyone → `lib`.
   `src/domain` imports nothing from `next`, `react`, `drizzle-orm`, `src/server`, `src/app` or Node APIs,
   except `node:crypto` in `src/domain/audit.ts`. `src/lib` imports nothing from `next` or `src/server`.
2. **Server Components by default.** Add `"use client"` only where interaction needs it, and keep client
   components small and presentational.
3. **Every mutation is a server action built with the action pipeline** (segment 2):
   Zod-parse input → read session → `authorize()` → one DB transaction { load aggregate with `version` →
   domain transition → persist with optimistic lock → apply effects → append audit entry } → revalidate.
   No mutation route handlers. No direct `db.update` outside repositories.
4. **Every read goes through a repository** that filters by `sandbox_id` and by what the persona may see.
   Buyer-facing queries never select `reserve_price_minor` or other bidders' bids.
5. **Status changes only via domain transition tables.** UI never sets a status string. A transition that
   is not in a table is impossible.
6. **One decision point for permissions:** `can(actor, action, resource)` in `src/domain/authz.ts`.

## 7. Domain rules

- **Money:** `bigint` minor units (fils/cents) plus a currency code `'AED' | 'USD'`. Never `number` for money,
  never floats, never `parseFloat`. Prices per share are also bigint minor units (AED 38.50 = `3850n`).
- **Share quantities:** `bigint`.
- **Percentages:** integer basis points (`number`).
- **Time:** never call `Date.now()` or `new Date()` without arguments outside `src/lib/clock.ts`.
  Functions take `now: Date` or a `Clock`. `new Date(<value>)` for parsing/fixtures is fine.
- **Display time zone:** Asia/Dubai, labelled "GST".
- **IDs:** UUID v7 strings.
- **Server → client boundary:** never pass `bigint` in props to client components. Pass preformatted
  strings (preferred) or decimal strings.
- **Audit:** every successful mutation appends exactly one hash-chained audit entry in the same transaction.

## 8. UI rules

Read `docs/design/README.md` once per task. Summary:

- **Colour comes only from Atlas tokens.** Tailwind classes such as `bg-paper`, `bg-surface`,
  `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `border-line`, `border-line-strong`, `bg-atlas-green`,
  `text-on-green`, `bg-atlas-green-soft`, `text-brass`, `bg-brass-soft`, `bg-info-soft text-info`,
  `bg-warning-soft text-warning`, `bg-success-soft text-success`, `bg-danger-soft text-danger`,
  `fill-chart-band`, `outline-focus-ring`. Never hex/rgb/hsl literals in TSX, never Tailwind default palette
  names (`gray-500`, `green-700`, `white`, `black`…). A guard test enforces this.
- `src/styles/tokens.css` is generated. Change tokens only in `docs/design/tokens.json` (Ahmed does that) and
  run `pnpm tokens`.
- **Type utilities:** `type-display`, `type-heading-1`, `type-heading-2` (the serif styles: page title,
  company name and section/card titles only — never body text, tables, buttons or labels), `type-title`, `type-body`, `type-body-sm`, `type-label`,
  `type-figure-lg`, `type-figure` (tabular numerals built in), `type-mono`. Do not hand-set font sizes.
- **Colour meaning:** `atlas-green` is the single action colour — one primary button per view.
  `brass` means verification only and is never clickable. Status tones via `<StatusBadge tone>`:
  `neutral` (inactive), `info` (waiting on someone else), `warning` (the current user's move, or deadline
  under 48 hours), `success` (done), `danger` (stopped). Colour is never the only signal: badges always show words.
- **Surfaces:** page on `paper`; content in `surface` cards with `border border-line rounded-md`; no card
  shadows; `shadow-overlay` only on menus, popovers, dialogs, toasts.
- **Icons:** lucide-react, `strokeWidth={1.5}`, 16px inline, 20px in navigation, `text-ink-muted` by default.
  No emoji anywhere.
- **Formatting only through `src/lib/format.ts`:** "AED 38.50" per share, "AED 462,000" totals,
  "12,000 sh" in tables, "12,000 shares" in prose, "25 Sep 2026", "25 Sep 2026, 14:30 GST",
  relative "in 3 days" / "in 20h" / "in 45 min" / "2 days ago".
- **Voice:** plain and specific. No exclamation marks, no hype, no "Oops". Say what happened, who acts next,
  and by when. Example: "Awaiting company approval. Usually a few seconds in this demo."
- **Accessibility:** real `<button>`, `<a href>`, `<label htmlFor>`; `aria-label` on icon-only buttons;
  visible focus ring (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`);
  every page keyboard-navigable; skip link to main content.
- **Layout:** desktop-first at 1280–1440px, but every page must be usable at 390px wide (sidebar becomes a sheet).
- All companies and people in the demo are fictional. Never use real startup, fund or person names.

## 9. Security rules

- Identity comes only from the signed session cookie, never from request bodies, query strings or headers.
- Validate every external input with Zod at the boundary.
- **No caching of sandbox data:** no `"use cache"`, `unstable_cache`, cached `fetch`, `force-static`, and do not
  enable `cacheComponents`. Pages that read the session are dynamic.
- Secrets only via `src/env.ts`. Never log secrets, session tokens or full personal data.
- No `dangerouslySetInnerHTML` (the only future exception is sanitized Mermaid SVG in segment 8).
- Irreversible or money-moving actions (accept bid, fund escrow, release escrow) require a confirmation dialog.
- Security headers are set in `next.config.ts`; keep them.

## 10. Testing and definition of done

- Tests live in `tests/`. Name files `<thing>.test.ts(x)`. Component tests start with
  `// @vitest-environment jsdom`.
- Domain code: every allowed AND every forbidden transition is tested; invariants get fast-check property tests.
- Guard tests (`tests/unit/guards.test.ts`) scan `src/` and fail on: colour literals in TS/TSX, Tailwind default
  palette classes, `Date.now()` / `new Date()` outside `src/lib/clock.ts`, `dangerouslySetInnerHTML`,
  and imports that break the dependency direction. Never weaken a guard to make it pass; fix the code.
- **Definition of done for a segment:**
  1. Every acceptance criterion in the segment prompt is met.
  2. `pnpm check` passes with zero errors and zero Biome warnings.
  3. `pnpm test:e2e` passes (if the segment has e2e tests).
  4. No console errors in the browser on the pages the segment touched.
  5. Report written to `prompts/reports/segment-N.md`.

## 11. Report template (write to `prompts/reports/segment-N.md`)

```markdown
# Segment N report

## Result
One sentence: done / done with deviations / blocked.

## Acceptance criteria
- [x] criterion — how it was verified (test name or command)
- [ ] criterion — why not met

## Commands run
| Command | Result |
| --- | --- |

## Decisions and deviations
- What you decided that the prompt did not specify, and why.

## Skipped or deferred
- Item — TODO(segment-N) location.

## Files created or changed
- path — one-line purpose

## For Ahmed to check manually
- Specific pages/states to look at, in both themes.
```

## 12. Never

- Never use floats or `number` for money or share quantities.
- Never read the current time outside `src/lib/clock.ts`.
- Never write colour literals or Tailwind default palette classes.
- Never set a status without a domain transition.
- Never cache per-visitor data.
- Never trust identity from the client.
- Never add real company, fund or person names.
- Never add emoji, gradients, glassmorphism, or left-border accent cards.
- Never modify `docs/`, `prompts/` (except your report) or this file.
- Never skip, delete or weaken a failing test to get green; fix the cause or report it.
