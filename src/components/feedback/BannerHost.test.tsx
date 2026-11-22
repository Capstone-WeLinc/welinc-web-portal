import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { holdCutoffs, resetSessionWatchForTests, startSessionWatch } from "@/lib/sessionWatch/watch";
import { BannerHost } from "./BannerHost";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "http://localhost:3000", api: { get: vi.fn(), post: vi.fn() } }));

// covers: suite spec 0016 AC-12, AC-12b (the portal's signing out soon banner and its screen
// reader rules)

const NOW = Date.parse("2026-11-23T10:00:00.000Z");
const at = (ms: number) => new Date(ms).toISOString();

async function showBanner(absoluteMs: number) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const cutoff = { sessionExpiresAt: at(NOW + 110_000), sessionAbsoluteExpiresAt: at(absoluteMs), serverTime: at(NOW) };
  vi.mocked(api.get).mockImplementation(() => Promise.resolve({ data: { ...cutoff, serverTime: at(Date.now()) } }));
  holdCutoffs(cutoff);
  render(<BannerHost />);
  await act(async () => {
    startSessionWatch();
    await vi.advanceTimersByTimeAsync(0);
  });
}

afterEach(() => {
  resetSessionWatchForTests();
  vi.useRealTimers();
});

describe("signing out soon", () => {
  it("offers Stay signed in, hides the ticking time and speaks the minutes once", async () => {
    await showBanner(NOW + 12 * 3_600_000);
    expect(screen.getByText("Signing out soon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay signed in" })).toBeInTheDocument();
    expect(screen.getByText("1:50")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Signing out in 2 minutes");
    // The banner itself is not a live region, so the countdown never gets read out
    expect(screen.getByText("Signing out soon").closest("[data-slot=banner]")).not.toHaveAttribute("role");
    expect(document.activeElement).toBe(document.body);
  });

  it("says it again at 30 seconds", async () => {
    await showBanner(NOW + 12 * 3_600_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(81_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Signing out in 30 seconds");
  });

  it("at the 12 hour end says it can't be extended and has no action", async () => {
    await showBanner(NOW + 110_000);
    expect(screen.getByText(/can't be extended/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stay signed in" })).not.toBeInTheDocument();
  });
});
