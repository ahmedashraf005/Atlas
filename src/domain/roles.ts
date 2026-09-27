export const ROLES = ["seller", "buyer", "company_admin", "operator"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  seller: "seller",
  buyer: "buyer",
  company_admin: "company admin",
  operator: "operator",
};
