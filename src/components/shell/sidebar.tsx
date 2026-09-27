import Link from "next/link";
import { Logo } from "@/components/atlas/logo";
import { NavLink } from "@/components/shell/nav-link";
import { FOOTER_NAV, NAV_BY_ROLE } from "@/config/navigation";
import { ROLE_LABELS, type Role } from "@/domain/roles";

export type Viewer = { role: Role; handle: string; subtitle: string };

export function SidebarContent({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <Link href="/" className="px-2">
        <Logo />
      </Link>
      <div className="rounded-md border border-line bg-surface px-3 py-2.5">
        <div className="type-label text-ink-muted">Signed in as {ROLE_LABELS[viewer.role]}</div>
        <div className="type-body-sm font-semibold">{viewer.handle}</div>
        <div className="type-label font-normal text-ink-muted">{viewer.subtitle}</div>
      </div>
      <div className="flex flex-col gap-0.5">
        {NAV_BY_ROLE[viewer.role].map(({ icon: Icon, ...item }) => (
          <NavLink key={item.href} {...item} icon={<Icon strokeWidth={1.5} aria-hidden />} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-4">
        {FOOTER_NAV.map(({ icon: Icon, ...item }) => (
          <NavLink key={item.href} {...item} icon={<Icon strokeWidth={1.5} aria-hidden />} />
        ))}
        <p className="type-label font-normal text-ink-muted px-2">
          Demo sandbox · all companies and people are fictional
        </p>
      </div>
    </>
  );
}

export function Sidebar({ viewer }: { viewer: Viewer }) {
  return (
    <nav
      aria-label="Main"
      className="hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface-sunken px-4 py-5 sticky top-0 h-dvh"
    >
      <SidebarContent viewer={viewer} />
    </nav>
  );
}
