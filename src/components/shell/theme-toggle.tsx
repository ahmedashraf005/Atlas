"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ theme: initialTheme }: { theme: "light" | "dark" }) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    // biome-ignore lint/suspicious/noDocumentCookie: this non-sensitive preference must be readable before rendering.
    document.cookie = `atlas_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      onClick={toggle}
    >
      {theme === "light" ? (
        <Moon strokeWidth={1.5} aria-hidden />
      ) : (
        <Sun strokeWidth={1.5} aria-hidden />
      )}
    </Button>
  );
}
