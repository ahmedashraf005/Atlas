import "server-only";
import { PERSONAS } from "@/config/personas";
import type { Viewer } from "@/server/viewer";

const copy = {
  buyer_a: {
    title: "Investor #B-081 · Palmgate Family Office",
    description: "Browse companies, bid on listings and respond to a seller's counter.",
  },
  buyer_b: {
    title: "Investor #B-117 · individual investor",
    description: "Has a trade waiting on the company's right of first refusal.",
  },
  seller: {
    title: "Holder #S-214",
    description: "List shares, review sealed bids, counter and accept.",
  },
  company_admin: {
    title: "Falaj Robotics · CFO",
    description: "Verify holdings, approve buyer access and decide on the right of first refusal.",
  },
  operator: {
    title: "Atlas compliance",
    description: "Review listings, release escrow with a second approver and verify the audit log.",
  },
};
export function getLandingModel(viewer: Viewer) {
  return PERSONAS.map((p) => ({ ...p, ...copy[p.key], current: p.key === viewer.persona }));
}
