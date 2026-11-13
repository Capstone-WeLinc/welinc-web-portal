import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Portal from "./Portal";
import { api } from "../lib/api";
import { appLine } from "../lib/launcher";
import { screenForAnswer } from "../lib/auth";

vi.mock("../lib/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  api: { post: vi.fn(), get: vi.fn() },
}));
vi.mock("./admin/AdminEntry", () => ({ AdminEntry: () => null }));
vi.mock("./admin/useAdminMe", () => ({ useAdminMe: () => null }));

// covers: suite spec 0014 AC-5, AC-7 (the phone only state, the launcher line, APP_NOT_ALLOWED)

const get = vi.mocked(api.get);
const replace = vi.fn();
const USER = { id: "u1", name: "Ramil Aquino", email: "vmms.mech@welinc.com", picture: null };
const web = (system: string) => ({
  system,
  name: `${system} name`,
  description: `${system} description`,
  url: `http://${system.toLowerCase()}.test`,
  roles: [{ code: "OPERATIONS", name: "Operations" }],
});
const phone = (system: string, released: boolean) => ({
  system,
  name: `${system} full name`,
  description: `${system} description`,
  roles: [{ code: "MECHANIC", name: "Mechanic" }],
  app: { clientId: `${system.toLowerCase()}-mobile`, released },
});
const CATALOG = { data: { systems: [{ code: "VMMS" }, { code: "VRMS" }, { code: "BMS" }] } };

/** `/auth/sso` answers `sso`; `/auth/systems` answers the catalog. */
function serve(sso: unknown) {
  get.mockImplementation((url: string) =>
    Promise.resolve(url === "/auth/systems" ? CATALOG : { data: sso }),
  );
}

function renderPortal(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Portal />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("spec 0014 phone only people at the portal", () => {
  beforeEach(() => {
    get.mockReset();
    replace.mockReset();
    vi.stubGlobal("location", { ...window.location, assign: vi.fn(), replace });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("words the app line by its release flag", () => {
    expect(appLine(phone("VMMS", true))).toBe("VMMS is on the WeLinc mobile app");
    expect(appLine(phone("BMS", false))).toBe("BMS is coming to the WeLinc mobile app");
  });

  it("picks the phone only screen, and the refusal page before anything else", () => {
    const answer = { user: USER, systems: [], mobileSystems: [phone("VMMS", true)] };
    expect(screenForAnswer(new URLSearchParams(""), answer).kind).toBe("phone-only");
    expect(
      screenForAnswer(new URLSearchParams("error=APP_NOT_ALLOWED&system=VMMS"), {
        ...answer,
        systems: [web("VRMS")],
      }),
    ).toMatchObject({ kind: "app-not-allowed", system: "VMMS" });
    // An older welinc-auth without the list still goes straight in
    expect(screenForAnswer(new URLSearchParams(""), { user: USER, systems: [web("VRMS")] }).kind).toBe("go");
  });

  it("shows a card per phone system with no link, the roles, and Sign out", async () => {
    serve({ user: USER, systems: [], mobileSystems: [phone("BMS", false), phone("VMMS", true)] });
    renderPortal("/");
    expect(await screen.findByText("VMMS is on the WeLinc mobile app")).toBeTruthy();
    expect(screen.getByText("BMS is coming to the WeLinc mobile app")).toBeTruthy();
    expect(screen.getByText("Your role doesn't use the web version.")).toBeTruthy();
    expect(screen.getAllByText("Mechanic")).toHaveLength(2);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("lists the phone only systems quietly under the launcher cards", async () => {
    serve({ user: USER, systems: [web("BMS"), web("VRMS")], mobileSystems: [phone("VMMS", true)] });
    renderPortal("/");
    expect(await screen.findByText("On the mobile app: VMMS")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("names a known system on the APP_NOT_ALLOWED page, with Back to your systems and Sign out", async () => {
    serve({ user: USER, systems: [web("VRMS")], mobileSystems: [phone("VMMS", true)] });
    renderPortal("/?error=APP_NOT_ALLOWED&system=VMMS");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Your role in VMMS uses the WeLinc mobile app, not the web",
      ),
    );
    expect(screen.getByRole("link", { name: "Back to your systems" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("never shows an unknown system parameter raw", async () => {
    serve({ user: USER, systems: [web("VRMS")], mobileSystems: [] });
    renderPortal("/?error=APP_NOT_ALLOWED&system=%3Cb%3Ehi");
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(get).toHaveBeenCalledWith("/auth/systems"));
    expect(screen.getByRole("alert").textContent).toBe(
      "Your role in this system uses the WeLinc mobile app, not the web",
    );
  });

  it("Back to your systems leads to the phone only state for a phone only person", async () => {
    serve({ user: USER, systems: [], mobileSystems: [phone("VMMS", true)] });
    renderPortal("/?error=APP_NOT_ALLOWED&system=VMMS");
    await userEvent.setup().click(await screen.findByRole("link", { name: "Back to your systems" }));
    expect(await screen.findByText("VMMS is on the WeLinc mobile app")).toBeTruthy();
  });
});
