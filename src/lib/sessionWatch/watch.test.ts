import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import {
  currentSigningOut,
  holdCutoffs,
  resetSessionWatchForTests,
  staySignedIn,
  startSessionWatch,
  stopSessionWatch,
} from "./watch";

vi.mock("../api", () => ({ API_BASE_URL: "http://localhost:3000", api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("../notify", () => ({ notifyError: vi.fn() }));

// covers: suite spec 0016 AC-12a (activity pings), AC-12b (the cutoff check, the banner, Stay
// signed in, failures and retries, the last check before leaving, Admin's cold start)

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const T0 = Date.parse("2026-11-23T10:00:00.000Z");
const MIN = 60_000;
const ABSOLUTE = new Date(T0 + 12 * 60 * MIN).toISOString();

/** A launcher answer with this cutoff, on a server clock `gapMs` ahead of the browser's. */
function answer(cutoffMs: number, absolute = ABSOLUTE, gapMs = 0) {
  return {
    sessionExpiresAt: new Date(cutoffMs).toISOString(),
    sessionAbsoluteExpiresAt: absolute,
    serverTime: new Date(Date.now() + gapMs).toISOString(),
  };
}

/** A mocked `/auth/sso` that answers with the server's clock at the moment it answers. */
const sso =
  (cutoffMs: number, absolute = ABSOLUTE, gapMs = 0) =>
  () =>
    Promise.resolve({ data: answer(cutoffMs, absolute, gapMs) });

const fail = (status: number, data: object = {}, headers: object = {}) =>
  Object.assign(new Error("failed"), { response: { status, data, headers } });

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({ status: 204 });
  assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  resetSessionWatchForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the cutoff check", () => {
  it("asks /auth/sso 120 s before the cutoff, and reschedules quietly when it moved", async () => {
    holdCutoffs(answer(T0 + 30 * MIN));
    startSessionWatch();
    get.mockImplementation(sso(T0 + 58 * MIN));

    await vi.advanceTimersByTimeAsync(28 * MIN - 1);
    expect(get).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(get).toHaveBeenCalledWith("/auth/sso");
    expect(currentSigningOut()).toBeNull();
    expect(assign).not.toHaveBeenCalled();
    // The next check is planned from the new cutoff
    await vi.advanceTimersByTimeAsync(28 * MIN);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("counts on the server's clock", async () => {
    // The server is 10 minutes ahead: its 10:30 cutoff is 20 browser minutes away
    holdCutoffs(answer(T0 + 30 * MIN, ABSOLUTE, 10 * MIN));
    startSessionWatch();
    get.mockImplementation(sso(T0 + 60 * MIN, ABSOLUTE, 10 * MIN));
    await vi.advanceTimersByTimeAsync(18 * MIN);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("leaves for reason=idle when the last check at the cutoff finds the session ended", async () => {
    holdCutoffs(answer(T0 + 3 * MIN));
    startSessionWatch();
    get.mockImplementationOnce(sso(T0 + 3 * MIN)).mockRejectedValueOnce(fail(401, { code: "SESSION_ENDED" }));
    await vi.advanceTimersByTimeAsync(MIN);
    expect(currentSigningOut()).toEqual({ cutoff: T0 + 3 * MIN, cannotExtend: false, busy: false });
    expect(assign).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(assign).toHaveBeenCalledWith("/login?reason=idle");
  });

  it("stays when the last check finds work elsewhere moved the cutoff", async () => {
    holdCutoffs(answer(T0 + 3 * MIN));
    startSessionWatch();
    get.mockImplementationOnce(sso(T0 + 3 * MIN)).mockImplementationOnce(sso(T0 + 33 * MIN));
    await vi.advanceTimersByTimeAsync(3 * MIN);
    expect(get).toHaveBeenCalledTimes(2);
    expect(currentSigningOut()).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("leaves for reason=maxage at the 12 hour end", async () => {
    const end = new Date(T0 + 3 * MIN).toISOString();
    holdCutoffs(answer(T0 + 3 * MIN, end));
    startSessionWatch();
    get.mockImplementationOnce(sso(T0 + 3 * MIN, end)).mockRejectedValueOnce(fail(401));
    await vi.advanceTimersByTimeAsync(MIN);
    // Known from the start: no action, and the text says it can't be extended
    expect(currentSigningOut()).toMatchObject({ cannotExtend: true });
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(assign).toHaveBeenCalledWith("/login?reason=maxage");
  });

  it("goes to /login with the no access message on 403 NO_SYSTEM_ACCESS", async () => {
    holdCutoffs(answer(T0 + 3 * MIN));
    startSessionWatch();
    get.mockRejectedValue(fail(403, { code: "NO_SYSTEM_ACCESS" }));
    await vi.advanceTimersByTimeAsync(MIN);
    expect(assign).toHaveBeenCalledWith("/login?error=NO_SYSTEM_ACCESS");
  });

  it("keeps the held cutoff on other failures, retries at 5 and 15 s, and leaves once it has passed", async () => {
    holdCutoffs(answer(T0 + 2 * MIN + 10_000));
    startSessionWatch();
    get.mockRejectedValue(fail(503));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(get).toHaveBeenCalledTimes(1);
    // The banner still shows on the held cutoff
    expect(currentSigningOut()).toMatchObject({ cutoff: T0 + 2 * MIN + 10_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(get).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(get).toHaveBeenCalledTimes(3);
    expect(assign).not.toHaveBeenCalled();
    // The retries never go past the cutoff; the failed check there leaves
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(assign).toHaveBeenCalledWith("/login?reason=idle");
  });

  it("waits for Retry-After on a 429", async () => {
    holdCutoffs(answer(T0 + 2 * MIN + 60_000));
    startSessionWatch();
    get.mockRejectedValueOnce(fail(429, { code: "RATE_LIMITED" }, { "retry-after": "20" })).mockImplementation(sso(T0 + 40 * MIN));
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("asks /auth/sso at once when it starts with no cutoffs (Admin after a reload)", async () => {
    get.mockImplementation(sso(T0 + 30 * MIN));
    startSessionWatch();
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);
    // Then it plans from what it got
    await vi.advanceTimersByTimeAsync(28 * MIN);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does nothing once stopped (the form, a sign out)", async () => {
    holdCutoffs(answer(T0 + 3 * MIN));
    startSessionWatch();
    stopSessionWatch();
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("activity pings", () => {
  function input() {
    const spy = vi.spyOn(window, "addEventListener");
    startSessionWatch();
    const call = spy.mock.calls.find(([name]) => name === "keydown");
    spy.mockRestore();
    const handler = call?.[1] as (event: Partial<Event>) => void;
    return (trusted = true) => handler({ isTrusted: trusted });
  }

  it("pings on the first real input, then at most once a minute with one trailing ping", async () => {
    holdCutoffs(answer(T0 + 30 * MIN));
    const press = input();
    press(false);
    expect(post).not.toHaveBeenCalled();
    press();
    expect(post).toHaveBeenCalledWith("/auth/session/activity", {});
    await vi.advanceTimersByTimeAsync(10_000);
    press();
    press();
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("goes to reason=idle when a ping finds the session ended", async () => {
    holdCutoffs(answer(T0 + 30 * MIN));
    post.mockRejectedValue(fail(401, { code: "SESSION_ENDED" }));
    input()();
    await vi.advanceTimersByTimeAsync(0);
    expect(assign).toHaveBeenCalledWith("/login?reason=idle");
  });

  it("ignores a 429 or a network error, with no retry", async () => {
    holdCutoffs(answer(T0 + 30 * MIN));
    post.mockRejectedValue(fail(429));
    input()();
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(post).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("follows each ping with a check while the banner shows", async () => {
    holdCutoffs(answer(T0 + 2 * MIN));
    const press = input();
    get.mockImplementationOnce(sso(T0 + 2 * MIN)).mockImplementationOnce(sso(T0 + 32 * MIN));
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(currentSigningOut()).not.toBeNull();
    press();
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(2);
    // The check found the moved cutoff; input alone would not have closed it
    expect(currentSigningOut()).toBeNull();
  });
});

describe("Stay signed in", () => {
  it("pings, then checks; a cutoff that didn't move is the 12 hour end", async () => {
    holdCutoffs(answer(T0 + 2 * MIN));
    startSessionWatch();
    get.mockImplementation(sso(T0 + 2 * MIN));
    await vi.advanceTimersByTimeAsync(0);
    await staySignedIn();
    expect(post).toHaveBeenCalledWith("/auth/session/activity", {});
    const order = [post.mock.invocationCallOrder[0], get.mock.invocationCallOrder[1]];
    expect(order[0]).toBeLessThan(order[1]);
    expect(currentSigningOut()).toMatchObject({ cannotExtend: true, busy: false });
    // A second click does nothing: the banner now says the limit can't be extended
    await staySignedIn();
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("Stay signed in that works", () => {
  it("closes the banner when the check finds the cutoff moved", async () => {
    holdCutoffs(answer(T0 + 2 * MIN));
    startSessionWatch();
    get.mockImplementationOnce(sso(T0 + 2 * MIN)).mockImplementationOnce(sso(T0 + 32 * MIN));
    await vi.advanceTimersByTimeAsync(0);
    expect(currentSigningOut()).not.toBeNull();
    await staySignedIn();
    expect(currentSigningOut()).toBeNull();
  });
});
