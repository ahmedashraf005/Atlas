import "server-only";
import type { PersonaKey } from "@/config/personas";
import { sources } from "@/domain/machine";
import { MACHINES } from "@/domain/machines";
import { toMermaid } from "@/domain/mermaid";
import { getPublicRepoUrl } from "@/env";
import { type Database, getDb } from "@/server/db/client";
import * as discovery from "@/server/repositories/discovery";
import * as trades from "@/server/repositories/trades";
import type { Viewer } from "@/server/viewer";
export const ARCHITECTURE = `flowchart TD
  Pages[Pages] --> Actions[Server actions: validate and authorise]
  Actions --> Domain[Pure domain core]
  Domain --> Repositories[Sandbox-scoped repositories]
  Repositories --> Postgres[Postgres]
  Actions --> Audit[Hash-chained audit log]
  Audit --> Postgres`;
export const ARCHITECTURE_FACTS = [
  "One Next.js app; business rules in pure TypeScript",
  "Every change is a server action that validates, authorises and writes an audit entry in one transaction",
  "Money is integer minor units; no floating point",
  "Each visitor gets an isolated sandbox with its own clock",
  "Simulated counterparties use the same state transitions as people",
];
export async function getUnderTheHoodModel(viewer: Viewer, database?: Database) {
  const db = database ?? (await getDb()),
    repoUrl = getPublicRepoUrl();
  const [ls, ts, buyerBTrade] = await Promise.all([
    discovery.publicListings(db, viewer.sandboxId),
    trades.visibleRows(db, viewer.sandboxId, viewer.actor),
    trades.findByRef(db, viewer.sandboxId, "T-1042"),
  ]);
  const listing = ls.find((l) => l.ref === "L-2031"),
    trade = ts.find((t) => t.status !== "Settled") ?? ts[0];
  const listingHref = listing ? `/listings/${listing.id}` : "/holdings",
    tradeHref = trade ? `/trades/${trade.id}` : "/trades",
    buyerBTradeHref = buyerBTrade ? `/trades/${buyerBTrade.id}` : "/trades";
  const diagrams = {
    holding: toMermaid(MACHINES.holding),
    listing: toMermaid(MACHINES.listing),
    bid: toMermaid(MACHINES.bid),
    trade: toMermaid(MACHINES.trade),
  };
  return {
    machines: Object.entries(MACHINES).map(([kind, m]) => ({
      kind,
      label: kind[0]?.toUpperCase() + kind.slice(1),
      text: diagrams[kind as keyof typeof diagrams],
      count: `${m.states.length} states · ${m.rows.reduce((n, r) => n + sources(r.from).length, 0)} transitions · generated from src/domain/${kind}.ts`,
      rows: m.rows.flatMap((r) =>
        sources(r.from).map((from) => ({
          from,
          event: r.event,
          to: r.to,
          roles: r.roles.join(", "),
        })),
      ),
    })),
    steps: [
      { text: "The shareholder records their existing shares.", href: "/holdings" },
      { text: "The company verifies the holding against its register.", href: "/company" },
      {
        text: "The seller creates a listing; Atlas checks it before the window opens.",
        href: "/holdings",
      },
      {
        text: "Buyers review company information and accept an NDA for access.",
        href: "/companies/falaj-robotics",
      },
      {
        text: "Professional investors place binding sealed bids.",
        href: listing ? `${listingHref}/bid` : "/discover",
      },
      {
        text: "After the window closes, the seller counters or allocates bids.",
        href: listingHref,
      },
      { text: "The seller and buyer sign the transfer agreement.", href: tradeHref },
      {
        text: "The company waives, exercises or refuses the transfer under its right of first refusal.",
        href: "/company",
      },
      { text: "The buyer sends payment to the trade's locked escrow account.", href: tradeHref },
      { text: "The company updates the register; two operators approve release.", href: "/ops" },
      {
        text: "Shares and money settle; the audit chain records every change.",
        href: "/ops/audit",
      },
    ],
    controls: [
      {
        threat: "Fake holdings",
        control: "Company verification",
        href: "/company",
        see: "See it as Company",
        persona: "company_admin",
      },
      {
        threat: "Double-selling",
        control: "Share reservation and database CHECK",
        href: "/holdings",
        see: "See it as Seller",
        persona: "seller",
      },
      {
        threat: "Shill bidding",
        control:
          "A seller cannot sell to an organisation they beneficially own. createBid enforces the related-party block.",
        href: null,
        see: "Rule enforced in createBid",
      },
      {
        threat: "Wash trades",
        control: "Related-party prints excluded",
        href: "/companies/falaj-robotics",
        see: "See it as Buyer A",
        persona: "buyer_a",
      },
      {
        threat: "Bid leakage",
        control: "Sealed bids until the window closes",
        href: listingHref,
        see: "See it as Seller",
        persona: "seller",
      },
      {
        threat: "Wire fraud",
        control: "Locked payment instructions and message warnings",
        href: buyerBTradeHref,
        see: "See it as Buyer B",
        persona: "buyer_b",
      },
      {
        threat: "Buyer default",
        control: "Funding deadline and backup bid",
        href: buyerBTradeHref,
        see: "See it as Buyer B",
        persona: "buyer_b",
      },
      {
        threat: "Account takeover",
        control: "Simulated passkey step-up confirmation",
        href: buyerBTradeHref,
        see: "See it as Buyer B",
        persona: "buyer_b",
      },
      {
        threat: "Insider abuse",
        control: "Two-operator release and hash-chained audit",
        href: "/ops/audit",
        see: "See it as Operator",
        persona: "operator",
      },
      {
        threat: "Malicious uploads",
        control: "Described only: production would scan and watermark uploads",
        href: null,
        see: "",
      },
    ] satisfies {
      threat: string;
      control: string;
      href: string | null;
      see: string;
      persona?: PersonaKey;
    }[],
    architecture: ARCHITECTURE,
    facts: ARCHITECTURE_FACTS,
    repoUrl,
    buildLogUrl: repoUrl ? `${repoUrl}/blob/main/docs/BUILD-LOG.md` : null,
  };
}
export type UnderTheHoodModel = Awaited<ReturnType<typeof getUnderTheHoodModel>>;
