import type { PersonaKey } from "@/config/personas";
export const TOUR_STEPS: readonly {
  persona?: PersonaKey;
  href: string;
  title: string;
  text: string;
}[] = [
  {
    persona: "buyer_a",
    href: "/companies/falaj-robotics",
    title: "A company on Atlas",
    text: "See reference prices from real trades, the value-at-exit model and sealed listings. Reserve prices and other bids are never shown.",
  },
  {
    persona: "buyer_a",
    href: "/bids",
    title: "Answer a counter",
    text: "The seller countered your AED 34.00 bid at AED 35.50. Accept it and watch the simulated seller accept your bid.",
  },
  {
    persona: "buyer_a",
    href: "/trades",
    title: "Your trade",
    text: "Open the new trade, sign the agreement and pay into escrow. Auto-pilot plays the company and operators; every step lands in the timeline.",
  },
  {
    persona: "seller",
    href: "/holdings",
    title: "Selling shares",
    text: 'Eligibility comes from the company\'s transfer policy. Open L-2031: bids stay sealed until the window closes. Use "+7 days", then counter or accept.',
  },
  {
    persona: "company_admin",
    href: "/company",
    title: "The company decides",
    text: "Verify holdings, approve buyers and decide on the right of first refusal from one queue. Open a trade to make its transfer decision.",
  },
  {
    persona: "operator",
    href: "/ops",
    title: "Operations",
    text: "Review listings, confirm escrow and approve releases. Two different operators must approve before money moves.",
  },
  {
    persona: "operator",
    href: "/ops/audit",
    title: "Proof, not promises",
    text: "Verify the hash chain, then tamper with an entry and watch verification catch it. Reset the demo afterwards.",
  },
  {
    href: "/under-the-hood",
    title: "Under the hood",
    text: "Explore state machines drawn from the code and the security model. Each control links to where you can see it.",
  },
];
export function allowedNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^(?:\/(?:discover|bids|trades|holdings|company|ops|portfolio|under-the-hood)|\/company\/policy|\/ops\/audit|\/companies\/[a-z0-9]+(?:-[a-z0-9]+)*|\/trades\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/bid)?)$/.test(
    value,
  )
    ? value
    : null;
}
export function readTourStep(value: string | null): number | null {
  if (value === null) return null;
  try {
    const step: unknown = JSON.parse(value);
    return typeof step === "number" &&
      Number.isInteger(step) &&
      step >= 0 &&
      step < TOUR_STEPS.length
      ? step
      : null;
  } catch {
    return null;
  }
}
