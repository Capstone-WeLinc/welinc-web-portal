import { describe, expect, it } from "vitest";
import {
  activityDelayMs,
  afterCheck,
  checkDelayMs,
  countdown,
  isMaxAge,
  readCutoffs,
  retryDelayMs,
  spokenTimeLeft,
} from "./timing";

// covers: suite spec 0016 AC-12a, AC-12b (the portal's cutoff and timing rules)

const NOW = Date.parse("2026-11-23T10:00:00.000Z");

describe("readCutoffs", () => {
  it("reads the two cutoffs and the clock gap from a launcher answer", () => {
    const held = readCutoffs(
      {
        sessionExpiresAt: "2026-11-23T10:30:00.000Z",
        sessionAbsoluteExpiresAt: "2026-11-23T22:00:00.000Z",
        serverTime: "2026-11-23T10:00:05.000Z",
      },
      NOW,
    );
    expect(held).toEqual({
      cutoff: Date.parse("2026-11-23T10:30:00.000Z"),
      absolute: Date.parse("2026-11-23T22:00:00.000Z"),
      gap: 5_000,
    });
  });

  it("holds nothing for an answer without them (an older welinc-auth) or with bad times", () => {
    expect(readCutoffs({ user: {} }, NOW)).toBeNull();
    expect(readCutoffs({ sessionExpiresAt: "soon", sessionAbsoluteExpiresAt: "x", serverTime: "y" }, NOW)).toBeNull();
  });
});

describe("isMaxAge", () => {
  it("is the 12 hour end when the two cutoffs are within a second", () => {
    expect(isMaxAge({ cutoff: NOW, absolute: NOW + 900 })).toBe(true);
    expect(isMaxAge({ cutoff: NOW, absolute: NOW + 60_000 })).toBe(false);
  });
});

describe("activityDelayMs", () => {
  it("pings on the first input, then at most once a minute", () => {
    expect(activityDelayMs(0, NOW)).toBe(0);
    expect(activityDelayMs(NOW - 15_000, NOW)).toBe(45_000);
    expect(activityDelayMs(NOW - 60_000, NOW)).toBe(0);
  });
});

describe("checkDelayMs and afterCheck", () => {
  it("checks 120 s before the cutoff, or now", () => {
    expect(checkDelayMs(NOW + 30 * 60_000, NOW)).toBe(28 * 60_000);
    expect(checkDelayMs(NOW + 60_000, NOW)).toBe(0);
  });

  it("reschedules a cutoff that moved past the warning point, warns inside it, leaves after it", () => {
    expect(afterCheck(NOW + 10 * 60_000, NOW)).toBe("reschedule");
    expect(afterCheck(NOW + 124_000, NOW)).toBe("warn");
    expect(afterCheck(NOW + 126_000, NOW)).toBe("reschedule");
    expect(afterCheck(NOW, NOW)).toBe("leave");
  });
});

describe("retryDelayMs", () => {
  it("retries at 5, 15 and 30 s, then stops", () => {
    expect([0, 1, 2, 3].map((n) => retryDelayMs(n, null))).toEqual([5_000, 15_000, 30_000, null]);
  });

  it("waits for a longer Retry-After, never a shorter one", () => {
    expect(retryDelayMs(0, 20)).toBe(20_000);
    expect(retryDelayMs(1, 2)).toBe(15_000);
  });
});

describe("countdown and spokenTimeLeft", () => {
  it("counts m:ss and never below zero", () => {
    expect(countdown(65_000)).toBe("1:05");
    expect(countdown(-5)).toBe("0:00");
  });

  it("speaks whole minutes, then the seconds", () => {
    expect(spokenTimeLeft(120_000)).toBe("Signing out in 2 minutes");
    expect(spokenTimeLeft(65_000)).toBe("Signing out in 1 minute");
    expect(spokenTimeLeft(30_000)).toBe("Signing out in 30 seconds");
    expect(spokenTimeLeft(1_000)).toBe("Signing out in 1 second");
  });
});
