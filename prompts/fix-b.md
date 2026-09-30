# Fix B — QA polish (medium and low findings)

Run this after `fix-a` is merged. Each item is small; keep changes minimal and consistent with the design
system. Do not refactor beyond the item.

## Before you start

1. Read `AGENTS.md`. Confirm `prompts/fix-b.md` exists in the checkout; if not, stop and tell Ahmed.
2. Work in `~/dev/atlas` on a new branch `fix-b` from `main` (which contains fix-a). Run `pnpm check`, then
   `pnpm test:e2e` (sequentially). Both must be green first.
3. Off-limits: seed data, domain transition tables, schema SQL. List every changed path in the report.

---

## B1 — Tables at laptop width (1024–1440 px)

Key columns and actions are hidden behind an in-card sideways scroll at ~1050 px. At **1024–1279 px** each of
these tables must show its action column without horizontal scrolling:
- **Discover:** hide "Last round" and "Round price" columns; show the round as a second line under the company
  name ("Series B · Mar 2026 · AED 42.00").
- **Company page listings:** hide "Share class" (show it under the listing ref); keep Status and Action.
- **My bids:** hide "Min fill" and "Total" (show total as a second line under price).
- **Bid ladder:** keep the Buyer column visible (make it sticky-left inside the scroll area if any scroll
  remains).
Below 1024 px the existing in-card scroll is acceptable. Add e2e checks at 1054 px that the action buttons are
visible without scrolling for these four tables.

## B2 — Wording, pluralisation and labels

- A shared `plural(n, singular, plural?)` helper in `src/lib/`; use it for "{n} companies", "{n} bids received",
  "{n} buyers have mandates…" (1 → "1 company", "1 bid received", "1 buyer has a mandate…") and every other
  count shown to users (grep for templates that interpolate counts).
- Discover: "Clear" must reset the checkboxes (remount the form when the query changes, e.g. `key` from the
  search params).
- Info-pack and trade document rows: file label "View only · watermarked" instead of "PDF · watermarked"
  (override in the read model). Document pages: the title appears once (h1 only).
- Holdings quantity strip: rename "Available" to "Not listed"; the eligibility line already states the yearly
  limit.
- Reserve/price parse error message: "Enter an amount like 3.00 (up to two decimal places)."
- `formatRelative` day bucket: round to the **nearest** day instead of flooring (a fresh 5-day window shows
  "in 5 days"). Update the segment-0 format tests accordingly (5 d 3 h → "in 5 days"; 4 d 23 h → "in 5 days";
  exactly 48 h → "in 2 days").
- Accept-counter dialog copy: "Your bid becomes {price} per share and stays binding. The seller proposed this
  price, so they'll confirm the sale shortly."
- Persona naming: the toolbar options and landing cards use the same labels:
  "Buyer A · Investor #B-081 · Palmgate Family Office", "Buyer B · Investor #B-117 · Individual investor",
  "Seller · Holder #S-214", "Company · Falaj Robotics CFO", "Operator · Atlas Compliance". Role labels on cards
  consistently uppercase via the `type-label` style.

## B3 — Consistency

- **Eligible buyers:** the company page and the transfer policy page show the same wording — list the types
  ("Family offices, High-net-worth individuals, Funds, Angel syndicates"); no "All professional investors"
  shortcut.
- **Round-implied estimate (Qamra):** rename the waterfall fallback everywhere from "fair value est." /
  "Estimate … from the last round" to **"Round-implied AED 18.50"**, caption "Value per share if the company
  sold at its last round's valuation. Ordinary shares usually trade at a discount to this." When a company has
  **no trades**, never say "The company limits who can see trade prices"; say "No Atlas trades yet."
- **Value at exit:** default the slider to the step closest to 0.5× the post-money valuation, and add under it:
  "At the round's valuation every class is worth the same. Lower exits show preferred shares being paid first."
- **Trade status names:** use the shared badge labels everywhere (the listing page's trades table says
  "Awaiting signatures", not "Awaiting Docs").
- **Listing stat card after allocation:** "Bids" shows "{n} accepted" (Allocated/Completed), "—" for
  Withdrawn/Expired/Rejected; never "to review" once decided.
- **Withdrawn listing:** show "Withdrawn {date}" (from its audit entry time), not a closing date.

## B4 — Access denial clarity (Wadi / Buyer B)

- After a denial, remove the header "Request access" button and the Info-pack request button; show the denial
  state only.
- If the denial is because of investor type (policy `BUYER_TYPE_NOT_ALLOWED`), say: "{company} accepts only
  {allowed types}." For restricted organisations keep the generic message.
- Don't show "Matches your mandate …" to a buyer whose policy evaluation fails.

## B5 — Trade room coherence

- Escrow card after settlement: list the events and show "Released to seller {amount} on {date}"; never
  "Nothing held yet." once funds have moved.
- Timeline: a completed step never also shows "Waiting on …"; "Funds in escrow" is attributed to
  "Escrow agent (auto-pilot)" when confirmed by the simulated operator.

## B6 — Audit log clarity

- Sandbox actions (persona switch, clock, reset, auto-pilot, ROFR mode) are attributed to **"Demo visitor"**,
  not to the persona's user; the reset entry is "Demo visitor · Demo reset" (no "Unknown actor").
  The seed entry reads "Atlas · Demo data created".
- Entity column shows refs (L-2031, T-1042) or names instead of raw UUIDs where one exists.
- One status at a time: after "Verify chain" or "Tamper", the status card reflects the latest result only (no
  stale "Chain verified" beside "Chain broken"), and the entry count in the header matches the verified count.
- Filter values display capitalised ("Holding", "Listing"…); expanded rows show times in GST via
  `formatDateTime`.

## B7 — Tour

- Step 1's panel must not cover the chart: dock the panel to the bottom-left on desktop and add a
  "Minimise" control that collapses it to a small pill ("Tour · Step 1 of 8").
- Step 3: if Buyer A has no trade in progress yet, the text says "Accept the counter in step 2 first — your
  trade appears here." and "Take me there" goes to `/bids`.

## B8 — Small visual fixes

- Chart y-axis ticks: round, evenly spaced values (e.g. every AED 1.00 or 2.00 depending on range) with the
  newest dot not touching the right edge (add padding).
- No awkward wraps: keep "AED 34.20–36.10", money values and refs like "L-2031" on one line (`whitespace-nowrap`
  on figures and refs); info-pack document names wrap normally at word boundaries.
- Operator sidebar: exactly one active item (exact-match `/ops`, prefix-match other items only when not a
  more specific nav match).
- "Company exercises ROFR" menu item aligned with the other items.
- "Skip to content" must not overlap the logo when focused (offset it); toolbar focus rings not clipped.
- My bids "Past" tab newest first; "Decline all bids" becomes a secondary button with danger text (not a
  full-width red button under Accept).

---

## Finish

Run `pnpm check`, then `pnpm test:e2e` (sequentially). Write `prompts/reports/fix-b.md` with every changed
path and what changed per item. Do not commit. Stop.