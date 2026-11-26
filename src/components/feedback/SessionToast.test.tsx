import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { reportRequestFailed, reportRequestOk, resetConnectionForTests } from "@/lib/connection/connection";
import { holdCutoffs, resetSessionWatchForTests, startSessionWatch } from "@/lib/sessionWatch/watch";
import { BannerHost } from "./BannerHost";
import { SessionToast } from "./SessionToast";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "http://localhost:3000", api: { get: vi.fn(), post: vi.fn() } }));

// covers: suite spec 0019 AC-25 (the session warning toast in place of the signing out banner,
// with suite spec 0016 AC-12b's timing and screen reader rules)

const NOW = Date.parse("2026-11-23T10:00:00.000Z");
const at = (ms: number) => new Date(ms).toISOString();

/** The toast as sonner would draw it, plus the offline banner beside it. */
function Screen() {
  return (
    <>
      <BannerHost />
      <SessionToast />
    </>
  );
}

async function showToast(absoluteMs: number) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const cutoff = { sessionExpiresAt: at(NOW + 110_000), sessionAbsoluteExpiresAt: at(absoluteMs), serverTime: at(NOW) };
  vi.mocked(api.get).mockImplementation(() => Promise.resolve({ data: { ...cutoff, serverTime: at(Date.now()) } }));
  holdCutoffs(cutoff);
  render(<Screen />);
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

describe("the idle warning", () => {
  it("asks Still there?, offers Stay signed in, hides the ticking time and speaks the minutes once", async () => {
    await showToast(NOW + 12 * 3_600_000);
    expect(screen.getByText("Still there?")).toBeInTheDocument();
    expect(screen.getByText(/for inactivity/)).toHaveTextContent("You'll be signed out in 1:50 for inactivity.");
    expect(screen.getByRole("button", { name: "Stay signed in" })).toBeInTheDocument();
    expect(screen.getByText("1:50")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Signing out in 2 minutes");
    // The toast itself is not a live region, so the countdown never gets read out
    const toast = screen.getByText("Still there?").closest("[data-slot=toast]");
    expect(toast).not.toHaveAttribute("role");
    // No close button and no time bar
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(toast?.querySelector("[data-slot=toast-bar]")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("says it again at 30 seconds", async () => {
    await showToast(NOW + 12 * 3_600_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(81_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Signing out in 30 seconds");
  });
});

describe("the 12 hour end", () => {
  it("names the time it ends and has no action", async () => {
    await showToast(NOW + 110_000);
    const local = new Date(NOW + 110_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    expect(screen.getByText(`Your session ends at ${local}`)).toBeInTheDocument();
    expect(screen.getByText(/This is the 12 hour limit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stay signed in" })).not.toBeInTheDocument();
  });
});

// A failed cutoff check (0016 AC-12b, "failures"). Suite spec 0019 AC-25: the toast shows
// independently of the offline banner; both can show.
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
    render(<Screen />);
    await act(async () => {
      startSessionWatch();
      await vi.advanceTimersByTimeAsync(5_000);
    });
  }

  it("shows the warning beside the offline banner on a network failure, and offline goes when it is back", async () => {
    await startWithFailingCheck(() => new Error("Network Error"));
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText("Still there?")).toBeInTheDocument();
    vi.mocked(api.get).mockResolvedValue({ data: { sessionExpiresAt: at(NOW + 125_000), sessionAbsoluteExpiresAt: at(NOW + 12 * 3_600_000), serverTime: at(Date.now()) } });
    await act(async () => {
      reportRequestOk();
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByText("Still there?")).toBeInTheDocument();
  });

  it("shows the warning at once on a plain server error, which is not offline by itself", async () => {
    await startWithFailingCheck(() => Object.assign(new Error("failed"), { response: { status: 503 } }));
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByText("Still there?")).toBeInTheDocument();
  });
});
