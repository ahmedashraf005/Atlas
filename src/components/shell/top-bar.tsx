import { Clock } from "lucide-react";
import { DemoControls } from "@/components/shell/demo-controls";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarContent } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DEMO_VIEWER } from "@/config/demo-viewer";
import { formatDateTime } from "@/lib/format";

export function TopBar({ now, theme }: { now: Date; theme: "light" | "dark" }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface-sunken px-4 lg:px-8">
      <MobileNav>
        <SidebarContent viewer={DEMO_VIEWER} />
      </MobileNav>
      <span className="type-label rounded-sm border border-line-strong px-2 py-0.5 text-ink-muted">
        DEMO
      </span>
      <DemoControls />
      <div className="ml-auto flex shrink-0 items-center gap-4 type-body-sm text-ink-muted">
        {/* TODO(segment-2): read from sandbox */}
        <span className="hidden items-center gap-1.5 md:flex">
          <span className="size-2 shrink-0 rounded-full bg-success" />
          <span className="max-w-16">Auto-pilot on</span>
        </span>
        <span className="hidden items-center gap-1.5 md:flex">
          <Clock size={16} strokeWidth={1.5} className="shrink-0" aria-hidden />
          <span className="max-w-32 tabular-nums">Sandbox time {formatDateTime(now)}</span>
        </span>
        <ThemeToggle theme={theme} />
      </div>
    </header>
  );
}
