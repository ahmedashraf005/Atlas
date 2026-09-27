# Segment 3 — Buyer discovery

## Goal

Build the buyer's side of discovery with real data: the landing page with the persona picker, **Discover**
(company directory with filters and mandates), the **Company page** (the approved mockup, now live),
company Q&A, the NDA-gated info pack with a per-viewer watermarked document viewer, and the auto-pilot
handler that decides access requests.

This segment runs **in parallel with segment 4** in a separate git worktree. Stay strictly inside the scope
and file ownership below so the two branches merge cleanly.

## Before you start

1. Read `AGENTS.md`, `docs/design/README.md`, `docs/design/company-page.html` and
   `prompts/reports/segment-2.md`.
2. You are on branch `seg-3`. Run `pnpm check`, **then** `pnpm test:e2e` (never at the same time). Both must
   be green before you change anything; if not, stop and report.

## File ownership (parallel-safety rules)

You may create or change:
- `src/app/page.tsx` (landing), `src/app/(app)/discover/**`, `src/app/(app)/companies/**`
  (rename the dynamic segment from `[id]` to `[slug]`)
- `src/app/_actions/company.ts`, `src/server/actions/company.ts`
- `src/server/read/landing.ts`, `src/server/read/discover.ts`, `src/server/read/company.ts`
- `src/server/jobs/access-decision.ts`, `src/server/jobs/index.ts`, and the single import line needed in
  `src/server/refresh.ts` to load `src/server/jobs/index.ts`
- `src/domain/authz.ts` (one new action, section 3.2) and its tests
- `src/config/demo-documents.ts`
- New components in `src/components/atlas/` named in this prompt, and `src/app/(app)/companies/[slug]/_components/**`
- Tests under `tests/integration/segment-3/**`, `tests/unit/**` (new files only, plus the authz test file),
  `tests/e2e/buyer-discovery.spec.ts`, and in `tests/e2e/foundation.spec.ts` **only** delete the
  placeholder entries for `/discover` and `/companies/[id]`.

Do **not** touch: holdings/listing routes, `src/server/automation.ts` (except via `registerJobHandler`),
`src/server/actions/demo.ts`, the shell, the schema/migrations, the seed, `playwright.config.ts`.
If you believe one of these must change, stop and report instead.

## Conventions introduced in this segment (segment 4 follows the same ones)

- **Server action facades** live in `src/app/_actions/<area>.ts`, start with `"use server"`, and only
  re-export actions built with `defineAction` from `src/server/actions/<area>.ts`.
- **Read models** live in `src/server/read/<area>.ts`. They take the `Viewer`, run the sandbox-scoped
  queries, call domain functions, and return **display-ready view models**: every user-facing value is a
  preformatted string (`formatMoney`, `formatShares`, `formatDate`…). The only numbers allowed are chart
  coordinates and ratios for bars. No `bigint` ever leaves a read model.
- Pages are Server Components that call a read model and render. Client components receive view models only.

## Dependencies you may add

`recharts` (exact version). Nothing else.

---

## 3.1 Landing and persona picker — `src/app/page.tsx`

Outside the app shell. Calls `getViewer()` (so the sandbox exists) and `getLandingModel(viewer)`.

Layout (centred, `max-w-5xl`, page padding `px-6 py-12`):
1. Top row: `<Logo />` left, `ThemeToggle` right.
2. `h1.type-display` "Private shares, settled properly."
3. `p.type-body text-ink-muted max-w-2xl`: "Atlas is a marketplace where shareholders of private UAE
   startups sell existing shares to professional investors, with the company approving every transfer.
   Pick a role to explore it. Everything here is a demo with fictional companies and people."
4. **Persona cards**, a responsive grid (1 column mobile, 2 at `md`, 3 at `lg`). One card per persona from
   `PERSONAS`, each a `<form action={switchPersonaAction}>` with a hidden `persona` input and the whole card as
   the submit button (real `<button type="submit">` with visible focus ring, `text-left`, `bg-surface border
   border-line rounded-md p-5 hover:bg-surface-sunken`). Card content:

   | Persona | Line 1 (`type-label text-ink-muted`) | Line 2 (`type-title`) | Line 3 (`type-body-sm text-ink-muted`) |
   | --- | --- | --- | --- |
   | buyer_a | BUYER | Investor #B-081 · Palmgate Family Office | Browse companies, bid on listings and respond to a seller's counter. |
   | buyer_b | BUYER | Investor #B-117 · individual investor | Has a trade waiting on the company's right of first refusal. |
   | seller | SELLER | Holder #S-214 | List shares, review sealed bids, counter and accept. |
   | company_admin | COMPANY | Falaj Robotics · CFO | Verify holdings, approve buyer access and decide on the right of first refusal. |
   | operator | OPERATOR | Atlas compliance | Review listings, release escrow with a second approver and verify the audit log. |

   The current persona's card shows `StatusBadge tone="success"` "Current" in its top-right corner.
   Submitting switches persona (existing action) and redirects to that persona's home.
5. A row under the grid: secondary button "Start guided tour" **disabled** with tooltip
   "Available from segment 8" (`TODO(segment-8)`), and a `link` button "How it works under the hood" →
   `/under-the-hood`.
6. Footer strip (`type-body-sm text-ink-muted`, three items with lucide icons `UserX`, `Box`, `Users`):
   "No sign-up needed" · "Your own private sandbox" · "Fictional companies and people".

## 3.2 Price visibility — `src/domain/authz.ts`

Add the action `company.viewTradePrices` with resource
`{ kind: "company"; …; priceVisibility: PriceVisibility; isParticipant: boolean }` (extend the company
resource type with these two optional fields; existing callers must keep compiling). Rules:

| `priceVisibility` | Who may see trade prices, the trade-based band and the last trade |
| --- | --- |
| `members` | anyone in the sandbox |
| `participants` | operator; company_admin of the company; any user with `isParticipant` |
| `operator` | operator; company_admin of the company |

`isParticipant` (computed by the read model): the viewer has an **approved** access grant for the company,
or holds shares in it (any holding with `quantity > soldQty`), or has a bid or trade on one of its listings.
When trade prices are hidden, the waterfall estimate from the last round is still shown (it is derived from
public round data). Add authz tests for all three modes × roles × participant flag.

## 3.3 Discover — `src/app/(app)/discover/page.tsx`

`getDiscoverModel(viewer, filters)` in `src/server/read/discover.ts`.

**Filters** (a plain `<form method="get">`, no client state): Sector (`Select`: "All sectors" + distinct
sectors), Stage ("All stages" + distinct stages), checkbox "Open listings only", checkbox "Matches my
mandates" (only rendered for buyers with at least one mandate), secondary "Apply" and `link` "Clear"
(→ `/discover`). Query params are parsed with Zod; invalid values are ignored (not errors).

**Layout:** `PageHeader` title "Discover", meta `type-body text-ink-muted` "Private companies whose shares you
can buy on Atlas." Below: at `lg` a two-column grid (`2fr 1fr`): left the filter card and the company table;
right the "Your mandates" card. Stacked on smaller screens (mandates after the table).

**Company table** (`SectionCard flush` titled "Companies", aside "{n} companies"), one row per company, ordered
by open listings desc then name:

| Column | Content |
| --- | --- |
| Company | name (`type-title`, link to `/companies/[slug]`) and `type-body-sm text-ink-muted` "{sector} · {stage}" |
| Last round | "{round name} · {Mon YYYY}" |
| Round price | preferred price per share, e.g. "AED 42.00" (right-aligned) |
| Fair value (ordinary) | band "AED 34.20–36.10"; waterfall fallback "AED 18.50 est."; hidden → `type-body-sm text-ink-muted` "Not disclosed" |
| Open listings | count of `Live` listings, right-aligned; `0` shown as "—" |
| Mandates | `StatusBadge tone="success"` "Matches" when any of the viewer's mandates matches, else nothing |
| (action) | secondary `sm` link-button "View" |

Empty result: `EmptyState` "No companies match these filters." with a "Clear filters" link.

**Your mandates** card (`SectionCard` "Your mandates", aside "Used for alerts and matching"): each mandate as a
block: name (`type-title`), "{sectors joined with ', '}" and "{stages joined}" (`type-body-sm`), ticket
"AED 250,000 – AED 2,000,000". No editing in this segment. Not rendered when the viewer has no mandates.

Expected with the seed, as buyer_a: 3 companies; Falaj shows 2 open listings, band "AED 34.20–36.10",
"Matches"; Wadi "USD 2.95–3.30"; Qamra "AED 18.50 est.". "Open listings only" leaves Falaj.
"Matches my mandates" leaves Falaj.

## 3.4 Company page — `src/app/(app)/companies/[slug]/page.tsx`

`getCompanyModel(viewer, slug)` in `src/server/read/company.ts`; unknown slug → `notFound()`.
Reproduce `docs/design/company-page.html` with live data. The primary share class shown in stats and chart is
the company's **ordinary** class.

### Header (`PageHeader`)
- Breadcrumbs: Discover → company name.
- Title: company name. Meta row: "{sector} · {stage} · Incorporated in {ADGM|DIFC}";
  `VerifiedBadge` "Company onboarded and verified"; `StatusBadge tone="info"` "{n} open listings" (omit when 0);
  for buyers with a matching mandate, a chip `bg-atlas-green-soft text-ink type-label rounded-sm px-2 py-0.5`
  "Matches your mandate “{name}”".
- Actions: when the viewer is a buyer **without** an approved grant → primary "Request access" (opens the NDA
  dialog, 3.6). When approved → secondary link-button "View listings" → `#listings`. Other roles: none.

### Four stat cards (`Figure`, 4-column grid at `lg`, 2 at `md`, 1 on mobile)
1. "Last round price" — "AED 42.00", caption "{round name} preferred · {Mon YYYY}".
2. Fair-value card, `verifiedHeader="Fair-value band · ordinary shares"`:
   trades → value "AED 34.20–36.10", caption "From {n} trades in the last 180 days";
   waterfall → value "AED 18.50", caption "Estimate from the last round's valuation";
   hidden → value "Not disclosed", caption "The company limits who can see trade prices.";
   none → value "—", caption "No price reference yet".
3. "Last Atlas trade" — "AED 35.80", caption "{qty} ordinary shares · {date}"; no trades → "—" / "No trades yet";
   hidden → "Not disclosed".
4. "Transfer terms" — rows: "Right of first refusal" "{n} days"; "Minimum lot" "{n} sh";
   "Buyer joinder" "Required"; "Eligible buyers" e.g. "Family offices, funds" (all four → "All professional investors").

### Price history (`SectionCard` "Price history", aside "Ordinary shares · {currency} per share · last 180 days")
Client component `band-chart.tsx` in the route's `_components`, built with Recharts:
- X axis: time over the last 180 days (sandbox time), monthly ticks "Apr", "May"…; Y axis: price in major units
  with 2 decimals, padded ±8% around the data and the last round line.
- `ReferenceArea` for the band (`fill="var(--chart-band)"`, no stroke); `ReferenceLine` at the last round price
  (`stroke="var(--ink)"`, dashed `6 4`, label "Last round (preferred) AED 42.00" top-right,
  `type-label`-sized text in `var(--ink-muted)`).
- Trades as dots (`Scatter`), radius 5; fill `var(--ink)` inside the band, `var(--chart-above)` above,
  `var(--chart-below)` below (radius 6 for those). A thin `var(--line-strong)` line connects trades in time order.
- Tooltip (`bg-surface border border-line shadow-overlay rounded-md`, custom content): "{price} · {qty} ·
  {date}".
- Grid lines `var(--line)`, axis text `var(--ink-muted)`, font inherits Plex Sans.
- Below the chart, an HTML legend exactly like the mockup: band swatch "Fair-value band (25th–75th
  percentile)", dot "Trade inside band", "Above band", "Below band", and the note "Related-party trades
  excluded. Open bids are sealed and never shown."
- Accessibility: the chart wrapper has `role="img"` and an `aria-label` summarising it ("{n} Atlas trades
  between {first date} and {last date} against a fair-value band of {band}"); a visually hidden `<table>` lists
  the same trades.
- States: hidden → `EmptyState` "The company limits who can see trade prices."; no trades → `EmptyState`
  "No Atlas trades yet. The fair value shown is an estimate from the last round."
- The read model passes `{ t: epochMs, price: number, qty: string, label: string, position: "inside"|"above"|"below" }[]`
  plus band/last-round numbers — numbers are for coordinates only.

### Value at exit (`SectionCard` "Value at exit")
Client component `value-at-exit.tsx`. The **server** precomputes the waterfall (domain `waterfall`) at
25 exit values: evenly spaced geometric steps from 0.25× to 4× the last post-money valuation (the middle,
13th step is exactly 1×; compute it from the post-money value itself, not from floating-point maths).
Each step: `{ exitLabel: "AED 462M", classes: { name, perShare: "AED 42.00", ratio: number }[] }` where
`ratio = perShare / max perShare across all steps and classes` (for bar widths). Client: a labelled slider
(`Slider`, "Exit valuation") over step indices, default the 1× step; shows `exitLabel` and one row per class
(preferred classes first, then ordinary) with name, per-share value (`type-figure`, right) and a bar
(`h-2 rounded-sm bg-surface-sunken` track, `bg-atlas-green` fill). Intro text: "Why ordinary shares can trade
below the round price: preferred shares are paid first." Footer: "Simplified model: non-participating
preferences. Guidance only, not investment advice." Hidden entirely when the company has no post-money
valuation.

### Listings (`SectionCard flush`, `id="listings"`, title "Listings", aside with `Lock` icon
"Sealed bids · reserve prices are never shown to buyers")
Rows: the company's listings in `Live`, `Closed` or `Negotiating`, plus any listing where the viewer has a bid;
ordered: viewer-involved first, then by window close ascending. Use the public listing columns only.

| Column | Content |
| --- | --- |
| Listing | ref (`font-semibold`); if the viewer has a bid: `type-body-sm text-ink-muted` "Your bid · AED 34.00" |
| Share class | class name |
| Quantity | "12,000 sh" (right) |
| Min fill | "2,000 sh" or "All or none" when min fill = quantity (right) |
| Seller | handle + `VerifiedMark label="Holding verified by company"` |
| Bid window | Live → `Deadline prefix="Closes"`; otherwise "Closed {date}" |
| Status | see below (can show two badges) |
| Action | see below |

Status and action for a **buyer** viewer:

| Situation | Badges | Action |
| --- | --- | --- |
| Viewer's bid `Countered` | warning "Countered at AED 35.50 · 41h left" (relative time via `formatRelative`, "left" suffix for the future) | primary `sm` "Respond" → `/bids` |
| Viewer's bid `Submitted`, listing Live | info "Your bid is in" | secondary `sm` "Amend" → `/listings/[id]/bid` |
| Viewer's bid `Submitted`, listing closed | info "Awaiting seller decision" | — |
| Live, no bid, access approved | info "Live" (+ warning "Closing soon" when under 48 h) | secondary `sm` "Bid" → `/listings/[id]/bid` |
| Live, no bid, no approved access | info "Live" | `type-body-sm text-ink-muted` "Request access to bid" |
| Closed / Negotiating, no bid | neutral "Window closed" | — |

Rows involving the viewer get `bg-atlas-green-soft`. Other roles see the status badges (Live / Window closed)
and no actions. Empty: "No open listings for this company right now."
Other buyers' bids, bid counts and reserve prices never appear for buyers (test this).

### Questions and answers (`SectionCard` "Questions and answers", aside "Answers are visible to every approved buyer")
- Answered entries, newest first: question (`font-semibold`), answer, `type-body-sm text-ink-muted`
  "Answered by {company name} · {date}". Divider `border-line` between entries.
- The viewer's own unanswered questions: question + `StatusBadge tone="info"` "Awaiting answer".
- Other buyers' unanswered questions are not shown.
- Buyers with approved access see the ask form (3.5). Others see `type-body-sm text-ink-muted` "Approved buyers
  can ask the company questions."

### Info pack (`SectionCard` "Info pack")
Driven by the viewer's grant:
- **none:** text "The company shares its financials and cap table with approved buyers under an NDA." and a
  secondary "Request access" button (same dialog as the header).
- **pending:** `StatusBadge tone="info"` "Awaiting company approval" and "Usually a few seconds in this demo."
  (The shell's `AutoRefresh` keeps polling because a job is pending.)
- **approved:** `StatusBadge tone="success"` "Access approved" + "NDA accepted {date}", then one row per info
  pack document (link to the viewer page, `FileText` icon, title, `type-body-sm text-ink-muted` file label).
  No documents → "The company hasn't shared documents yet."
- **denied:** `StatusBadge tone="danger"` "Access not granted" and "The company has restricted access to its
  information." — never say why.
- Company admin of this company and operators always see the document list.

## 3.5 Actions — `src/server/actions/company.ts` (+ facade `src/app/_actions/company.ts`)

**`company.requestAccess`** — input `{ companyId, ndaVersion: "v1", accepted: true }` (Zod literal `true`).
- Buyers only (`company.requestAccess`). Existing `approved`/`pending` grant → return it unchanged (idempotent).
  Existing `denied` → return it unchanged (no retry in the demo).
- Insert grant `pending`, `requestedAt = now`, `ndaVersion = "v1"`; audit `company.requestAccess`; notify
  company admins (`access_requested`).
- If auto-pilot is on and the viewer's persona is not a company admin of this company, schedule job
  `access_decision` (entity `company`, entity id = grant's company, party = a company admin of the company,
  due `now + 3 s`; store the buyer id in the job so the handler knows which grant).
  If the jobs table can't carry the buyer id with the existing columns, use `entity: "access_grant"` with the
  grant's primary key as `entity_id` — the schema must not change; report which you used.
- Revalidate the company page and `/discover`.

**`company.askQuestion`** — input `{ companyId, question: string (1–500 chars) }`.
- Requires `company.askQuestion` **and** an approved grant (else `FORBIDDEN` "Approved buyers can ask the
  company questions.").
- Run `redactMessage`; store the redacted text. If flagged, success message:
  "Contact details were removed. Keep conversations on Atlas." else "Question sent to the company."
- Notify company admins (`question_asked`); audit `company.askQuestion`.
- Rate limit: 5 per 60 s.

## 3.6 NDA dialog (client, `request-access-dialog.tsx`)

`Dialog` titled "Request access to {company}". Body: four short clauses (`type-body-sm`, ordered list):
1. "You'll keep the information confidential and use it only to evaluate a purchase on Atlas."
2. "Documents are watermarked with your identity and every view is attributable to you."
3. "You won't contact the company's employees or shareholders outside Atlas about this sale."
4. "The company may withdraw access at any time."
A `Checkbox` "I agree to the NDA (version v1)" — the primary button "Accept NDA and request access" stays
disabled until checked; `useActionState` shows pending state and errors inline. On success the dialog closes
and a toast says "Access requested. Awaiting company approval."

## 3.7 Document viewer — `src/app/(app)/companies/[slug]/documents/[documentId]/page.tsx`

- Server-side authorisation with `company.viewInfoPack` (grant looked up server-side); denied or unknown →
  `notFound()` (do not reveal existence).
- Content comes from `src/config/demo-documents.ts`, keyed by `storage_key`. Write fictional content for the
  three Falaj documents:
  - **FY2025 audited financials:** a short intro paragraph and a table (FY2025 vs FY2024): Revenue AED 38.2M /
    AED 24.9M; Gross margin 41% / 36%; EBITDA −AED 6.1M / −AED 9.4M; Cash at year end AED 52.4M / AED 31.0M;
    Employees 146 / 112. Note: "Figures are fictional and for demonstration only."
  - **Cap table summary:** generated from the company's share classes in the database (class, shares,
    % of fully diluted, original price, preference) — so it always matches the waterfall.
  - **Transfer clauses (articles):** plain-language summary generated from the transfer policy (ROFR days,
    board approval, joinder, lock-up months, minimum lot, yearly cap), headed "Summary of transfer
    restrictions".
- Layout: `PageHeader` with breadcrumbs Discover → company → document title; the document in a `surface`
  card with generous padding, `type-body` text and a table styled like the listings table.
- **Watermark:** an `aria-hidden` overlay repeating
  "Confidential · {viewer handle} · {formatDateTime(now)}" diagonally (rotate −24°, `type-label`,
  `text-ink-muted`, `opacity-15`, `pointer-events-none select-none`), plus a visible footer line:
  "Watermarked for {viewer handle} on {formatDateTime(now)}. Sharing this document breaches the NDA."
- Link from the info pack rows. Add the route to nothing else (not in navigation).

## 3.8 Auto-pilot: access decisions — `src/server/jobs/access-decision.ts`

Register `access_decision` with `registerJobHandler`. The handler (runs as the simulated company admin):
1. Loads the grant; if it is no longer `pending`, result `skipped` ("ALREADY_DECIDED").
2. Evaluates `evaluateBuyer` with the company's policy and the buyer's profile.
3. `ok` → `approved`; not ok → `denied`. Sets `decidedAt`, `decidedBy`; audit `company.decideAccess`
   (actor simulated); notifies the buyer (`access_approved` / `access_denied`).
`src/server/jobs/index.ts` imports each handler module for registration; `refresh.ts` imports that index once.

Expected with the seed: buyer_b → Wadi is **denied** (HNWI not allowed); buyer_b → Qamra is **approved**.

---

## 3.9 Tests

### Integration (`tests/integration/segment-3/`)
1. `getCompanyModel` as buyer_a for Falaj: stat values "AED 42.00", "AED 34.20–36.10", caption "From 6 trades in
   the last 180 days", last trade "AED 35.80" / "4,000 ordinary shares"; listings exactly L-2019, L-2031, L-2027
   in that order (L-2008 absent); the L-2019 row has "Your bid · AED 34.00", a "Countered at AED 35.50 · …"
   badge, action "Respond", and the highlight flag; L-2031 and L-2027 have action "Bid".
2. **No leakage:** recursively walk the model: no key contains `reserve`; no other buyer's bid price appears
   in the listings section or header (assert "AED 35.20", "AED 34.80", "AED 34.60" — buyer_c/d/e prices — are
   absent from `JSON.stringify(model.listings)` and the header/stat fields); no field exposes bid counts to a
   buyer.
3. Price visibility: remove buyer_b's Falaj grant in the test DB → buyer_b sees "Not disclosed" for band and
   last trade and no chart points; operator and company_admin always see them; Wadi (`members`) visible to a
   buyer without a grant.
4. Waterfall steps for Falaj: the 1× step has ordinary "AED 42.00"; the 0.25× step (AED 115.5M) has Series B
   "AED 42.00", Series A "AED 10.50", ordinary "AED 0.00"; there are 25 steps; ratios within 0–1.
5. `getDiscoverModel` filters: sector, stage, open listings only, matches mandates (buyer_a → Falaj only),
   invalid params ignored; Qamra shows "AED 18.50 est.".
6. `requestAccess`: buyer_b → Wadi creates `pending` + one `access_decision` job; advancing 3 s and refreshing →
   `denied` with audit actor simulated; buyer_b → Qamra → `approved`; a second request while pending returns the
   same grant (no duplicate row or job); persona company_admin requesting nothing (forbidden).
7. `askQuestion`: without a grant → `FORBIDDEN`; with a grant, "email me at a@b.co" is stored as
   "email me at [email removed]" and the message says contact details were removed; company admins notified;
   the 6th question within 60 s → `RATE_LIMITED`.
8. Document viewer authorisation (call the page's loader function directly): buyer_a sees Falaj documents with
   the watermark text containing "Investor #B-081"; buyer_b without a grant (after deleting it) → not found.

### Unit
- authz: `company.viewTradePrices` matrix (3 modes × 5 roles × participant true/false).

### E2E (`tests/e2e/buyer-discovery.spec.ts`)
1. Landing shows five persona cards with the texts above; the current one says "Current"; choosing "Holder
   #S-214" lands on `/holdings`.
2. As buyer_a: `/discover` lists three companies; "Open listings only" + Apply leaves only Falaj; the Falaj
   link opens `/companies/falaj-robotics`.
3. Company page (buyer_a): four stat cards show the expected values; the chart renders (an SVG inside the
   `role="img"` wrapper whose label mentions "6 Atlas trades"); the listings table has three rows and a
   "Respond" button; Q&A shows two answered questions; info pack shows "Access approved" and three documents.
4. Opening "FY2025 audited financials" shows the table and the watermark footer containing "Investor #B-081".
5. Moving the value-at-exit slider changes the ordinary per-share value text.
6. As buyer_b on `/companies/wadi-ledger`: Request access → dialog → the primary is disabled until the checkbox
   is ticked → submit → "Awaiting company approval" → within 15 s (auto-pilot + polling, no manual reload)
   "Access not granted".
7. As buyer_b on `/companies/qamra-health`: request → approved within 15 s; ask a question containing
   "+971 50 123 4567" → a toast mentions contact details were removed and the question shows "Awaiting answer"
   with "[phone removed]".
8. At 390 px wide, the company page has no horizontal page scroll (tables scroll inside their card).
9. No console errors on any page visited.

In `tests/e2e/foundation.spec.ts`, only delete the placeholder entries for `/discover` and `/companies/[id]`.

---

## Acceptance criteria

1. Landing, Discover, Company page, NDA request, Q&A and document viewer work with seeded data as specified,
   in both themes, at 1440 px and 390 px.
2. Buyers never receive reserve prices, other buyers' bids or bid counts; trade prices respect the company's
   visibility setting; the document viewer is server-authorised.
3. Access requests are decided by auto-pilot through the policy engine and appear without a manual reload.
4. `pnpm check` then `pnpm test:e2e` (sequentially) are green; all tests above pass.
5. Only files listed under "File ownership" changed (the report lists every changed path).
6. Report `prompts/reports/segment-3.md`, listing the exact values the company page shows for buyer_a so
   Ahmed can compare them with the mockup.

## Finish

Run `pnpm check`, then `pnpm test:e2e`. Write the report. Do not commit. Stop.
