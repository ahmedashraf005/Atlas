import { Clock } from "lucide-react";
import { DemoControls } from "@/components/shell/demo-controls";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { SidebarContent } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { formatDateTime } from "@/lib/format";
import type { NotificationsModel } from "@/server/read/notifications";
import type { Viewer } from "@/server/viewer";

export function TopBar({
  viewer,
  theme,
  notifications,
}: {
  viewer: Viewer;
  theme: "light" | "dark";
  notifications: NotificationsModel;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface-sunken px-4 lg:px-8">
      <MobileNav>
        <SidebarContent viewer={viewer.user} />
      </MobileNav>
      <span className="type-label rounded-sm border border-line-strong px-2 py-0.5 text-ink-muted">
        DEMO
      </span>
      <DemoControls
        persona={viewer.persona}
        autopilot={viewer.autopilot}
        rofrMode={viewer.rofrMode}
      />
      <div className="ml-auto flex shrink-0 items-center gap-4 type-body-sm text-ink-muted">
        <span className="hidden items-center gap-1.5 min-[1400px]:flex">
          <Clock size={16} strokeWidth={1.5} className="shrink-0" aria-hidden />
          <span className="max-w-40 tabular-nums">Sandbox time {formatDateTime(viewer.now)}</span>
        </span>
        <NotificationsBell model={notifications} />
        <ThemeToggle theme={theme} />
      </div>
    </header>
  );
}
