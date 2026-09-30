# Fix A — QA blockers and high-severity issues

A full browser QA pass on the deployed site (report summarised below) found one blocker and several
high-severity issues. Fix them precisely; do not refactor beyond what each item needs.

## Before you start

1. Read `AGENTS.md`. Confirm `prompts/fix-a.md` exists in the checkout; if not, stop and tell Ahmed.
2. Work in `~/dev/atlas` on a new branch `fix-a` from `main`. Run `pnpm check`, then `pnpm test:e2e`
   (sequentially). Both must be green first.
3. Scope: you may change any file needed for the items below, including `src/server/automation.ts` and
   `src/server/refresh.ts` for A1. Off-limits: seed data, domain transition tables, schema SQL.
   List every changed path in the report.

---

## A1 (Blocker) — Auto-pilot must only move things the current persona is involved in

**Symptom:** after Reset, while viewing Buyer A for ~60 s, auto-pilot waived and settled T-1042 (Buyer B's
trade with the company). Consequences: Falaj's fair value changed (a 7th print), the Buyer B landing card
became untrue, the Company console showed "Nothing is waiting on you", and tour step 5 landed on an empty
queue. A reviewer who explores for a minute finds the headline flows already done.

**Rule:** a job is scheduled, reconciled or executed only if the **persona's user is involved** in the entity
the job acts on. Deadline-driven system events (window close, ROFR lapse, expiry) are unaffected — they
depend on time, not auto-pilot.

Implement one pure function `isPersonaInvolved(personaUser, entityFacts, jobActingRole)` in `src/lib/` (or
`src/server/automation.ts` if it needs data), fully unit-tested:

| Entity | Involved personas |
| --- | --- |
| holding | its owner; company admins of its company |
| listing | its seller; any buyer with a bid on it; company admins of its company |
| bid | its buyer; the listing's seller |
| trade | its seller; its buyer; company admins of its company |
| access grant / company job | the requesting buyer; company admins of the company |
| operators | involved in any entity, **but only for jobs whose acting role is `operator`** (listing review, escrow confirmation, release approvals) |

Apply it in: the scheduling function (don't create the job), trade reconciliation (don't reconcile), and job
execution (leave the job `pending` — the same treatment as "acting user is the persona"). Existing persona and
auto-pilot-off rules stay.

**Check every golden path still completes** (these are regression tests — integration and e2e):
- Buyer A accepts the L-2019 counter → simulated seller allocates → trade → sign → company waives → wire →
  escrow confirms → register → two approvals → Settled.
- Buyer B on T-1042 → company waives → wire → … → Settled.
- Seller counters Investor #B-352 on L-2031 → the simulated buyer accepts the counter.
- Seller submits a Wadi listing → the simulated operator approves it.
- Buyer B requests Wadi / Qamra access → simulated company decides.

**New regression tests:**
- Integration: Reset; persona buyer_a; advance sandbox time by 10 minutes and refresh → T-1042 still
  `RofrPending`, no jobs for it, Falaj band still `3420n/3580n/3610n` from 6 trades. Switch to company_admin →
  console shows 2 decisions. Persona operator → T-1042 unchanged.
- E2E: Reset → Buyer A → wait 45 s on Discover → switch to Company → "Decisions waiting" is 2 and T-1042 is
  listed.

## A2 (High) — Toolbar time controls hidden at laptop width

**Symptom:** at ~1050 px the toolbar squeezes "View as" to 139 px ("Buyer A · In") and hides +1 day / +7 days /
+30 days in an invisible sideways-scrolling strip. The tour tells users to press "+7 days".

**Fix:** remove the horizontal scroll strip from the desktop toolbar entirely. Layout by width:
- ≥ 1280 px: as now, all controls visible.
- 1024–1279 px: persona select at least 220 px wide showing the full label; the three time buttons collapse
  into one secondary `sm` button "Time" (icon `FastForward`) opening a `DropdownMenu` with "+1 day", "+7 days",
  "+30 days"; Reset, Auto-pilot and More stay visible.
- < 1024 px: the existing mobile dropdown (keep it).
Update the tour step 4 text to "Use the toolbar's time controls (+7 days)". E2E at 1054×743 and 1280×800:
every toolbar control is visible or one click away, nothing overflows, and "+7 days" works from the "Time" menu.

## A3 (High) — Bid composer validates too late

**Symptom:** quantity 1,000 (below the 2,000 minimum) shows no error; "Review bid" opens the binding
confirmation with an invalid bid; errors appear only after submit, say "Check the highlighted fields" but
nothing is highlighted, and persist after fixing the value. The first successful submit toasts "Bid updated."

**Fix:**
- Client validation (mirroring the server rules) runs on blur and on "Review bid": price > 0 with ≤ 2 decimals;
  quantity between the listing's min fill and quantity; min fill between the listing's min fill and quantity;
  rationale ≤ 500. Invalid → **don't open the confirmation**; show the message under the field
  (`aria-invalid`, `aria-describedby`, `border-danger`) and focus the first invalid field.
- Server `VALIDATION` issues map onto the same fields; each field's error clears when its value changes.
- Remove the generic "Check the highlighted fields" line unless at least one field is highlighted.
- Toasts: new bid → "Bid placed on {ref}."; amend → "Bid updated."; withdraw → "Bid withdrawn."
- Apply the same pattern to the create-listing form if it has the same gap.
- E2E: quantity 1000 → inline error "Minimum for this listing is 2,000 sh." and no dialog; fix it → the error
  disappears; submit → toast "Bid placed on L-2031."

## A4 (High) — State diagrams clipped and unreadable

**Symptom:** Listing, Bid and Trade diagrams overflow the card to the **left** (the Trade SVG is 1,678 px wide
and starts off-card, clipping "…ngFunds", "CEPT", "FAULT"); labels collide; "SUBMIT_FOR_VERIFICATION" breaks
mid-word; the Trade diagram is 1,233 px tall and mostly empty space.

**Fix:**
- The SVG must never be positioned off the left edge. Default view: **fit to the card width**
  (`width: 100%; height: auto`, preserve aspect ratio), left-aligned, at every width from 390 to 1440 px.
- Readability: disable label wrapping (no mid-word breaks); increase Mermaid `nodeSpacing`/`rankSpacing` so
  edge labels don't collide; if the installed Mermaid supports a better layout engine for state diagrams without
  a new dependency, use it; otherwise keep the default.
- Add a secondary `sm` button "Open full size" under each diagram opening a large `Dialog` (90 vw × 85 vh) where
  the diagram renders at natural size in a scrollable area that starts at the top-left.
- Keep the transition tables as they are (they are the precise reference).
- E2E at 1054 and 1440 px: for each of the four tabs, the SVG's bounding box is inside the card's bounding box
  (left ≥ card left, right ≤ card right); the full-size dialog opens and scrolls.

## A5 (High) — Security "See it" links depend on persona

**Symptom:** "Company console" → Page not found as Operator; "Listed or in trades" → empty Holdings as a buyer;
"Related-party rule" links back to the same page.

**Fix:** each "See it" becomes a small form button using the existing `switchPersona` action with the
allowlisted `next` destination, labelled with the persona it switches to, e.g. "See it as Company" /
"See it as Seller" / "See it as Operator" / "See it as Buyer B" (trade room: Buyer B's T-1042). Rows and
targets: Fake holdings → Company → `/company`; Double-selling → Seller → `/holdings`; Wash trades → Buyer A →
Falaj company page; Bid leakage → Seller → L-2031; Wire fraud, Buyer default, Account takeover → Buyer B →
T-1042's trade room; Insider abuse → Operator → `/ops/audit`; Shill bidding → plain text "Rule enforced in
createBid" (no link); Malicious uploads → "—". Extend the `next` allowlist only as needed. E2E: each button lands
on a page with the expected heading as the expected persona.

## A6 (High) — "Settled on Atlas" contradicts the company page

**Symptom:** the company console says "Settled on Atlas (180 days) AED 143,200", while the public Falaj page lists
6 Atlas trades in the same period totalling AED 528,600.

**Fix:** compute the console figure from the same source as the company page: non-related-party `trade_prints`
for the company's ordinary class in the last 180 days of sandbox time. Label "Traded on Atlas (180 days)",
caption "{n} trades". Seed expectation: AED 528,600 from 6 trades. Update tests.

## A7 (High, first impression) — Cold start and the wrong skeleton

**Symptom:** the first cold load took 3.8 s to paint, and a hard load of `/` shows the **app** skeleton (table
rows) for ~2 s before the landing appears.

**Fix:**
- Replace `src/app/loading.tsx` with a landing-shaped skeleton (logo, title bar, five card blocks) or remove it
  so the landing streams directly; app routes keep their own skeletons.
- Add `src/app/api/health/route.ts` (GET): runs `SELECT 1` through the db client, returns
  `{ "ok": true }` with `Cache-Control: no-store`; it must **not** create a sandbox or session and must not be
  rate-limited in a way that breaks a 5-minute pinger. Make sure the proxy does not mint a session for
  `/api/health`. Unit/integration test it; add it to the smoke suite.
- In the report, tell Ahmed to create a free uptime monitor that calls
  `https://atlas-marketplace-greenstone.vercel.app/api/health` every 5 minutes (keeps the function and the Neon
  database warm).

---

## Finish

Run `pnpm check`, then `pnpm test:e2e` (sequentially). Write `prompts/reports/fix-a.md` with every changed path,
what each item changed, and the new/updated tests. Do not commit. Stop.