import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/atlas/skip-link";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { DEMO_VIEWER } from "@/config/demo-viewer";
import { systemClock } from "@/lib/clock";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get("atlas_theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      <SkipLink />
      <div className="flex min-h-dvh">
        <Sidebar viewer={DEMO_VIEWER} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar now={systemClock.now()} theme={theme} />
          <main id="main" tabIndex={-1} className="flex-1 px-4 pt-6 pb-8 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
