import {
  ArrowLeftRight,
  Briefcase,
  Compass,
  Cpu,
  FileClock,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  Tag,
  Wallet,
} from "lucide-react";
import type { Role } from "@/domain/roles";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  buyer: [
    { label: "Discover", href: "/discover", icon: Compass },
    { label: "My bids", href: "/bids", icon: Tag },
    { label: "Trades", href: "/trades", icon: ArrowLeftRight },
    { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  ],
  seller: [
    { label: "Holdings", href: "/holdings", icon: Wallet },
    { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  ],
  company_admin: [
    { label: "Console", href: "/company", icon: LayoutDashboard },
    { label: "Transfer policy", href: "/company/policy", icon: ScrollText },
    { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  ],
  operator: [
    { label: "Console", href: "/ops", icon: ShieldCheck },
    { label: "Audit log", href: "/ops/audit", icon: FileClock },
    { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  ],
};
export const FOOTER_NAV: NavItem[] = [
  { label: "Under the hood", href: "/under-the-hood", icon: Cpu },
];
