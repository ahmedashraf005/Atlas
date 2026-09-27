export const ROLES = ["seller", "buyer", "company_admin", "operator"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  seller: "seller",
  buyer: "buyer",
  company_admin: "company admin",
  operator: "operator",
};
export type ActorRole = Role | "system";
export interface Actor {
  userId: string;
  role: ActorRole;
  orgId: string | null;
  sandboxId: string;
  simulated: boolean;
}
export const SYSTEM_ACTOR = (sandboxId: string): Actor => ({
  userId: "system",
  role: "system",
  orgId: null,
  sandboxId,
  simulated: false,
});
