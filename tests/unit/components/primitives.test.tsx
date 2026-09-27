// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Deadline } from "@/components/atlas/deadline";
import { Money } from "@/components/atlas/money";
import { StatusBadge, type Tone, toneClasses } from "@/components/atlas/status-badge";
import { VerifiedMark } from "@/components/atlas/verified";
import { Button } from "@/components/ui/button";

afterEach(cleanup);
it.each(Object.keys(toneClasses) as Tone[])("StatusBadge renders %s tone", (tone) => {
  render(<StatusBadge tone={tone}>Example status</StatusBadge>);
  expect(screen.getByText("Example status")).toHaveClass(...toneClasses[tone].split(" "));
});
it.each([
  [20, "in 20h", "warning"],
  [120, "in 5 days", "neutral"],
  [-2, "2h ago", "danger"],
] as const)("Deadline at %s hours", (hours, text, tone) => {
  const now = new Date("2026-09-25T10:30:00Z");
  render(<Deadline at={new Date(now.getTime() + hours * 3600000)} now={now} />);
  expect(screen.getByText(text)).toHaveAttribute("data-tone", tone);
});
it.each([46200000n, "46200000"])("Money accepts %s", (minor) => {
  render(<Money minor={minor} currency="AED" />);
  expect(screen.getByText("AED 462,000")).toHaveClass("tabular-nums");
});
it("VerifiedMark has an accessible name", () => {
  render(<VerifiedMark label="Holding verified by company" />);
  expect(screen.getByRole("img", { name: "Holding verified by company" })).toBeInTheDocument();
});
it("loading Button is disabled and busy", () => {
  render(<Button loading>Save</Button>);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
});
it("loading Button preserves its slotted link and accessible label", () => {
  render(
    <Button asChild loading>
      <a href="/discover">Discover</a>
    </Button>,
  );
  expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("link")).toHaveAttribute("aria-busy", "true");
});
