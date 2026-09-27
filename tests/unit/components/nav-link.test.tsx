// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NavLink } from "@/components/shell/nav-link";

const mock = vi.hoisted(() => ({ pathname: "/discover" }));
vi.mock("next/navigation", () => ({ usePathname: () => mock.pathname }));
afterEach(cleanup);
it.each([
  ["/discover", true],
  ["/discover/demo-id", true],
  ["/bids", false],
  ["/discovery", false],
] as const)("active state at %s", (path, active) => {
  mock.pathname = path;
  render(<NavLink href="/discover" label="Discover" icon={<span />} />);
  const link = screen.getByRole("link", { name: "Discover" });
  if (active) {
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("bg-atlas-green-soft");
  } else expect(link).not.toHaveAttribute("aria-current");
});
