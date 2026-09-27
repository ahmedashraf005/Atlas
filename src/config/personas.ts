import { z } from "zod";
export const PERSONAS = [
  { key: "buyer_a", role: "buyer", label: "Buyer A · Investor #B-081", home: "/discover" },
  { key: "buyer_b", role: "buyer", label: "Buyer B · Investor #B-117", home: "/discover" },
  { key: "seller", role: "seller", label: "Seller · Holder #S-214", home: "/holdings" },
  {
    key: "company_admin",
    role: "company_admin",
    label: "Company admin · Falaj Robotics",
    home: "/company",
  },
  { key: "operator", role: "operator", label: "Operator · Atlas compliance", home: "/ops" },
] as const;
export type PersonaKey = (typeof PERSONAS)[number]["key"];
export const personaSchema = z.enum(["buyer_a", "buyer_b", "seller", "company_admin", "operator"]);
