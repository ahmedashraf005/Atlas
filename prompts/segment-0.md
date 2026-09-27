# Segment 0 — Foundation

## Goal

Create the Atlas repository foundation: a Next.js 16 app with the Atlas design system wired in (tokens,
fonts, light/dark theme), restyled UI primitives, the app shell (sidebar + demo toolbar) with placeholder
pages for every route, a `/dev/ui` showcase page, and the full test and CI harness.

No database, no sessions, no business logic in this segment. Every later segment builds on what you create
here, so precision matters more than speed.

## Before you start

1. Read `AGENTS.md` fully. Every rule in it applies.
2. Read `docs/design/README.md` and `docs/design/tokens.json`.
3. Open `docs/design/company-page.html` in a browser (or read its markup). It is the approved look: warm
   paper background, ivory cards with hairline borders, deep green primary buttons, brass verification marks,
   IBM Plex Serif titles, IBM Plex Sans body, dense tables. Your shell and primitives must reproduce it.
4. The repo root already contains `AGENTS.md`, `docs/` and `prompts/`. Do not modify them (except writing
   `prompts/reports/segment-0.md` at the end).
5. Confirm `node --version` is 24.x and `pnpm --version` works. If not, stop and report.

## In scope

Scaffold, tooling, token pipeline, global CSS, fonts, theme switching, formatting and clock helpers,
shadcn/ui components restyled to Atlas, Atlas primitives, navigation config, app shell (desktop + mobile),
placeholder pages for all 16 routes, landing placeholder, 404/error/loading states, `/dev/ui`, env parsing,
security headers, unit/component/e2e tests, guard tests, CI workflow, minimal README.

## Out of scope (do not build)

Database, Drizzle, sessions, persona switching, sandbox clock offset, auto-pilot, any server actions,
any domain logic (state machines, pricing, policy), real page content, charts, Mermaid, CSP header.
These arrive in segments 1–8.

## Dependencies you may add in this segment

Runtime: `zod`, `server-only`, `lucide-react`, plus whatever `shadcn` installs for the listed components
(Radix packages, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `tw-animate-css`).
Dev: `@biomejs/biome`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
`@playwright/test`, `tsx`.
Do **not** add: `next-themes`, `tailwindcss-animate`, ESLint, Prettier, any date library, any state library.

---

## Tasks

### 0.1 Scaffold

`create-next-app` refuses non-empty folders, so:

1. Scaffold into a temporary sibling folder: `pnpm create next-app@latest ../atlas-scaffold-tmp` with:
   TypeScript **yes**, Tailwind CSS **yes**, App Router **yes**, `src/` directory **yes**, Turbopack **yes**
   (default), import alias `@/*`, linter **Biome** if offered (otherwise "None"; you add Biome in 0.3).
2. Move everything from the temp folder into the repo root (including dotfiles; excluding `.git` and
   `node_modules`). If the scaffold generated its own `AGENTS.md`, `CLAUDE.md` or similar agent file,
   **do not overwrite ours**: read theirs for anything useful (for example where bundled Next.js docs live),
   note it in your report, then delete it. Delete the temp folder.
3. Delete scaffold demo content: the default `src/app/page.tsx` body, default SVGs in `public/`, default
   `globals.css` contents, and the default favicon.
4. Confirm the installed `next` version is 16.3.x. Record the exact versions of `next`, `react`,
   `tailwindcss`, `typescript` in the report.

### 0.2 Project configuration

- `.nvmrc`: `24`
- `.npmrc`: `save-exact=true` and `engine-strict=true`
- `package.json`:
  - `"engines": { "node": ">=24" }` and `"packageManager": "pnpm@<the installed pnpm version>"`
  - Replace any `^`/`~` ranges with exact versions.
  - Scripts, exactly:

    ```json
    {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "typecheck": "tsc --noEmit",
      "lint": "biome check .",
      "lint:fix": "biome check --write .",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
      "tokens": "tsx scripts/build-tokens.ts",
      "tokens:check": "tsx scripts/build-tokens.ts --check",
      "check": "pnpm tokens:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build"
    }
    ```

- `tsconfig.json` (keep what Next generates, then ensure):
  - `"target": "ES2022"` (required for bigint literals like `3850n`)
  - `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`,
    `"noFallthroughCasesInSwitch": true`, `"resolveJsonModule": true`
  - `include` covers `src`, `tests`, `scripts`, `*.config.ts`, and Next's generated types.
- `.gitignore`: add `/playwright-report`, `/test-results`, `/blob-report`, `/coverage` (keep Next defaults,
  including `.env*` except `.env.example`).
- `.env.example`:

  ```
  # Neon Postgres connection string (used from segment 2)
  DATABASE_URL=postgres://user:password@host/db?sslmode=require
  # 32+ random characters, used to sign the demo session cookie (segment 2)
  SESSION_SECRET=replace-with-at-least-32-random-characters
  # 1 enables /dev/ui in production builds (e2e only). Never set on Vercel.
  ATLAS_DEV_UI=0
  ```

### 0.3 Biome

Add `@biomejs/biome` (2.x) and `biome.json` at the root:

- Formatter: spaces, indent 2, line width 100. JavaScript: double quotes, semicolons always,
  trailing commas all.
- Linter: `recommended: true`. Assist: organize imports on.
- Ignore: `.next`, `node_modules`, `playwright-report`, `test-results`, `blob-report`, `coverage`,
  `next-env.d.ts`, `src/styles/tokens.css`.
- CSS: if the installed Biome cannot parse Tailwind v4 at-rules (`@theme`, `@utility`, `@custom-variant`,
  `@apply`), enable its Tailwind directive parsing option if it has one; otherwise disable Biome's formatter
  and linter for `**/*.css`. State which you did in the report.
- shadcn-generated files in `src/components/ui` will be reformatted by Biome. If specific lint rules fire
  there, relax **only those rules** via `overrides` for `src/components/ui/**` and list them in the report.
- `pnpm lint` must finish with **zero errors and zero warnings**.

### 0.4 Token pipeline

Create `scripts/lib/tokens.ts` (pure logic, exported for tests) and `scripts/build-tokens.ts` (CLI).

`scripts/lib/tokens.ts` exports:

```ts
export function parseTokens(json: unknown): AtlasTokens;          // Zod-validated, throws with a clear message
export function generateTokensCss(tokens: AtlasTokens): string;   // deterministic output
export function resolveColor(tokens: AtlasTokens, name: string, theme: "light" | "dark"): string; // hex after alias resolution
```

Validation (throw with the offending token name):
- Every colour token has a light and a dark value, or is an alias `"{other}"` to an existing colour token.
  Plain string values count as light-only and inherit the light value for dark; after resolution every token
  must have a hex value in both themes.
- Token names match `^[a-z0-9][a-z0-9-]*$`. No duplicates.

`generateTokensCss` output, in this exact order (keep token order from the JSON):

```css
/* GENERATED by scripts/build-tokens.ts from docs/design/tokens.json. Do not edit by hand. */

:root,
[data-theme="light"] {
  --paper: #f4ede0;
  /* …every colour token, light value; an alias is written as var(--info) … */
  --elevation-overlay: <light shadow value>;
}

[data-theme="dark"] {
  --paper: #15110c;
  /* …every colour token, dark value; aliases again as var(--…) … */
  --elevation-overlay: <dark shadow value>;
}

:root {
  --space-1: 4px;
  /* …every spacing token… */
}

@theme {
  --color-*: initial;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
}

@theme inline {
  --color-paper: var(--paper);
  /* …one --color-<name> for every colour token… */
  --shadow-overlay: var(--elevation-overlay);
}

@utility type-display {
  font-family: var(--font-serif);
  font-size: 40px;
  line-height: 44px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
/* …one @utility type-<style> per type style in tokens.json; family from the group's `family`
   key → var(--font-serif | --font-sans | --font-mono); include letter-spacing only when set;
   styles in the "Figures" group also get: font-variant-numeric: tabular-nums; … */
```

Notes:
- The raw shadow variable is named `--elevation-overlay` so it does not collide with Tailwind's
  `--shadow-overlay` theme variable.
- `--color-*: initial` disables Tailwind's default palette so only Atlas colours exist.
- Expected utilities: `type-display`, `type-heading-1`, `type-heading-2`, `type-title`, `type-body`,
  `type-body-sm`, `type-label`, `type-figure-lg`, `type-figure`, `type-mono`.

`scripts/build-tokens.ts`:
- Reads `docs/design/tokens.json`, writes `src/styles/tokens.css`.
- With `--check`: generates in memory, compares with the file on disk, exits 1 with
  `tokens.css is out of date — run pnpm tokens` if different, exits 0 otherwise.
- Run `pnpm tokens` and commit-ready the generated file (do not hand-edit it afterwards).

### 0.5 Global CSS

Move global styles to `src/styles/globals.css` (update the import in the root layout). Structure:

```css
@import "tailwindcss";
@import "tw-animate-css";   /* only if shadcn installed it */
@import "./tokens.css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --font-sans: var(--font-plex-sans), "IBM Plex Sans Arabic", system-ui, sans-serif;
  --font-serif: var(--font-plex-serif), Georgia, serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  /* shadcn semantic names mapped to Atlas tokens, so generated components inherit the system */
  --color-background: var(--paper);
  --color-foreground: var(--ink);
  --color-card: var(--surface);
  --color-card-foreground: var(--ink);
  --color-popover: var(--surface);
  --color-popover-foreground: var(--ink);
  --color-primary: var(--atlas-green);
  --color-primary-foreground: var(--on-green);
  --color-secondary: var(--surface-sunken);
  --color-secondary-foreground: var(--ink);
  --color-muted: var(--surface-sunken);
  --color-muted-foreground: var(--ink-muted);
  --color-accent: var(--atlas-green-soft);
  --color-accent-foreground: var(--ink);
  --color-destructive: var(--danger);
  --color-border: var(--line);
  --color-input: var(--line-strong);
  --color-ring: var(--focus-ring);
}

@layer base {
  * { @apply border-line; }
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  body { @apply bg-paper text-ink font-sans antialiased type-body; }
  ::selection { @apply bg-atlas-green-soft text-ink; }
}
```

- `shadcn init` will write its own `:root`/`.dark` variable blocks, a `--radius` variable and an
  `@theme inline` block with oklch colours and `calc(var(--radius) …)` radii. **Delete all of that**; the
  block above replaces it.
- If `@apply type-body` is not allowed for a custom `@utility` in the installed Tailwind version, put the
  `type-body` class on `<body>` in the layout instead and note it.
- Verify that `bg-transparent`, `text-current` and `border-transparent` still work with the palette reset
  (they are keywords, not theme colours). If they do not, report it.

### 0.6 Fonts, root layout, theme

`src/app/layout.tsx` (Server Component):

- Load with `next/font/google`, `display: "swap"`, `subsets: ["latin"]`:
  - `IBM_Plex_Sans` weights `400`, `500`, `600` → `variable: "--font-plex-sans"`
  - `IBM_Plex_Serif` weight `500` → `variable: "--font-plex-serif"`
  - `IBM_Plex_Mono` weight `400` → `variable: "--font-plex-mono"`
- Read the theme from the `atlas_theme` cookie (`await cookies()`); valid values `"light" | "dark"`,
  default `"light"`. Render `<html lang="en" data-theme={theme} className={<all three font variables>}>`.
- `<body>` contains `{children}` and the Toaster.
- Metadata: `title: { default: "Atlas — Private shares, settled properly", template: "%s · Atlas" }`,
  `description: "A marketplace for company-approved sales of existing shares in private UAE startups. Demo with fictional data."`,
  `robots: { index: false, follow: false }`.
- Favicon: `src/app/icon.svg` — 32×32, rounded square (rx 6) filled `#1f4a30` with two horizontal lines in
  `#fffaf0` at y 13 and y 19, x 8–24, stroke-width 2. (Colour literals are allowed in this SVG asset only.)

`src/components/shell/theme-toggle.tsx` (client):
- Icon button (ghost, `icon-sm`), shows `Moon` in light theme and `Sun` in dark theme.
- `aria-label`: "Switch to dark theme" / "Switch to light theme" (reflecting the action).
- On click: set `document.documentElement.dataset.theme`, write cookie
  `atlas_theme=<value>; Path=/; Max-Age=31536000; SameSite=Lax`, update its own state. No page reload.
- Initial value comes from a prop passed by the server (the cookie value), so there is no flash.

### 0.7 Library helpers

**`src/lib/clock.ts`** — the ONLY file allowed to read the current time:

```ts
export interface Clock { now(): Date }
export const systemClock: Clock;                 // now() returns new Date()
export function fixedClock(at: Date | string): Clock; // now() returns a NEW Date equal to `at` on every call
```

**`src/lib/format.ts`** — all display formatting. Pure, no React. Exact API and outputs:

```ts
export type Currency = "AED" | "USD";
export function formatMoney(minor: bigint, currency: Currency, mode?: "perShare" | "total"): string;
export function formatMoneyCompact(minor: bigint, currency: Currency): string;
export function formatShares(qty: bigint, style: "table" | "prose"): string;
export function formatDate(d: Date): string;
export function formatDateTime(d: Date): string;
export function formatRelative(target: Date, now: Date): string;
export function deadlineTone(target: Date, now: Date): "neutral" | "warning" | "danger";
```

Rules:
- Use **bigint arithmetic only** for money (no `Number()` conversion of amounts). Thousands separator `,`.
- `formatMoney` default mode is `"total"`.
  - `perShare`: always 2 decimals.
  - `total`: rounded to whole units, half away from zero, no decimals.
  - Negative amounts: leading `-` before the currency code.
- `formatMoneyCompact`: whole-unit value `v`; `v >= 1e9` → `B`, `>= 1e6` → `M`, `>= 1e3` → `K`, else whole
  number; one decimal max, rounded half away from zero, trailing `.0` removed.
- Dates are shown in **Asia/Dubai**. Use `Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", … }).formatToParts`
  with **numeric** month and map it through your own `["Jan","Feb",…,"Dec"]` array (ICU prints "Sept" for
  September in some locales; we always want "Sep"). 24-hour time, zero-padded, suffix ` GST`.
- `formatRelative` buckets (`diff = target - now`):
  - `diff >= 48h` → `"in N days"` (N = floor(diff / 24h))
  - `1h <= diff < 48h` → `"in Nh"` (floor)
  - `1min <= diff < 1h` → `"in N min"` (floor)
  - `0 < diff < 1min` → `"in under a minute"`; `diff === 0` → `"now"`
  - Past, mirrored: `"N days ago"` (from 48h), `"Nh ago"`, `"N min ago"`, `"just now"` (under a minute)
- `deadlineTone`: `target <= now` → `"danger"`; `target - now < 48h` → `"warning"`; else `"neutral"`.

Required outputs (these are test cases):

| Call | Output |
| --- | --- |
| `formatMoney(3850n, "AED", "perShare")` | `AED 38.50` |
| `formatMoney(5n, "AED", "perShare")` | `AED 0.05` |
| `formatMoney(46200000n, "AED")` | `AED 462,000` |
| `formatMoney(46200050n, "AED")` | `AED 462,001` |
| `formatMoney(46200049n, "AED")` | `AED 462,000` |
| `formatMoney(0n, "AED")` | `AED 0` |
| `formatMoney(-120000n, "USD")` | `-USD 1,200` |
| `formatMoney(-120050n, "USD")` | `-USD 1,201` |
| `formatMoney(123456789012345678n, "AED", "perShare")` | `AED 1,234,567,890,123,456.78` |
| `formatMoneyCompact(40000000000n, "AED")` | `AED 400M` |
| `formatMoneyCompact(120000000000n, "AED")` | `AED 1.2B` |
| `formatMoneyCompact(125000000000n, "AED")` | `AED 1.3B` |
| `formatMoneyCompact(95000000n, "AED")` | `AED 950K` |
| `formatMoneyCompact(99900n, "USD")` | `USD 999` |
| `formatShares(12000n, "table")` | `12,000 sh` |
| `formatShares(12000n, "prose")` | `12,000 shares` |
| `formatShares(1n, "prose")` | `1 share` |
| `formatDate(new Date("2026-09-25T10:30:00Z"))` | `25 Sep 2026` |
| `formatDate(new Date("2026-09-25T21:30:00Z"))` | `26 Sep 2026` (after midnight in Dubai) |
| `formatDateTime(new Date("2026-09-25T10:30:00Z"))` | `25 Sep 2026, 14:30 GST` |
| `formatDateTime(new Date("2026-01-05T20:05:00Z"))` | `6 Jan 2026, 00:05 GST` |
| `formatRelative(now + 5d 3h, now)` | `in 5 days` |
| `formatRelative(now + 20h 59m, now)` | `in 20h` |
| `formatRelative(now + 45m, now)` | `in 45 min` |
| `formatRelative(now + 30s, now)` | `in under a minute` |
| `formatRelative(now, now)` | `now` |
| `formatRelative(now - 2h, now)` | `2h ago` |
| `formatRelative(now - 3d, now)` | `3 days ago` |
| `formatRelative(now - 10s, now)` | `just now` |
| `deadlineTone(now + 47h, now)` / `(now + 48h, now)` / `(now, now)` | `warning` / `neutral` / `danger` |

**`src/lib/utils.ts`** — keep shadcn's `cn()` here (it is created by `shadcn init`).

### 0.8 shadcn/ui components, restyled

1. `pnpm dlx shadcn@latest init` (style "new-york" if asked; CSS variables yes). Then remove its colour/radius
   blocks as described in 0.5.
2. Add exactly: `button card input label select textarea checkbox slider dialog alert-dialog sheet
   dropdown-menu tooltip table tabs separator skeleton sonner`.
3. Restyle every generated component to Atlas tokens. Rules for all of them:
   - No shadcn `ring-*` focus styles. Use
     `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`.
   - Overlays (`dialog`, `alert-dialog`, `sheet`): overlay `bg-ink/40`; content `bg-surface border border-line
     rounded-lg shadow-overlay`; title `type-title`; description `type-body-sm text-ink-muted`.
   - Floating surfaces (`dropdown-menu`, `select` content, popovers): `bg-surface border border-line rounded-md
     shadow-overlay`; items `type-body-sm`, highlighted item `bg-surface-sunken`.
   - `tooltip`: `bg-ink text-paper type-body-sm rounded-sm px-2 py-1`.
   - No `text-white`, `bg-black`, `dark:bg-input/30` or other palette leftovers (the guard test will fail).
4. **Button** (`src/components/ui/button.tsx`) — replace shadcn's variants with exactly these:

   | Variant | Classes (plus the shared focus/disabled styles) |
   | --- | --- |
   | `primary` (default) | `bg-atlas-green text-on-green hover:bg-atlas-green-strong` |
   | `secondary` | `bg-surface text-ink border border-line-strong hover:bg-surface-sunken` |
   | `ghost` | `text-ink hover:bg-surface-sunken` |
   | `danger` | `bg-danger text-paper hover:opacity-90` |
   | `link` | `text-atlas-green underline-offset-4 hover:underline px-0 h-auto` |

   | Size | Classes |
   | --- | --- |
   | `sm` | `h-8 px-3 type-body-sm font-medium` |
   | `md` (default) | `h-10 px-4 type-body font-medium` |
   | `icon-sm` | `size-8` |
   | `icon` | `size-10` |

   Shared: `inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap transition-colors
   disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`.
   Add a `loading?: boolean` prop: shows a spinning `Loader2` (`animate-spin`), sets `aria-busy="true"` and
   `disabled`. Keep `asChild` support. Then search `src/components/ui` for `buttonVariants(` and replace old
   variant names (`default`, `outline`, `destructive`) with the new ones.
5. **Inputs** (`input`, `textarea`, `select` trigger): `h-10 rounded-sm border border-line-strong bg-surface px-3
   type-body text-ink placeholder:text-ink-muted aria-invalid:border-danger` (textarea: `min-h-24 py-2`, no fixed height).
6. **Label**: `type-label text-ink-muted`.
7. **Card**: `bg-surface border border-line rounded-md` (no shadow). `CardTitle` → `type-heading-2`
   (serif); `CardDescription` → `type-body-sm text-ink-muted`.
8. **Table**: `TableHeader` row `bg-surface-sunken`; `TableHead` `h-10 px-3 type-label text-ink-muted uppercase
   text-left border-y border-line` (first cell `pl-5`, last `pr-5`); `TableRow` `h-[52px] border-b border-line`;
   `TableCell` `px-3 type-body-sm` (first `pl-5`, last `pr-5`). Numeric cells get `text-right` and
   `tabular-nums` from the caller.
9. **Tabs**: list `bg-surface-sunken rounded-md p-1`; trigger `type-body-sm rounded-sm px-3 py-1.5
   text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink`.
10. **Checkbox**: `border-line-strong`, checked `bg-atlas-green text-on-green border-atlas-green`.
11. **Slider**: track `bg-surface-sunken`, range `bg-atlas-green`, thumb `bg-surface border-2 border-atlas-green`.
12. **Skeleton**: `bg-surface-sunken animate-pulse rounded-md`. **Separator**: `bg-line`.
13. **Sonner**: remove any `next-themes` import. Accept a `theme` prop. Toast classes: `bg-surface border
    border-line text-ink shadow-overlay rounded-md type-body-sm`; description `text-ink-muted`.
    Mount `<Toaster position="bottom-right" />` in the root layout.

### 0.9 Atlas primitives — `src/components/atlas/`

One file per component, named exports, Server Components unless marked client. Exact APIs:

1. **`status-badge.tsx`**
   ```ts
   export type Tone = "neutral" | "info" | "warning" | "success" | "danger";
   export const toneClasses: Record<Tone, string>;
   export function StatusBadge(props: { tone: Tone; children: React.ReactNode; icon?: React.ReactNode; className?: string }): JSX.Element;
   ```
   `<span class="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 type-label">` +
   `neutral: bg-surface-sunken text-ink-muted` · `info: bg-info-soft text-info` ·
   `warning: bg-warning-soft text-warning` · `success: bg-success-soft text-success` ·
   `danger: bg-danger-soft text-danger`.
2. **`verified.tsx`**
   - `VerifiedBadge({ children })`: `inline-flex items-center gap-1 rounded-sm px-2 py-0.5 type-label
     bg-brass-soft text-brass` with lucide `BadgeCheck` (14px, `strokeWidth={1.75}`, `aria-hidden`).
   - `VerifiedMark({ label })`: icon only, `BadgeCheck` 14px `text-brass`, wrapped in
     `<span role="img" aria-label={label}>`. Default label "Verified".
3. **`money.tsx`**
   - `Money({ minor, currency, mode?, className? })` — `minor: bigint | string` (a decimal string is converted
     with `BigInt()`), renders `<span className="tabular-nums …">{formatMoney(...)}</span>`.
   - `Shares({ qty, style, className? })` — same idea with `formatShares`.
4. **`date-text.tsx`** — `DateText({ date, withTime? })` → `<time dateTime={iso}>` with `formatDate` /
   `formatDateTime`. `date: Date | string`.
5. **`deadline.tsx`** — `Deadline({ at, now, prefix? })`, `at`/`now`: `Date | string`.
   Renders `<span>{prefix} <time dateTime>{formatDate(at)}</time> · <span class={tone}>{formatRelative(at, now)}</span></span>`
   where tone classes are `neutral: text-ink-muted`, `warning: text-warning font-medium`,
   `danger: text-danger font-medium`. Expose `data-tone` on the relative span for tests.
6. **`figure.tsx`** — `Figure({ label, value, caption?, verifiedHeader? })`: a stat card.
   Default: `bg-surface border border-line rounded-md p-4 flex flex-col gap-1`; `label` in `type-label
   text-ink-muted`, `value` in `type-figure-lg`, `caption` in `type-body-sm text-ink-muted`.
   When `verifiedHeader` is set (string), the card starts with a strip `bg-brass-soft text-brass type-label
   px-4 py-1.5 flex items-center gap-1` containing `BadgeCheck` + that text, and `label` is omitted
   (matches the "Fair-value band" card in the mockup).
7. **`section-card.tsx`** — `SectionCard({ title, aside?, children, flush?, id? })`: `<section>` card;
   header row `flex items-baseline justify-between` with `<h2 class="type-heading-2">` and aside in
   `type-body-sm text-ink-muted`; padding `p-5`, or when `flush` the header gets `px-5 py-4` and children are
   edge-to-edge (for tables).
8. **`page-header.tsx`** — `PageHeader({ breadcrumbs?, title, meta?, actions? })`:
   breadcrumbs `{ label: string; href?: string }[]` rendered in a `<nav aria-label="Breadcrumb">` as
   `type-body-sm text-ink-muted` with links in `text-atlas-green`; title `<h1 class="type-heading-1">`;
   `meta` row under the title (`flex flex-wrap items-center gap-3`); `actions` right-aligned
   (`flex items-end gap-6` overall).
9. **`empty-state.tsx`** — `EmptyState({ icon?, title, description?, action? })`: centered, `py-12`,
   icon 24px `text-ink-muted`, title `type-title`, description `type-body-sm text-ink-muted max-w-md`.
10. **`coming-soon.tsx`** — `ComingSoon({ page, segment })`: an `EmptyState` inside a card with lucide
    `Hammer`, title `page`, description `This page is built in segment ${segment}.`
11. **`confirm-dialog.tsx`** (client) — wraps `AlertDialog`:
    `ConfirmDialog({ trigger, title, description, confirmLabel, cancelLabel = "Cancel", tone = "primary", onConfirm })`.
    Confirm button uses Button variant `primary` or `danger`. Focus starts on Cancel.
12. **`logo.tsx`** — `Logo({ withWordmark = true })`: inline 22px SVG mark (rounded square `rx=4` with
    `className="fill-atlas-green"` and two lines with `className="stroke-on-green"`, stroke-width 1.5 at
    y 9.5 and 13.5, x 5–17) plus `<span class="type-heading-2">Atlas</span>`. `aria-hidden` on the SVG;
    the wordmark carries the name.
13. **`skip-link.tsx`** — "Skip to content" link to `#main`: `sr-only focus:not-sr-only focus:fixed
    focus:left-4 focus:top-4 focus:z-50 bg-surface border border-line rounded-md px-3 py-2 type-body-sm`.

### 0.10 Roles and navigation

`src/domain/roles.ts` (pure):

```ts
export const ROLES = ["seller", "buyer", "company_admin", "operator"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { seller: "seller", buyer: "buyer", company_admin: "company admin", operator: "operator" };
```

`src/config/navigation.ts`:

```ts
export type NavItem = { label: string; href: string; icon: LucideIcon };
export const NAV_BY_ROLE: Record<Role, NavItem[]>;
export const FOOTER_NAV: NavItem[];
```

| Role | Items (label → href → lucide icon) |
| --- | --- |
| buyer | Discover → `/discover` → `Compass`; My bids → `/bids` → `Tag`; Trades → `/trades` → `ArrowLeftRight`; Portfolio → `/portfolio` → `Briefcase` |
| seller | Holdings → `/holdings` → `Wallet`; Trades → `/trades` → `ArrowLeftRight` |
| company_admin | Console → `/company` → `LayoutDashboard`; Transfer policy → `/company/policy` → `ScrollText`; Trades → `/trades` → `ArrowLeftRight` |
| operator | Console → `/ops` → `ShieldCheck`; Audit log → `/ops/audit` → `FileClock`; Trades → `/trades` → `ArrowLeftRight` |
| footer (all) | Under the hood → `/under-the-hood` → `Cpu` |

`src/config/demo-viewer.ts` — temporary, until sessions exist:

```ts
// TODO(segment-2): replace with the persona from the signed session
export const DEMO_VIEWER = { role: "buyer", handle: "Investor #B-081", subtitle: "Professional investor · KYC verified" } as const;
export const DEMO_PERSONA_OPTIONS = [
  "Buyer A · Investor #B-081",
  "Buyer B · Investor #B-117",
  "Seller · Holder #S-214",
  "Company admin · Falaj Robotics",
  "Operator · Atlas compliance",
] as const;
```

### 0.11 App shell — `src/components/shell/` and `src/app/(app)/layout.tsx`

Match `docs/design/company-page.html`. Structure of `(app)/layout.tsx` (Server Component):

```
<SkipLink />
<div class="flex min-h-dvh">
  <Sidebar viewer={DEMO_VIEWER} />            // hidden below lg
  <div class="flex min-w-0 flex-1 flex-col">
    <TopBar now={systemClock.now()} theme={theme} />
    <main id="main" tabIndex={-1} class="flex-1 px-4 pt-6 pb-8 lg:px-8">
      <div class="mx-auto flex w-full max-w-[1280px] flex-col gap-6">{children}</div>
    </main>
  </div>
</div>
```

**Sidebar** (`sidebar.tsx`, server; `nav-link.tsx` is the only client part):
- `<nav aria-label="Main">`, `hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r border-line
  bg-surface-sunken px-4 py-5 sticky top-0 h-dvh`.
- Top: `<Link href="/">` with `<Logo />`, `px-2`.
- Viewer card: `rounded-md border border-line bg-surface px-3 py-2.5`: line 1 `type-label text-ink-muted`
  "Signed in as {ROLE_LABELS[role]}"; line 2 `type-body-sm font-semibold` handle; line 3 `type-label
  font-normal text-ink-muted` subtitle.
- Nav list from `NAV_BY_ROLE[viewer.role]`, rendered with `NavLink`.
- Footer (`mt-auto`): the `FOOTER_NAV` link(s), then `type-label font-normal text-ink-muted px-2`:
  "Demo sandbox · all companies and people are fictional".

**NavLink** (client, uses `usePathname`): `flex items-center gap-2.5 rounded-md px-3 py-2 type-body text-ink
hover:bg-surface`; icon 20px `strokeWidth={1.5}` `text-ink-muted`. Active when the pathname equals the href
or starts with `href + "/"`: `bg-atlas-green-soft font-semibold`, icon `text-atlas-green`,
`aria-current="page"`.

**TopBar** (`top-bar.tsx`, server with client islands):
- `sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface-sunken px-4 lg:px-8`.
- Below `lg`: a `MobileNav` client component — icon button (`Menu`, `aria-label="Open navigation"`) opening a
  left `Sheet` (`w-72`) that contains the same content as the sidebar (logo, viewer card, nav, footer).
  Clicking a link closes the sheet.
- "DEMO" tag: `type-label rounded-sm border border-line-strong px-2 py-0.5 text-ink-muted`.
- `DemoControls` (client), visible from `lg` up:
  - `<label for="persona" class="type-label text-ink-muted">View as</label>` + shadcn `Select`
    (`id="persona"`, `h-8 w-64`, options `DEMO_PERSONA_OPTIONS`, value = first option), **disabled**.
  - A vertical `Separator` (`h-6`).
  - Buttons, variant `secondary`, size `sm`, all **disabled**: `+1 day` (icon `FastForward`), `+30 days`,
    `Simulate competing bid`, `Reset` (icon `RotateCcw`).
  - Each disabled control sits inside a `Tooltip` whose trigger is a wrapping `<span tabIndex={0}>` (disabled
    buttons don't fire pointer events). Tooltip text: persona select → "Persona switching arrives in segment 2";
    `+1 day`, `+30 days`, `Reset` → "Available from segment 2"; `Simulate competing bid` →
    "Available from segment 5". Mark each with `// TODO(segment-N)`.
- Below `lg`, the same controls collapse into a `DropdownMenu` triggered by a ghost icon button
  (`Settings2`, `aria-label="Demo controls"`) with the same items disabled.
- Right cluster `ml-auto flex items-center gap-4 type-body-sm text-ink-muted`:
  - Auto-pilot indicator: `span.size-2.rounded-full.bg-success` + "Auto-pilot on"
    (`// TODO(segment-2): read from sandbox`), hidden below `md`.
  - Sandbox time: `Clock` icon 16px + `<span class="tabular-nums">Sandbox time {formatDateTime(now)}</span>`,
    hidden below `md`.
  - `ThemeToggle`.

### 0.12 Routes and placeholder pages

Create these pages inside `src/app/(app)/`. Each exports `metadata = { title: "<Page>" }` and renders
`<PageHeader title="<Page>" />` followed by `<ComingSoon page="<Page>" segment={N} />`:

| Route | Page | Segment |
| --- | --- | --- |
| `/discover` | Discover | 3 |
| `/companies/[id]` | Company | 3 |
| `/listings/[id]/bid` | Place a bid | 5 |
| `/bids` | My bids | 5 |
| `/holdings` | Holdings | 4 |
| `/holdings/[id]/list` | Create listing | 4 |
| `/listings/[id]` | Listing | 5 |
| `/trades` | Trades | 6 |
| `/trades/[id]` | Trade room | 6 |
| `/company` | Company console | 7 |
| `/company/policy` | Transfer policy | 7 |
| `/ops` | Operator console | 7 |
| `/ops/audit` | Audit log | 7 |
| `/under-the-hood` | Under the hood | 8 |
| `/portfolio` | Portfolio | 8 |

Also:
- `src/app/(app)/loading.tsx`: skeletons (a title bar and three card blocks).
- `src/app/(app)/error.tsx` (client): `SectionCard` titled "Something went wrong" with the text
  "The page failed to load. Try again, or go back to the start." a `secondary` "Try again" button (`reset()`),
  a link to `/`, and `error.digest` in `type-mono text-ink-muted` if present. Never render `error.message` or stacks.
- `src/app/not-found.tsx`: centered card (no shell): `type-heading-1` "Page not found", text
  "This page doesn't exist in the demo.", link-styled button "Back to the start" → `/`.
- `src/app/page.tsx` (landing placeholder, no shell) — `// TODO(segment-3): persona picker`:
  centered column max-w-2xl on `paper`: `<Logo />`, `h1.type-display` "Private shares, settled properly.",
  `p.type-body text-ink-muted` "A marketplace for company-approved sales of existing shares in private UAE
  startups. Everything here is a demo with fictional companies and people.", one **primary** button (as a
  `Link`) "Enter the demo" → `/discover`, and the `ThemeToggle`.

### 0.13 `/dev/ui` showcase

Route `src/app/(app)/dev/ui/page.tsx`. It must be decided **at request time**: in production return
`notFound()` unless `getFlags().devUi` is true; always available in development. Confirm in the build output
that the route is dynamic (ƒ), not prerendered.

Use `const clock = fixedClock("2026-09-25T10:30:00Z")` for every time-dependent example. Sections, each a
`SectionCard` with an `id` (the e2e test checks the headings):

1. `#colours` "Colours" — a grid of every colour token from `docs/design/tokens.json` (import the JSON):
   a 48px swatch (`style={{ background: \`var(--${name})\` }}` with `border border-line rounded-sm`), name in
   `type-mono`, usage note in `type-body-sm text-ink-muted`. Toggle the theme to see dark values.
2. `#typography` "Typography" — each `type-*` utility with its token sample text and name.
3. `#buttons` "Buttons" — every variant × size, disabled, loading, and an icon button with `aria-label`.
4. `#badges` "Status and verification" — `StatusBadge` in all five tones (labels: "Draft", "Live",
   "Countered", "Settled", "Cancelled"), `VerifiedBadge` "Company onboarded and verified",
   `VerifiedMark` label "Holding verified by company".
5. `#formatting` "Formatting" — a table of calls and outputs using the examples from 0.7.
6. `#deadlines` "Deadlines" — `Deadline` at +5 days ("Closes"), +20h ("Closes"), +45 min, −2h.
7. `#figures` "Figures" — the four stat cards from the mockup: "Last round price" `AED 42.00` caption
   "Series B preferred · Mar 2026"; fair-value card with `verifiedHeader="Fair-value band · ordinary shares"`,
   value `AED 33.10–37.40`, caption "From 6 trades in the last 180 days"; "Last Atlas trade" `AED 35.80`
   caption "4,000 ordinary shares · 12 Sep 2026"; "Transfer terms" (value omitted; a small list: Right of
   first refusal 30 days, Minimum lot 1,000 sh, Buyer joinder Required).
8. `#table` "Table" — a `SectionCard flush` titled "Listings" with the three rows from the mockup (the first
   row highlighted with `bg-atlas-green-soft`, warning badge "Countered at AED 35.50 · 41h left", primary
   `sm` "Respond"; two rows with info badge "Live", `VerifiedMark` next to the holder, secondary `sm` "Bid";
   the third row also has a warning badge "Closing soon"). Numbers right-aligned.
9. `#forms` "Form controls" — labelled Input, Select, Textarea, Checkbox, Slider; one Input in error state
   (`aria-invalid="true"`, message below in `type-body-sm text-danger` linked with `aria-describedby`).
10. `#overlays` "Overlays" — buttons opening a Dialog, a `ConfirmDialog` (primary) and a `ConfirmDialog`
    (danger), a DropdownMenu, a Tooltip, a Sheet, and three toast buttons (success, info, error).
11. `#states` "Empty and loading" — `EmptyState`, `ComingSoon`, and a few `Skeleton`s.

### 0.14 Environment — `src/env.ts`

```ts
import "server-only";
export function getServerEnv(): { DATABASE_URL: string; SESSION_SECRET: string };
export function getFlags(): { devUi: boolean };
```

- Zod v4 schemas: `DATABASE_URL` → `z.url()` (use the v4 API, not the deprecated `z.string().url()`);
  `SESSION_SECRET` → `z.string().min(32)`; `ATLAS_DEV_UI` → `z.enum(["0", "1"]).default("0")`.
- Both functions parse **lazily** on first call and cache the result. Nothing calls `getServerEnv()` in this
  segment, so builds and tests do not need a database.
- On failure `getServerEnv()` throws `Error("Invalid environment: DATABASE_URL, SESSION_SECRET")` listing only
  the **names** of invalid variables, never their values.
- `server-only` cannot be imported in Vitest's node environment without help: add a Vitest alias that maps
  `server-only` to an empty module in `vitest.config.ts`.

### 0.15 `next.config.ts`

```ts
poweredByHeader: false,
async headers() {
  return [{ source: "/(.*)", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ]}];
},
// TODO(segment-8): Content-Security-Policy
```

Do not enable `cacheComponents` or any experimental caching flags.

### 0.16 Test configuration

**`vitest.config.ts`**: `environment: "node"`; `include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"]`;
`setupFiles: ["tests/setup/vitest.setup.ts"]` (imports `@testing-library/jest-dom/vitest`);
alias `@` → `src` and `server-only` → an empty module; `esbuild: { jsx: "automatic" }`.
Component tests opt in with `// @vitest-environment jsdom` on line 1.

**`playwright.config.ts`**: `testDir: "tests/e2e"`, one project `chromium` (viewport 1440×900),
`baseURL: "http://localhost:3100"`, `retries: process.env.CI ? 1 : 0`, `trace: "on-first-retry"`,
`webServer: { command: "pnpm build && pnpm start -p 3100", url: "http://localhost:3100",
reuseExistingServer: !process.env.CI, timeout: 240_000, env: { ATLAS_DEV_UI: "1" } }`.

### 0.17 Tests to write

**`tests/unit/tokens.test.ts`**
- `generateTokensCss(parseTokens(json))` equals the committed `src/styles/tokens.css` byte for byte.
- Every colour token resolves to a 6-digit hex in both themes; `--chart-above: var(--info);` appears in both
  theme blocks.
- All ten `@utility type-*` blocks exist; `type-figure-lg` and `type-figure` contain
  `font-variant-numeric: tabular-nums`.
- `parseTokens` throws naming the token for: a missing dark value with no light fallback, an alias to a
  missing token, a duplicate name.
- **Contrast** (WCAG 2.1 relative luminance), in **both** themes:
  - ≥ 4.5: ink/paper, ink/surface, ink/surface-sunken, ink-muted/paper, ink-muted/surface,
    ink-muted/surface-sunken, on-green/atlas-green, atlas-green/surface, brass/surface, brass/brass-soft,
    ink/brass-soft, info/info-soft, success/success-soft, warning/warning-soft, danger/danger-soft,
    ink/atlas-green-soft, ink/chart-band, paper/danger.
  - ≥ 3.0: line-strong/surface, focus-ring/paper, focus-ring/surface, chart-above/surface, chart-below/surface.
  - `|L(chart-above) − L(chart-below)| ≥ 0.05` (the two chart colours must differ in lightness).
  - Failure messages name the pair, theme and actual ratio.

**`tests/unit/format.test.ts`** — every row of the table in 0.7, plus: `formatMoney` never calls `Number()`
on the amount (covered by the 18-digit case), and relative formatting for exact bucket edges
(exactly 1h → `in 1h`, exactly 1 min → `in 1 min`, exactly 48h → `in 2 days`).

**`tests/unit/clock.test.ts`** — `fixedClock` returns equal instants as distinct `Date` objects (mutating one
does not affect the next call); `systemClock.now()` returns a `Date`.

**`tests/unit/env.test.ts`** — valid env parses; missing `SESSION_SECRET` throws a message containing
`SESSION_SECRET` but not the other value; `getFlags()` defaults to `devUi: false` and reads `"1"` as true.
Reset the module cache between cases (`vi.resetModules()`), and restore `process.env`.

**`tests/unit/guards.test.ts`** — scan files and fail with `file:line — rule` for each violation:
1. `src/**/*.{ts,tsx}`: colour literals — `#[0-9a-fA-F]{3,8}\b` inside strings or JSX attributes,
   `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`.
2. `src/**/*.{ts,tsx}`: Tailwind default palette utilities — any of
   `bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|accent|caret|shadow`
   followed by `-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}`
   or `-(white|black)\b`.
3. `src/**/*.{ts,tsx}` except `src/lib/clock.ts`: `Date.now(` or `new Date()` (empty argument list).
4. `src/**`: `dangerouslySetInnerHTML`.
5. `src/domain/**`: imports from `next`, `react`, `drizzle-orm`, `@/server`, `@/app`, `@/components`,
   `@/config`, or `node:*` (only `node:crypto` in `src/domain/audit.ts` is allowed).
6. `src/lib/**`: imports from `next` or `@/server`.
7. `src/**` and `next.config.ts`: the strings `"use cache"`, `unstable_cache`, `force-static`, `cacheComponents`.
8. `src/**/*.tsx`: emoji (`/\p{Extended_Pictographic}/u`).
Also add one **self-test** per rule: run the checker against an in-memory bad snippet and assert it is caught,
so a broken regex cannot silently pass.

**Component tests** (`tests/unit/components/*.test.tsx`, jsdom):
- `StatusBadge` renders children and applies `toneClasses[tone]` for each tone.
- `Deadline` with `now = 2026-09-25T10:30:00Z`: at +20h → text contains "in 20h", `data-tone="warning"`;
  at +5 days → "in 5 days", `data-tone="neutral"`; at −2h → "2h ago", `data-tone="danger"`.
- `Money` renders "AED 462,000" from `46200000n` and from `"46200000"`.
- `VerifiedMark` is found by `getByRole("img", { name: "Holding verified by company" })`.
- `NavLink` (mock `next/navigation`'s `usePathname`): active for exact match and for a nested path,
  sets `aria-current="page"`; inactive otherwise.
- `Button` with `loading` is disabled and has `aria-busy="true"`.

**E2E** (`tests/e2e/foundation.spec.ts`):
1. `/` shows the h1 "Private shares, settled properly." and "Enter the demo" navigates to `/discover`.
2. For every route in the 0.12 table (use `demo-id` for `[id]`): status 200; `nav[aria-label="Main"]` visible;
   an `h1` with the page name; text "This page is built in segment N." with the right N.
3. `/dev/ui` shows the headings of all eleven sections.
4. Theme: on `/discover`, click "Switch to dark theme" → `html[data-theme="dark"]`; reload → still dark;
   click "Switch to light theme" → light.
5. `/` response has all six security headers from 0.15 and no `x-powered-by`.
6. `/nope` shows "Page not found" and a link back to `/`.
7. Mobile (viewport 390×844): the sidebar nav is hidden; "Open navigation" opens a sheet containing the nav
   links; clicking "My bids" navigates to `/bids` and closes the sheet.
8. Keyboard: on `/discover`, the first Tab focuses "Skip to content"; activating it moves focus to `#main`.
9. The disabled "+1 day" control shows its tooltip "Available from segment 2" on hover.
10. On every page visited above, there are **no** `console.error` messages and no page errors
    (attach listeners in a fixture; fail the test with the collected messages).

### 0.18 CI — `.github/workflows/ci.yml`

On `push` and `pull_request`: `ubuntu-latest`, `actions/checkout`, `pnpm/action-setup` (version from
`packageManager`), `actions/setup-node` with `node-version-file: .nvmrc` and pnpm cache,
`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm exec playwright install --with-deps chromium`,
`pnpm test:e2e` with `CI=true`, upload `playwright-report/` as an artifact when the job fails.

### 0.19 `README.md` (minimal; segment 8 expands it)

Title "Atlas", one paragraph on what it is (fictional demo for an interview task), requirements (Node 24,
pnpm), a commands table (from AGENTS.md section 4), and "Contributors and AI agents: read AGENTS.md first."

---

## Acceptance criteria

All must be true. Verify each and record how in the report.

1. `pnpm install --frozen-lockfile` works from a clean clone; all versions exact; Node engine `>=24`.
2. `pnpm tokens:check`, `pnpm typecheck`, `pnpm lint` (0 errors, 0 warnings), `pnpm test`, `pnpm build`
   all pass — i.e. `pnpm check` is green.
3. `pnpm test:e2e` passes (all ten scenarios).
4. `src/styles/tokens.css` is generated, deterministic, and matches `docs/design/tokens.json`.
5. Tailwind's default palette is disabled; only Atlas colour utilities exist; guard tests pass and their
   self-tests prove each rule catches a violation.
6. The shell matches the mockup: 240px sunken sidebar with logo, viewer card, active nav state in green tint;
   56px sunken top bar with DEMO tag, disabled demo controls with tooltips, auto-pilot indicator, sandbox
   time "Sandbox time 25 Sep 2026, …" style text, theme toggle.
7. Light and dark themes both work, persist via cookie, and cause no flash on reload.
8. Every route in 0.12 renders its placeholder inside the shell; landing and 404 render without the shell.
9. `/dev/ui` shows every primitive in both themes and is 404 in a production build unless `ATLAS_DEV_UI=1`;
   the build output lists it as dynamic.
10. Mobile (390px): navigation works through the sheet; demo controls are reachable through the dropdown;
    nothing overflows horizontally.
11. Security headers present; no `x-powered-by`.
12. No `TODO` without a `(segment-N)` tag; no untagged placeholder behaviour.
13. `prompts/reports/segment-0.md` written using the template in AGENTS.md section 11.

## For Ahmed to check manually (include this list, adapted, in your report)

- Open `/dev/ui` and `docs/design/company-page.html` side by side at 1440px: colours, fonts, spacing,
  card borders, badge shapes, table density should match.
- Toggle dark mode on `/dev/ui`: every swatch and component readable.
- Resize to 390px wide: menu sheet, demo-controls dropdown, no horizontal scrolling.
- Tab through `/discover` from the top: skip link, sidebar links, top bar controls, focus ring always visible.

## Finish

Run `pnpm check` and `pnpm test:e2e` one final time, then write `prompts/reports/segment-0.md`.
Do not commit. Stop after the report.
