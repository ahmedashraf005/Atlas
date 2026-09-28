// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("requires an 800ms simulated passkey check, keeps the dialog open and submits once", async () => {
  vi.useFakeTimers();
  const confirm = vi.fn();
  render(
    <ConfirmDialog
      trigger={<button type="button">Release</button>}
      title="Release funds?"
      description="Two operators approve."
      confirmLabel="Release"
      stepUp
      onConfirm={confirm}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Release" }));
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  expect(screen.getByText(/Simulated step-up check/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Confirm with passkey" }));
  expect(screen.getByText("Verifying passkey…")).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(() => vi.advanceTimersByTime(799));
  expect(confirm).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(1));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
it("cancelling or unmounting prevents submission", () => {
  vi.useFakeTimers();
  const confirm = vi.fn(),
    view = render(
      <ConfirmDialog
        trigger={<button type="button">Wire</button>}
        title="Wire?"
        description="Check details."
        confirmLabel="Wire"
        stepUp
        onConfirm={confirm}
      />,
    );
  fireEvent.click(screen.getByRole("button", { name: "Wire" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  vi.advanceTimersByTime(1000);
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Wire" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm with passkey" }));
  view.unmount();
  vi.advanceTimersByTime(1000);
  expect(confirm).not.toHaveBeenCalled();
});
