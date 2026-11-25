import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "@/lib/api";
import { forgetSummary } from "@/lib/adminSummary";
import type { LauncherAnswer } from "@/lib/auth";
import Launcher from "./Launcher";

vi.mock("../../lib/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  api: { post: vi.fn(), get: vi.fn() },
}));
const get = vi.mocked(api.get);

// covers: suite spec 0019 AC-1 (the band), AC-2 (the cards), AC-3 (Suite management, its tiles and counts)

const USER = { id: "u1", name: "Carla Santos", email: "carla@welinc.com", picture: null };
const CUTOFFS = {
  sessionExpiresAt: "2026-11-23T10:30:00.000Z",
  sessionAbsoluteExpiresAt: "2026-11-23T22:00:00.000Z",
  serverTime: "2026-11-23T10:00:00.000Z",
};

const sys = (system: string, name: string, roles: [string, string][]) => ({
  system,
  name,
  description: "",
  url: `http://${system.toLowerCase()}.test`,
  roles: roles.map(([code, roleName]) => ({ code, name: roleName })),
});
const VRMS_ADMIN = sys("VRMS", "Vehicle Repair Management System", [["ADMIN", "Admin"]]);
const VRMS_MECHANIC = sys("VRMS", "Vehicle Repair Management System", [["MECHANIC", "Mechanic"]]);
const VMMS_ADMIN = sys("VMMS", "Vehicle Maintenance Management System", [["ADMIN", "Admin"]]);
const BMS_OPS = sys("BMS", "Booking Management System", [["OPERATIONS", "Operations"]]);

function renderLauncher(over: Partial<LauncherAnswer>) {
  return render(
    <MemoryRouter>
      <Launcher answer={{ user: USER, systems: [], ...CUTOFFS, ...over }} params={new URLSearchParams()} banner={null} />
    </MemoryRouter>,
  );
}

const suite = () => screen.queryByRole("region", { name: "Suite management" });
const tileHrefs = () =>
  within(suite()!)
    .getAllByRole("link")
    .map((link) => [link.getAttribute("aria-label"), link.getAttribute("href")]);

beforeEach(() => {
  forgetSummary();
  get.mockReset();
  get.mockResolvedValue({ data: { needsAttention: 3, deletionRequests: 0, temporaryGrants: 2 } });
});

describe("launcher", () => {
  it("greets with the first name and orders the cards BMS, VMMS, VRMS, with one role chip each", () => {
    renderLauncher({ systems: [VRMS_MECHANIC, BMS_OPS, VMMS_ADMIN] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/, Carla$/);
    expect(screen.getByText("WeLinc Logistics · Since 2018")).toBeInTheDocument();
    const cards = within(screen.getByRole("region", { name: "Your systems" })).getAllByRole("link");
    expect(cards.map((card) => card.getAttribute("href"))).toEqual(["http://bms.test", "http://vmms.test", "http://vrms.test"]);
    expect(within(cards[0]).getByText("Operations")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Admin")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Mechanic")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Open VRMS")).toBeInTheDocument();
    expect(screen.queryByText(/Signed in until/)).toBeNull();
  });

  it("shows no Suite management and asks for no counts when someone administers nothing", () => {
    renderLauncher({ systems: [VRMS_MECHANIC, BMS_OPS] });
    expect(suite()).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("gives a system admin the strip with Audit log, every link scoped to their first system", async () => {
    renderLauncher({ systems: [VRMS_ADMIN, VMMS_ADMIN] });
    await waitFor(() => expect(within(suite()!).getByRole("link", { name: "Users need a look: 3" })).toBeInTheDocument());
    expect(get).toHaveBeenCalledWith("/auth/admin/summary", expect.anything());
    expect(tileHrefs()).toEqual([
      ["Open Suite management", "/admin"],
      ["Users need a look: 3", "/admin/people?system=VMMS"],
      ["Deletion requests: 0", "/admin/deletion-requests?system=VMMS"],
      ["Audit log", "/admin/activity?system=VMMS"],
      ["Open Suite management", "/admin"],
    ]);
  });

  it("gives a suite admin with one system Temporary access instead of Audit log", async () => {
    renderLauncher({ systems: [VRMS_MECHANIC], suiteAdmin: true });
    await waitFor(() => expect(within(suite()!).getByRole("link", { name: "Temporary access: 2" })).toBeInTheDocument());
    expect(within(suite()!).getByRole("link", { name: "Temporary access: 2" }).getAttribute("href")).toBe(
      "/admin/temporary-access",
    );
    expect(within(suite()!).queryByRole("link", { name: "Audit log" })).toBeNull();
  });

  it("gives a suite admin with no system the large card and no system cards", async () => {
    renderLauncher({ systems: [], suiteAdmin: true });
    expect(screen.queryByRole("region", { name: "Your systems" })).toBeNull();
    expect(within(suite()!).getByText(/You have no role in a system yet/)).toBeInTheDocument();
    expect(within(suite()!).getByRole("link", { name: /Open Suite management/ }).getAttribute("href")).toBe("/admin");
    await waitFor(() => expect(within(suite()!).getByRole("link", { name: "Users need a look: 3" })).toBeInTheDocument());
  });

  it("shows the tiles with a dash and never blocks when the summary fails", async () => {
    get.mockRejectedValue(new Error("down"));
    renderLauncher({ systems: [VRMS_ADMIN] });
    await waitFor(() =>
      expect(within(suite()!).getByRole("link", { name: "Users need a look: not available" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Open VRMS/ })).toBeInTheDocument();
  });
});
