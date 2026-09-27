import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/atlas/skip-link";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getViewer } from "@/server/viewer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const theme = (await cookies()).get("atlas_theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      <SkipLink />
      <div className="flex min-h-dvh">
        <Sidebar viewer={viewer.user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar viewer={viewer} theme={theme} />
          <AutoRefresh active={viewer.autopilot && viewer.pendingJobs > 0} />
          <main id="main" tabIndex={-1} className="flex-1 px-4 pt-6 pb-8 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
