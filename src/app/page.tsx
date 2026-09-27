import { cookies } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/atlas/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";

// TODO(segment-3): persona picker
export default async function Landing() {
  const theme = (await cookies()).get("atlas_theme")?.value === "dark" ? "dark" : "light";
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col items-start gap-6">
        <div className="flex w-full items-center justify-between">
          <Logo />
          <ThemeToggle theme={theme} />
        </div>
        <h1 className="type-display">Private shares, settled properly.</h1>
        <p className="type-body text-ink-muted">
          A marketplace for company-approved sales of existing shares in private UAE startups.
          Everything here is a demo with fictional companies and people.
        </p>
        <Button asChild>
          <Link href="/discover">Enter the demo</Link>
        </Button>
      </div>
    </main>
  );
}
