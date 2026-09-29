import { Box, Users, UserX } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/atlas/logo";
import { StatusBadge } from "@/components/atlas/status-badge";
import { switchPersona } from "@/components/shell/demo-actions";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { StartTourButton, TourPanel } from "@/components/shell/tour-panel";
import { Button } from "@/components/ui/button";
import { getLandingModel } from "@/server/read/landing";
import { getViewer } from "@/server/viewer";
export const metadata = { title: "Private shares, settled properly" };
export default async function Landing() {
  const viewer = await getViewer(),
    cards = getLandingModel(viewer);
  const theme = (await cookies()).get("atlas_theme")?.value === "dark" ? "dark" : "light";
  return (
    <main className="min-h-dvh px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle theme={theme} />
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="type-display">Private shares, settled properly.</h1>
          <p className="type-body text-ink-muted max-w-2xl">
            Atlas is a marketplace where shareholders of private UAE startups sell existing shares
            to professional investors, with the company approving every transfer. Pick a role to
            explore it. Everything here is a demo with fictional companies and people.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <form
              key={card.key}
              action={async (formData: FormData) => {
                "use server";
                await switchPersona({ status: "idle" }, formData);
              }}
            >
              <button
                type="submit"
                className="relative flex h-full w-full flex-col gap-3 rounded-md border border-line bg-surface p-5 text-left hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <input type="hidden" name="persona" value={card.key} />
                <span className="type-label text-ink-muted uppercase">
                  {card.role === "company_admin" ? "Company" : card.role}
                </span>
                {card.current && (
                  <StatusBadge tone="success" className="absolute right-4 top-4">
                    Current
                  </StatusBadge>
                )}
                <span className="type-title">{card.title}</span>
                <span className="type-body-sm text-ink-muted">{card.description}</span>
              </button>
            </form>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild>
            <Link href="/discover">Enter the demo</Link>
          </Button>
          <StartTourButton />
          <Button variant="link" asChild>
            <Link href="/under-the-hood">How it works under the hood</Link>
          </Button>
        </div>
        <footer className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-5 type-body-sm text-ink-muted">
          <span className="flex items-center gap-2">
            <UserX size={16} strokeWidth={1.5} />
            No sign-up needed
          </span>
          <span className="flex items-center gap-2">
            <Box size={16} strokeWidth={1.5} />
            Your own private sandbox
          </span>
          <span className="flex items-center gap-2">
            <Users size={16} strokeWidth={1.5} />
            Fictional companies and people
          </span>
        </footer>
      </div>
      <TourPanel persona={viewer.persona} />
    </main>
  );
}
