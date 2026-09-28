import type { InvestorType, PriceVisibility } from "@/domain/types";
export const INVESTOR_LABELS: Record<InvestorType, string> = {
  family_office: "Family offices",
  hnwi: "High-net-worth individuals",
  fund: "Funds",
  angel_syndicate: "Angel syndicates",
};
export const VISIBILITY_LABELS: Record<PriceVisibility, string> = {
  operator: "Operators and your company only",
  participants: "Participants in your company",
  members: "All verified members",
};
