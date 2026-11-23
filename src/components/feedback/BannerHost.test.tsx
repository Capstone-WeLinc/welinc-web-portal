import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { reportRequestFailed, reportRequestOk, resetConnectionForTests } from "@/lib/connection/connection";
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
  resetConnectionForTests();
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

// A failed cutoff check (AC-12b, "failures"). The API client reports every failed request to the
// offline signal (lib/api.ts), and AC-12 puts offline above signing out soon, so a check that
// fails at the network level shows "You're offline" on top while the signing out banner is kept
// underneath. Found by /check verify, where a blocked /auth/sso looked like "no banner".
describe("a failed check", () => {
  async function startWithFailingCheck(failure: () => Error) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const cutoff = { sessionExpiresAt: at(NOW + 125_000), sessionAbsoluteExpiresAt: at(NOW + 12 * 3_600_000), serverTime: at(NOW) };
    vi.mocked(api.get).mockImplementation(() => {
      const error = failure();
      // What the interceptor in lib/api.ts does on every failed request
      reportRequestFailed((error as { response?: { status?: number } }).response?.status);
      return Promise.reject(error);
    });
    holdCutoffs(cutoff);
    render(<BannerHost />);
    await act(async () => {
      startSessionWatch();
      await vi.advanceTimersByTimeAsync(5_000);
    });
  }

  it("shows the offline banner on top of a network failure, and Signing out soon returns when it is back", async () => {
    await startWithFailingCheck(() => new Error("Network Error"));
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.queryByText("Signing out soon")).not.toBeInTheDocument();
    // The retry gets an answer: back online, and the kept signing out banner shows again
    vi.mocked(api.get).mockResolvedValue({ data: { sessionExpiresAt: at(NOW + 125_000), sessionAbsoluteExpiresAt: at(NOW + 12 * 3_600_000), serverTime: at(Date.now()) } });
    await act(async () => {
      reportRequestOk();
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByText("Signing out soon")).toBeInTheDocument();
  });

  it("shows Signing out soon at once on a plain server error, which is not offline by itself", async () => {
    await startWithFailingCheck(() => Object.assign(new Error("failed"), { response: { status: 503 } }));
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByText("Signing out soon")).toBeInTheDocument();
  });
});
