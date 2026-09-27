// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AutoRefresh } from "@/components/shell/auto-refresh";

const mock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mock }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  mock.refresh.mockClear();
});
it("polls only while active and visible, resumes on visibility and cleans up", () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const view = render(<AutoRefresh active />);
  vi.advanceTimersByTime(6000);
  expect(mock.refresh).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(6000);
  expect(mock.refresh).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(3000);
  expect(mock.refresh).toHaveBeenCalledTimes(3);
  view.rerender(<AutoRefresh active={false} />);
  vi.advanceTimersByTime(6000);
  expect(mock.refresh).toHaveBeenCalledTimes(3);
});
