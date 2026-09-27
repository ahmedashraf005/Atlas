# Segment 4 — Seller: holdings and listings

## Goal

Build the seller's side up to a live listing: the **Holdings** page (verification state, transfer-policy
eligibility with plain-English reasons, reference prices, demand signal), **Add holding** (company
verification via auto-pilot), **Create listing** (form → review → submit, shares reserved, operator review
via auto-pilot), the seller's **Your listings** table, and **Withdraw**.

This segment runs **in parallel with segment 3** in a separate git worktree. Stay strictly inside the scope
and file ownership below so the two branches merge cleanly.

## Before you start

1. Read `AGENTS.md`, `docs/design/README.md`, `docs/design/company-page.html` (visual reference for density,
   cards, tables and badges) and `prompts/reports/segment-2.md`.
2. You are in the worktree `~/dev/atlas-seg4` on branch `seg-4`. Run `pnpm check`, **then**
   `E2E_PORT=3200 pnpm test:e2e` — but first do task 4.0 so the port variable works. Both must be green before
   feature work; if not, stop and report.

## File ownership (parallel-safety rules)

You may create or change:
- `playwright.config.ts` (task 4.0 only)
- `src/app/(app)/holdings/**` (including `holdings/[id]/list/**`)
- `src/app/_actions/holdings.ts`, `src/server/actions/holdings.ts`
- `src/server/read/holdings.ts`, `src/server/read/create-listing.ts`
- New components in `src/components/atlas/` named in this prompt, and `src/app/(app)/holdings/**/_components/**`
- Tests under `tests/integration/segment-4/**`, `tests/unit/**` (new files only),
  `tests/e2e/seller-listing.spec.ts`, and in `tests/e2e/foundation.spec.ts` **only** delete the placeholder
  entries for `/holdings` and `/holdings/[id]/list`.

Do **not** touch: `src/domain/**`, `src/server/automation.ts`, `src/server/refresh.ts`, `src/server/jobs/**`,
the schema/migrations, the seed, the shell, company/discover routes, `src/server/actions/demo.ts`.
If you believe one of these must change, stop and report instead.

## Conventions (segment 3 introduces the same ones in parallel)

- **Server action facades** live in `src/app/_actions/<area>.ts`, start with `"use server"`, and only re-export
  actions built with `defineAction` from `src/server/actions/<area>.ts`.
- **Read models** live in `src/server/read/<area>.ts`, take the `Viewer`, and return **display-ready view
  models**: every user-facing value is a preformatted string. No `bigint` leaves a read model. Where a client
  component must do arithmetic (the live total in 4.4), pass **decimal strings of minor units** and convert with
  `BigInt()` on the client; never `Number()` on money.
- Pages are Server Components that call a read model and render.

## Dependencies

None.

---

## 4.0 E2E port — `playwright.config.ts`

Make the port configurable: `const port = Number(process.env.E2E_PORT ?? 3100)` used for `baseURL`,
`webServer.url` and the `-p` argument of the start command. Default behaviour (3100) must not change.
Also make the PGlite e2e directory port-specific (`.pglite/e2e-${port}`) so two worktrees never share a
directory, keeping the global-setup deletion. Run the full e2e suite once with the default port and once with
`E2E_PORT=3200` to prove both work.

## 4.1 Holdings page — `src/app/(app)/holdings/page.tsx`

`getHoldingsModel(viewer)` in `src/server/read/holdings.ts`. Shows the **viewer's own** holdings (any role;
navigation only links it for sellers).

**Header** (`PageHeader`): title "Holdings"; meta `type-body text-ink-muted` "Shares you can sell on Atlas.
The company verifies every holding before it can be listed."; action: primary "Add holding" (dialog, 4.3).

**One card per holding** (`holding-card.tsx`), ordered: verified and eligible first, then verified but not
eligible, then pending, then rejected; within a group by company name. Card layout (`bg-surface border
border-line rounded-md`):

1. **Header row** (`px-5 py-4 flex items-center justify-between border-b border-line`): company name as
   `type-title` link to `/companies/[slug]`, then `type-body-sm text-ink-muted` "{class name} shares";
   right side a state badge:
   - `Verified` → `VerifiedBadge` "Verified by {company}"
   - `PendingCompany` → `StatusBadge tone="info"` "Awaiting company verification"
   - `Unverified` → `StatusBadge tone="neutral"` "Not submitted"
   - `Rejected` → `StatusBadge tone="danger"` "Rejected" (reason shown in the body)
2. **Quantity strip** (4 columns, `p-5`, each: `type-label text-ink-muted` label + `type-figure` value):
   "Total" `30,000 sh` · "Listed or in trades" `12,000 sh` (= reserved) · "Sold" `0 sh` · "Available"
   `18,000 sh`.
3. **Eligibility panel** (`eligibility-panel.tsx`, `px-5 pb-5`), from `evaluateSellerEligibility` with
   `soldInLast12Months = holdings.committedQty(...)` (the segment-2 repository function — do not re-implement):
   - Eligible: a line with `CircleCheck` in `text-success`: **"You can sell up to {maxSellable prose} now."**
     then a compact definition list (`type-body-sm`, two columns): "Yearly limit" "{cap prose} ({pct}%)" ·
     "Already committed" "{committed prose}" · "Minimum lot" "{minLot prose}" · "Right of first refusal"
     "{n} days".
   - Not eligible: a line with `CircleAlert` in `text-warning`: "You can't list these shares yet." then each
     failure message from the policy engine as a list item (`type-body-sm`), then, if `nextEligibleAt`,
     `type-body-sm text-ink-muted` "Earliest date you can list: {date}".
   - Pending: "The company is checking this holding against its share register. Usually a few seconds in this
     demo." Rejected: "Rejected by the company: {reason}" plus a secondary `sm` "Resubmit" button (4.6).
4. **Market context row** (verified holdings only; `px-5 pb-5 flex flex-wrap gap-x-8 gap-y-2 type-body-sm`):
   - Reference price: with trade prices visible → "Fair value {band}" · "Last trade {price}"; waterfall →
     "Estimate {price} from the last round"; none → "No price reference yet". Visibility follows the same rule
     as segment 3 (`members` anyone; `participants` includes shareholders — the seller always qualifies because
     they hold shares; `operator` → hidden, show the estimate instead). Implement the rule locally in the read
     model as a small pure helper with a unit test; do **not** edit `authz.ts` (segment 3 adds the shared action
     in parallel; the merge will reconcile them — note this in the report).
   - Demand: `Users` icon + "{n} buyers have mandates matching {company}" (from `mandates.demandCount`;
     "No buyers with matching mandates yet" when 0; "1 buyer has…" singular).
5. **Actions** (`px-5 pb-5`): eligible → secondary "List shares" → `/holdings/[id]/list`. No other actions.

Expected with the seed (seller): Falaj eligible "up to 3,000 shares", yearly limit "15,000 shares (50%)",
committed "12,000 shares", market "Fair value AED 34.20–36.10 · Last trade AED 35.80", demand 4;
Wadi eligible "up to 10,000 shares", "Fair value USD 2.95–3.30 · Last trade USD 3.30", demand 2;
Qamra not eligible with exactly two reasons — the lock-up message and "Sales are paused until {date}
(Series B fundraising)." — and "Estimate AED 18.50 from the last round", demand 1.
Note: Wadi's last trade is the most recent print (30 days ago, USD 3.30).

**Your listings** (`SectionCard flush` titled "Your listings", below the cards; hidden when empty):

| Column | Content |
| --- | --- |
| Listing | ref (`font-semibold`), link to `/listings/[id]` |
| Company | name + `type-body-sm text-ink-muted` class |
| Quantity | "12,000 sh" (right) |
| Min fill | "2,000 sh" / "All or none" (right) |
| Reserve | "AED 34.00" (right) — the seller's own listing, so the owner view is allowed |
| Window | Live → `Deadline prefix="Closes"`; not yet open → "Opens after review"; closed → "Closed {date}" |
| Bids | Live → "{n} sealed" (count only); Closed/Negotiating → "{n} to review"; otherwise "—" |
| Status | see below |
| Action | Draft/InReview/Live → secondary `sm` "Withdraw" (4.5); Closed/Negotiating → primary `sm` "Review bids" → `/listings/[id]` |

Status badges: Draft neutral "Draft"; InReview info "Awaiting Atlas review"; Live info "Live" (+ warning
"Closing soon" under 48 h); Closed warning "Window closed · your move"; Negotiating warning "Negotiating";
Allocated success "Bids accepted"; Completed success "Completed"; Expired neutral "Expired"; Withdrawn neutral
"Withdrawn"; Rejected danger "Rejected by Atlas". Ordered: needs-action first (Closed, Negotiating), then Live,
InReview, Draft, then the rest by date.

One primary button per view: when any row shows "Review bids", render only the **first** such row's button as
primary and the others as secondary; the header "Add holding" becomes secondary in that case.

## 4.2 Empty and edge states

- No holdings at all → `EmptyState` "You don't hold any shares on Atlas yet." with the "Add holding" button.
- A holding fully sold or fully committed → eligibility shows the policy engine's message; no list button.

## 4.3 Add holding — dialog + action

**Dialog** (`add-holding-dialog.tsx`, client, `Dialog` titled "Add a holding"):
- "Company" `Select` (all companies in the sandbox).
- "Share class" `Select`, options filtered to the chosen company (the model provides classes per company);
  disabled until a company is chosen.
- "Number of shares" `Input` (`inputMode="numeric"`), parsed on the server with `parseSharesInput`.
- "Date acquired" `Input type="date"`, max = sandbox today.
- "Evidence" `Select`: "Share certificate" / "Cap table extract", with helper text
  `type-body-sm text-ink-muted`: "In this demo no file is uploaded. The company checks the holding against its
  register."
- Primary "Submit for verification"; `useActionState` shows field errors from `issues` under each field
  (`aria-describedby`) and a general error line for other codes. Success closes the dialog, toasts "Holding
  submitted. The company is verifying it.", and the list shows the pending card.

**Action `holding.create`** (input: `companyId`, `shareClassId`, `quantity` string, `acquiredOn` ISO date,
`evidence` enum):
- `holding.create` authz (sellers only; other roles `FORBIDDEN`).
- Validation (`VALIDATION` issues by field): class belongs to company; quantity parses and is
  `<= class shares outstanding` ("That's more than the {n} {class} shares the company has issued.");
  `acquiredOn <= sandbox today` ("The acquisition date can't be in the future.").
- `createHolding` then `runTransition(holding, "SUBMIT_FOR_VERIFICATION")` in the same transaction (the
  existing automation schedules the company's `VERIFY` job unless the persona is that company's admin).
- Revalidate `/holdings`.

**Resubmit (4.6)** — action `holding.resubmit` (input `holdingId`): `runTransition(holding, "RESUBMIT")`.

## 4.4 Create listing — `src/app/(app)/holdings/[id]/list/page.tsx`

`getCreateListingModel(viewer, holdingId)` in `src/server/read/create-listing.ts`. Not the viewer's holding or
unknown → `notFound()`. Not verified or not eligible → the page shows `PageHeader` "List shares" and an
`EmptyState` with the policy reasons and a link "Back to holdings".

**Layout:** `PageHeader` with breadcrumbs Holdings → "List {company} shares", title "List shares"; body grid
`lg:grid-cols-[2fr_1fr]` gap 6.

**Left: the form** (`create-listing-form.tsx`, client) in a `SectionCard` "Listing details", two steps in one
component (no route change):

*Step 1 — details*
| Field | Control | Default | Helper (`type-body-sm text-ink-muted`) |
| --- | --- | --- | --- |
| Quantity | `Input` numeric | maxSellable | "Up to {maxSellable} · minimum lot {minLot}" |
| Minimum fill | `Input` numeric | minLot | "The smallest amount one buyer can take." |
| Reserve price per share | `Input` with a currency prefix label ("AED"/"USD") | empty | "Hidden from buyers. Bids below it can still be countered." |
| Bid window | radio group 3 / 5 / 7 days | 5 | "Buyers bid privately until the window closes." |

Live panel under the fields (updates as the user types, client-side with `BigInt`): "At your reserve:
{qty} × {price} = {total}" using the same formatting rules as `formatMoney` (import the formatter from
`src/lib/format.ts`; it is framework-free), and a comparison line against the band midpoint:
"{x}% below / above the fair-value midpoint" or "Within the fair-value band" (use `diffBps` from the domain;
it is pure). Invalid input → the panel shows "—".

Client-side validation mirrors the server rules for fast feedback (quantity 1–maxSellable, min fill between
min lot and quantity, reserve > 0 with at most 2 decimals); the server remains authoritative.
Secondary "Cancel" (link to `/holdings`) and primary "Review listing" (validates, then step 2).

*Step 2 — review*
- Summary list: Company and class; Quantity; Minimum fill; Reserve (with "Hidden from buyers"); Bid window
  "{n} days after approval"; "At reserve" total.
- "What happens next" ordered list:
  1. "Atlas reviews the listing. Usually a few seconds in this demo."
  2. "Approved buyers bid privately for {n} days."
  3. "You review the sealed bids, can counter up to three, and accept one or more."
  4. "{company} has {rofrDays} days to buy the shares itself at the same price (right of first refusal)."
  5. "The buyer pays into escrow; you're paid once the company updates its share register."
- `Checkbox` "I confirm I own these shares and they are free of any other claim." (required).
- Secondary "Back" (to step 1, values kept) and primary "Submit for review" (disabled until the checkbox is
  ticked; loading state while pending).
- Errors: `VALIDATION` issues go back to step 1 with field errors; `POLICY_BLOCKED` shows the failure messages
  in a `danger-soft` box on step 2; other errors a single line.
- Success → `router.push("/holdings")` and toast "Listing {ref} submitted for review."

**Right column** (`SectionCard` "Market context"): `Figure` "Last round price"; the fair-value `Figure` with
`verifiedHeader="Fair-value band · {class}"` (or estimate/hidden variants as in 4.1); "Last Atlas trade";
demand line; and a note `type-body-sm text-ink-muted`: "Reference prices help you set a reserve. They don't
limit what buyers can bid."

**Action `listing.create`** (input: `holdingId`, `quantity`, `minFill`, `reservePrice` (string),
`windowDays` 3|5|7, `confirmedOwnership: true`, `clientRequestId` uuid):
1. Parse money with `parseMoneyInput`, quantities with `parseSharesInput` (field issues on failure).
2. `createListing` (Draft, new id, ref from `refs.next("L")`, `createdAt = now`).
3. `evaluateListing` with the company policy and `committedQty`.
4. Insert the draft, then `runTransition(listing, "SUBMIT", { policyResult })` — reserves shares and schedules
   the operator review job. Any failure rolls back the whole transaction (no orphan draft).
5. **Double-submit protection:** if a listing was already created in this sandbox with the same
   `clientRequestId` in the last 10 minutes, return that listing instead of creating another. Without a schema
   change, implement it by recording the `clientRequestId` in the audit entry of the `listing.create` step
   (`action: "listing.create"`, `after.clientRequestId`) and checking the audit log before creating; report the
   approach. The client generates the id once per form mount.
6. Return `{ ref, listingId }`; revalidate `/holdings`.

## 4.5 Withdraw — action `listing.withdraw`

Input `{ listingId }`. `runTransition(listing, "WITHDRAW")` (releases shares and rejects active bids through
the effects). The button opens a `ConfirmDialog` (tone danger): title "Withdraw {ref}?", description
"Any bids are rejected and your {qty} become available again. You can't undo this.", confirm "Withdraw
listing". Guard failures show the domain message in a toast (e.g. trying after the window closed).
Revalidate `/holdings`.

---

## 4.7 Tests

### Integration (`tests/integration/segment-4/`)
1. `getHoldingsModel` for seller: three cards in the order Falaj, Wadi (eligible, alphabetical), Qamra (not
   eligible); every value from the "Expected with the seed" paragraph matches exactly; Your listings shows
   L-2031 with reserve "AED 34.00", bids "2 sealed", action "Withdraw".
2. Visibility helper: seller sees Falaj band (participant), Wadi band (members), Qamra estimate (operator
   visibility); unit-tested separately too.
3. `holding.create`: validation issues (class of another company, more shares than issued, future date, bad
   number); success → `PendingCompany`, one `VERIFY` job for `wadi_admin` when adding a Wadi holding; advancing
   3 s → `Verified`; as persona `company_admin` adding a Falaj holding is `FORBIDDEN` (sellers only).
4. `listing.create` on Wadi (5,000 sh, min 2,000, USD 3.00, 5 days): listing `InReview`, ref `L-3001`,
   `h_seller_wadi.reservedQty = 5000`, one `APPROVE` job for `operator_second`; after 3 s `Live` with
   `windowClosesAt = approval time + 5 days`. Then a second Wadi listing for 5,001 → `POLICY_BLOCKED`
   (`QUANTITY_ABOVE_MAX`); min fill 1,000 on Wadi → `POLICY_BLOCKED` (`MIN_FILL_BELOW_MIN_LOT`); reserve
   "3.005" → `VALIDATION`.
5. Falaj: listing 3,000 succeeds; a further 1,000 → blocked (yearly cap reached: committed 15,000).
6. Qamra listing attempt → `POLICY_BLOCKED` with the lock-up and blackout failures; no rows written.
7. Double submit with the same `clientRequestId` returns the same listing; only one listing and one
   reservation exist.
8. Withdraw L-2031 → `Withdrawn`, both bids `Rejected`, `reservedQty` back to 0 for 12,000, audit entries for
   the listing and both bids; withdrawing it again → `INVALID_TRANSITION` message surfaced.
9. Another user's holding id (seller_2's) → create listing `NOT_FOUND`; buyer persona calling
   `listing.create` → `FORBIDDEN`.

### Unit
- Live panel maths helper (pure function the form uses): total and comparison text for sample inputs, invalid
  inputs → "—".
- Holdings ordering helper and listing status → badge mapping (every `ListingStatus` covered).

### E2E (`tests/e2e/seller-listing.spec.ts`, run with `E2E_PORT=3200`)
1. Switch to Seller: `/holdings` shows three cards; Falaj "You can sell up to 3,000 shares now."; Qamra shows
   "You can't list these shares yet." with two reasons; demand lines visible.
2. Add holding: Wadi Ledger → Ordinary → 1,000 → a past date → submit → card "Awaiting company verification"
   → within 15 s, without reloading, it shows "Verified by Wadi Ledger".
3. Create listing on Wadi: defaults prefilled; type reserve "3.00" → the live panel shows the total
   "USD 30,000" for 10,000 shares; change quantity to 5,000 → "USD 15,000"; Review → summary correct; the
   submit button is disabled until the confirmation is ticked; submit → back on `/holdings`, toast with the new
   ref, the row shows "Awaiting Atlas review" → within 15 s "Live" with a "Closes … in 5 days" deadline.
4. Client validation: reserve "abc" shows a field error and blocks "Review listing".
5. Withdraw the new listing through the confirmation dialog → status "Withdrawn"; the Wadi card's available
   quantity is back to the full amount.
6. Qamra has no "List shares" button; visiting `/holdings/<qamra holding id>/list` shows the reasons and
   "Back to holdings".
7. At 390 px wide, holdings and the create-listing form are usable with no horizontal page scroll.
8. No console errors on any page visited.

In `tests/e2e/foundation.spec.ts`, only delete the placeholder entries for `/holdings` and
`/holdings/[id]/list`.

---

## Acceptance criteria

1. Holdings, Add holding, Create listing (both steps), Your listings and Withdraw work with seeded data as
   specified, in both themes, at 1440 px and 390 px.
2. Policy results come only from the domain engine with committed quantity; money and shares are parsed with
   the domain parsers; no `Number()` on money anywhere (client included).
3. Auto-pilot verifies holdings and approves listings, visible without a manual reload.
4. `pnpm check`, then `pnpm test:e2e` and `E2E_PORT=3200 pnpm test:e2e` (sequentially) are green.
5. Only files listed under "File ownership" changed (the report lists every changed path).
6. Report `prompts/reports/segment-4.md`, including the double-submit approach and the visibility helper note
   for the merge.

## Finish

Run `pnpm check`, then `E2E_PORT=3200 pnpm test:e2e`. Write the report. Do not commit. Stop.
