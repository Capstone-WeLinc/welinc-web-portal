import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import Portal, { RECHECK_MS } from "./Portal";
import { Toaster } from "@/components/ui/sonner";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  api: { post: vi.fn(), get: vi.fn() },
}));

// These tests count /auth/sso calls; the Admin entry's own /auth/admin/me is tested on its own
vi.mock("./admin/AdminEntry", () => ({ AdminEntry: () => null }));
vi.mock("./admin/useAdminMe", () => ({ useAdminMe: () => null }));

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const assign = vi.fn();
const replace = vi.fn();
const REQUEST = "r".repeat(43);
const card = (system: string, url: string) => ({
  system,
  name: `${system} name`,
  description: `${system} description`,
  url,
  roles: [{ code: "MECHANIC", name: "Mechanic" }],
});
const USER = {
  id: "u1",
  name: "Pedro Cruz",
  email: "pedro@welinc.com",
  picture: null,
};
// Suite spec 0016, AC-12a: real answers carry the session's cutoffs, 30 minutes out here, so the
// session watch has nothing to check while a test runs
const CUTOFFS = {
  sessionExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  sessionAbsoluteExpiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
  serverTime: new Date().toISOString(),
};
const ONE = { user: USER, systems: [card("VRMS", "http://localhost:8001")], ...CUTOFFS };
const TWO = {
  ...CUTOFFS,
  user: USER,
  systems: [
    card("VMMS", "http://localhost:8002"),
    card("VRMS", "http://localhost:8001"),
  ],
};

function renderPortal(path = "/") {
  return render(
    <>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/login" element={<Portal />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </>,
  );
}

function httpError(status: number, data: Record<string, unknown> = {}) {
  const error = new AxiosError("failed");
  error.response = { status, data } as AxiosError["response"];
  return error;
}

/** The alert holding `text`; the Toaster keeps its own empty alert region too. */
async function alertWith(text: string) {
  await waitFor(() =>
    expect(
      screen.getAllByRole("alert").some((el) => el.textContent?.includes(text)),
    ).toBe(true),
  );
  return screen
    .getAllByRole("alert")
    .find((el) => el.textContent?.includes(text))!;
}

async function submit(email: string, password = "pw") {
  const user = userEvent.setup();
  await user.type(await screen.findByPlaceholderText(/you@welinc.com/), email);
  await user.type(screen.getByPlaceholderText("Enter password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

// covers: spec 0003 AC-11, AC-36; spec 0007 AC-11 to AC-14, AC-16 to AC-19
describe("Portal", () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    assign.mockReset();
    replace.mockReset();
    vi.stubGlobal("location", { ...window.location, assign, replace });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("signs in with no session and goes straight into the one system with replace", async () => {
    get.mockRejectedValue(httpError(401, { code: "SESSION_ENDED" }));
    post.mockResolvedValue({ data: ONE });
    renderPortal();
    await submit("pedro");

    expect(post).toHaveBeenCalledWith("/auth/login", {
      email: "pedro@welinc.com",
      password: "pw",
    });
    expect(replace).toHaveBeenCalledWith("http://localhost:8001");
    expect(get).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
  });

  it("shows the launcher after a sign in with two systems, without a second /auth/sso", async () => {
    get.mockRejectedValue(httpError(401));
    post.mockResolvedValue({ data: TWO });
    renderPortal();
    await submit("pedro");

    const links = await screen.findAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "http://localhost:8002",
      "http://localhost:8001",
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("continues a login request after signing in, never showing the launcher", async () => {
    get.mockRejectedValue(httpError(401));
    post.mockResolvedValue({ data: TWO });
    renderPortal(`/login?request=${REQUEST}`);
    await submit("pedro@welinc.com");

    expect(assign).toHaveBeenCalledWith(
      `http://localhost:3000/auth/authorize/resume?request=${REQUEST}`,
    );
    expect(screen.queryByRole("link", { name: /VMMS/ })).toBeNull();
  });

  it("resumes a login request at once with a live session, even with an error in the address", async () => {
    get.mockResolvedValue({ data: TWO });
    renderPortal(`/login?request=${REQUEST}&error=LOGIN_FAILED`);
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        `http://localhost:3000/auth/authorize/resume?request=${REQUEST}`,
      ),
    );
  });

  it("forwards a direct visit with a live one system session, and shows the launcher for two", async () => {
    get.mockResolvedValue({ data: ONE });
    const view = renderPortal("/");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("http://localhost:8001"),
    );
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    view.unmount();

    get.mockResolvedValue({ data: TWO });
    renderPortal("/?from=VRMS");
    expect(await screen.findByText("You're here")).toBeTruthy();
    expect(screen.getByText("Pick where you want to work today.")).toBeTruthy();
  });

  // covers: AC-16 (a `from` that is not a held system code tags nothing, and cards link only to registry addresses)
  it("tags no card for a foreign from address, and every card links to its registry address", async () => {
    get.mockResolvedValue({ data: TWO });
    renderPortal("/?from=https://evil.test");
    expect(
      await screen.findByText("Pick where you want to work today."),
    ).toBeTruthy();
    expect(screen.queryByText("You're here")).toBeNull();
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["http://localhost:8002", "http://localhost:8001"]);
    expect(replace).not.toHaveBeenCalled();
  });

  // covers: AC-20 (each card is one link a keyboard can reach, named by its system)
  it("makes each card a single link named by its system, reachable by Tab", async () => {
    get.mockResolvedValue({ data: TWO });
    renderPortal("/");
    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("VMMS name");
    expect(links[1].textContent).toContain("VRMS name");
    const user = userEvent.setup();
    await user.tab(); // the account menu comes first
    await user.tab();
    expect(document.activeElement).toBe(links[0]);
    await user.tab();
    expect(document.activeElement).toBe(links[1]);
  });

  it("never forwards while an error is in the address: one system shows its card and the banner", async () => {
    get.mockResolvedValue({ data: ONE });
    renderPortal("/?error=LOGIN_FAILED");
    expect(await alertWith("couldn't sign you in")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "http://localhost:8001",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the form with the error notice when there is no session", async () => {
    get.mockRejectedValue(httpError(401));
    renderPortal("/?error=NO_SYSTEM_ACCESS&system=VRMS");
    expect(await alertWith("no access to VRMS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();
  });

  it("always shows the form after a logout or an idle cutoff, without asking /auth/sso", async () => {
    for (const reason of ["logout", "idle", "maxage"]) {
      const view = renderPortal(`/login?reason=${reason}`);
      expect(
        await screen.findByRole("button", { name: "Sign in" }),
      ).toBeTruthy();
      expect(screen.getByRole("status")).toBeTruthy();
      view.unmount();
    }
    expect(get).not.toHaveBeenCalled();
  });

  it("drops the reason from the address after a sign in, so Back never draws the form over a live session", async () => {
    post.mockResolvedValue({ data: TWO });
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderPortal("/login?reason=logout");
    await submit("pedro");

    await screen.findAllByRole("link");
    expect(replaceState.mock.calls.map((call) => call[2])).toContain("/");
    replaceState.mockRestore();
  });

  it("shows the no access state with the email, and the error state with Retry", async () => {
    get.mockRejectedValueOnce(
      httpError(403, {
        code: "NO_SYSTEM_ACCESS",
        user: { email: "pedro@welinc.com" },
      }),
    );
    const view = renderPortal("/");
    expect(
      await screen.findByText(/no access to any WeLinc system/),
    ).toBeTruthy();
    expect(screen.getByText(/pedro@welinc.com/)).toBeTruthy();
    view.unmount();

    get
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: TWO });
    renderPortal("/");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findAllByRole("link")).toHaveLength(2);
  });

  it("keeps the lockout, attempts and no access messages on the form", async () => {
    get.mockRejectedValue(httpError(401));
    for (const [data, text] of [
      [{ isLocked: true }, "Too many wrong passwords"],
      [{ code: "ACCOUNT_INACTIVE" }, "deactivated"],
      [{ remainingAttempts: 2 }, "Incorrect email or password."],
      [{ remainingAttempts: 1 }, "One more wrong try locks your account for 15 minutes"],
      [{ code: "NO_SYSTEM_ACCESS" }, "no access to any WeLinc system"],
    ] as const) {
      post.mockRejectedValueOnce(httpError(403, data));
      const view = renderPortal("/login");
      await submit("pedro");
      expect(await alertWith(text)).toBeTruthy();
      view.unmount();
    }
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out everywhere from the account menu after the confirm, and keeps the launcher on a failure", async () => {
    get.mockResolvedValue({ data: TWO });
    post
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce({ data: {} });
    renderPortal("/");
    const user = userEvent.setup();
    const signOut = async () => {
      await user.click(
        await screen.findByRole("button", {
          name: /Account menu for Pedro Cruz/,
        }),
      );
      await user.click(
        await screen.findByRole("menuitem", { name: "Sign out" }),
      );
      expect(
        await screen.findByRole("alertdialog", {
          name: "Sign out of every WeLinc system?",
        }),
      ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Sign out" }));
    };

    await signOut();
    expect(
      (await screen.findAllByText(/couldn't sign you out/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("link")).toHaveLength(2);

    await signOut();
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/login?reason=logout"),
    );
    expect(post).toHaveBeenLastCalledWith("/auth/logout", {});
  });

  it("shows the greeting, the account details and the role pills", async () => {
    get.mockResolvedValue({ data: TWO });
    renderPortal("/");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Pedro$/,
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Mechanic")).toHaveLength(2);
    expect(screen.getAllByText("PC").length).toBeGreaterThan(0);
  });

  it("checks again on focus at most every 10 seconds: redraws, or shows the form when the session ended", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    get.mockResolvedValueOnce({ data: TWO });
    renderPortal("/");
    expect(await screen.findAllByRole("link")).toHaveLength(2);

    act(() => window.dispatchEvent(new Event("focus")));
    expect(get).toHaveBeenCalledTimes(1);

    now += RECHECK_MS;
    get.mockResolvedValueOnce({ data: ONE });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(1));
    expect(replace).not.toHaveBeenCalled();

    now += RECHECK_MS;
    get.mockRejectedValueOnce(httpError(401));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(
      await screen.findByText("Your session ended. Sign in again."),
    ).toBeTruthy();
    vi.restoreAllMocks();
  });
});
