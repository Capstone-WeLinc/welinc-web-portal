import { describe, it, expect, vi, afterEach } from "vitest";
import { goToSignedOut, onSignedOutElsewhere } from "./session";

vi.mock("./api", () => ({ API_BASE_URL: "http://localhost:3000", api: { post: vi.fn(), get: vi.fn() } }));

// covers: a sign out in one portal tab sends every other portal tab to the form

describe("sign out across tabs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells the other tabs, and shows the form in this one", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const heard = vi.fn();
    const stop = onSignedOutElsewhere(heard);

    goToSignedOut();

    expect(assign).toHaveBeenCalledWith("/login?reason=logout");
    await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
    stop();
  });
});
