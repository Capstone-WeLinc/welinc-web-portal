import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AdminMe } from "@/lib/admin";
import Launcher from "./Launcher";

vi.mock("../../lib/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  api: { post: vi.fn(), get: vi.fn() },
}));
const adminMe = vi.hoisted(() => ({ current: null as AdminMe | null }));
vi.mock("../admin/useAdminMe", () => ({ useAdminMe: () => adminMe.current }));

// covers: the launcher's Admin card (Manage section) and the suite admin state (suite spec 0013, AC-5, AC-22)

const USER = { id: "u1", name: "Leonora Castillo", email: "admin@welinc.com", picture: null };
const VRMS = {
  system: "VRMS",
  name: "Vehicle Repair Management System",
  description: "Repairs",
  url: "http://vrms.test",
  roles: [{ code: "ADMIN", name: "Admin" }],
};
const me = (over: Partial<AdminMe>): AdminMe => ({
  user: USER,
  suiteAdmin: false,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  ...over,
});

function renderLauncher(systems: (typeof VRMS)[]) {
  return render(
    <MemoryRouter>
      <Launcher answer={{ user: USER, systems }} params={new URLSearchParams()} banner={null} />
    </MemoryRouter>,
  );
}

const manage = () => screen.queryByRole("region", { name: "Manage" });
const hrefs = (region: HTMLElement) =>
  within(region)
    .getAllByRole("link")
    // The wide card adds a hint after each label, so match on the label only
    .map((link) => [link.querySelector("span > span")?.textContent ?? link.textContent, link.getAttribute("href")]);

describe("launcher Admin card", () => {
  beforeEach(() => {
    adminMe.current = null;
  });

  it("gives a suite admin with no systems an admin home, not a dead end", () => {
    renderLauncher([]);
    expect(screen.getByText("You manage accounts and roles across the suite.")).toBeInTheDocument();
    expect(screen.queryByText(/hold no role in any system/)).not.toBeInTheDocument();
    expect(hrefs(manage()!)).toEqual([
      ["Admin", "/admin"],
      ["Overview", "/admin/overview"],
      ["People", "/admin/people"],
      ["Deletion requests", "/admin/deletion-requests"],
      ["Temporary access", "/admin/temporary-access"],
    ]);
  });

  it("adds a compact card beside the systems for a system admin, one link to Admin", () => {
    adminMe.current = me({ adminOf: ["VRMS"] });
    renderLauncher([VRMS]);
    expect(screen.getByText("Pick where you want to work today.")).toBeInTheDocument();
    expect(screen.getByText("Accounts and roles in VRMS.")).toBeInTheDocument();
    expect(within(manage()!).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/admin"]);
  });

  it("shows no Manage section to someone who administers nothing, or before the check answers", () => {
    renderLauncher([VRMS]);
    expect(manage()).toBeNull();
    adminMe.current = me({});
    renderLauncher([VRMS]);
    expect(manage()).toBeNull();
  });

  it("drops the top bar Admin entry on the launcher, since the card replaces it", () => {
    adminMe.current = me({ suiteAdmin: true });
    renderLauncher([VRMS]);
    expect(within(screen.getByRole("banner")).queryByRole("link", { name: "Admin" })).toBeNull();
  });
});
