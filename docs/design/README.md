# Atlas

Private shares, settled properly.

Atlas is a marketplace where shareholders of private UAE startups sell existing shares to professional investors, with the company approving every transfer. The interface should feel like a well-kept ledger: warm cream paper, dark green ink, dense tables with perfectly aligned figures, and every state of a deal visible at a glance. Calm and exact beats flashy. Nothing here should look like a crypto app or a consumer fintech.

## Principles

1. **Calm over clever.** One accent colour for action, generous whitespace around dense data, no gradients, no glass, no motion that isn't feedback.
2. **Numbers first.** Prices, quantities and deadlines are the content. They get the strongest type (`figure-lg`, `figure`), tabular numerals and right alignment.
3. **Every state is visible.** A user should never wonder whose turn it is. Each trade shows its state, its owner and its deadline.
4. **Trust is shown, not claimed.** Verification appears as a specific brass mark with who verified what and when, never as the word "secure".

## Colour

The palette is warm neutrals plus one green for action and one brass for verification. Status colours carry state and nothing else.

| Role | Tokens | Rule |
| --- | --- | --- |
| Ground | `paper`, `surface`, `surface-sunken` | Paper behind the page, surface for anything you read, sunken for headers and chrome |
| Text | `ink`, `ink-muted` | Muted for labels and metadata only, never for figures |
| Action | `atlas-green`, `atlas-green-strong`, `on-green` | One primary button per view; links use `atlas-green` with an underline on hover |
| Selection | `atlas-green-soft` | Selected rows, your own listing or bid in a shared list |
| Verification | `brass`, `brass-soft` | Only for "Verified by company", "Holding verified" and the fair-value panel. Never a button |
| Lines | `line`, `line-strong` | Hairlines separate; `line-strong` outlines controls |
| Charts | `chart-band`, `chart-above`, `chart-below` | Fair-value band in green tint; bids above it in blue, below in orange |

### Deal states

Every listing, bid and trade state maps to exactly one tone. The badge always shows the word; colour is never the only signal.

| Tone | Tokens | States |
| --- | --- | --- |
| Neutral | `surface-sunken` + `ink-muted` | Draft, Withdrawn, Expired, ROFR exercised |
| Waiting on others | `info-soft` + `info` | In review, Live, ROFR pending, Awaiting company approval, Transfer pending |
| Your move | `warning-soft` + `warning` | Countered, Awaiting docs, Awaiting funds, any deadline under 48 hours |
| Done | `success-soft` + `success` | Verified, Funded, Settled |
| Stopped | `danger-soft` + `danger` | Rejected, Cancelled, Buyer default, Disputed |

## Typography

The IBM Plex superfamily: Plex Serif for page titles and company names, Plex Sans for everything else, Plex Mono for hashes and references. It was chosen because Plex has a matching Arabic companion (Plex Sans Arabic, already in the `sans` stack), so an Arabic interface later needs no redesign. All three load from Google Fonts.

- Serif is reserved for the page title, the company name and section or card titles. Never body text, tables, buttons or labels.
- All figures use `font-variant-numeric: tabular-nums` and right alignment in tables.
- Money: currency code first, thousands separators, two decimals for per-share prices, none for totals: "AED 38.50 per share", "AED 462,000".
- Dates: "25 Sep 2026", with time as "14:30 GST" when it matters. Deadlines also show the relative form: "in 3 days".
- Shares: "12,000 shares" in prose, "12,000 sh" in tables.

## Voice

Plain, specific, and never cheerful about money. Say what happened, who acts next and by when.

| Write | Not |
| --- | --- |
| Awaiting company approval. Usually a few seconds in this demo. | Hang tight! We're working on it 🚀 |
| The company has until 25 Oct to exercise its right of first refusal. | Your trade is almost there! |
| Bid declined: below the seller's reserve. | Oops, that didn't work. |
| Holding verified by Falaj Robotics on 22 Sep 2026. | 100% secure and verified! |

All company and person names in demos are fictional.

## Layout and density

- App shell: 240px left navigation on `surface-sunken`, 56px top bar holding the demo toolbar, content up to 1280px wide on `paper` with `space-6` gutters.
- Content sits in `surface` cards with a `line` border and `radius-md`; no card shadows. Only overlays use `shadow-overlay`.
- Tables: 44px rows, `space-3` cell padding, `label` column headers on `surface-sunken`, `line` between rows, figures right-aligned.
- Spacing follows the 4px steps in the tokens; sections are `space-6` apart, cards `space-4`.

## Iconography

Lucide icons at 1.5px stroke, 16px inline and 20px in navigation, coloured `ink-muted` by default and `atlas-green` when active. Icons support labels; they never stand alone for a status. No emoji anywhere in the product.

## Accessibility

Every text pair in the tokens passes 4.5:1 in both themes; control borders, focus rings and chart marks pass 3:1. Keyboard focus is a 2px `focus-ring` outline with a 2px offset on every interactive element. The two chart colours differ in lightness as well as hue so they survive colour-blindness and greyscale printing.

## Avoid

Gradients, glassmorphism, neon, emoji, stock photos of handshakes or skylines, left-border accent cards, more than one primary button per view, brass on anything clickable, and red/green as the only way to tell two things apart.
