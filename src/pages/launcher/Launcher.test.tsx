import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "@/lib/api";
import type { LauncherAnswer } from "@/lib/auth";
import Launcher from "./Launcher";

vi.mock("../../lib/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  api: { post: vi.fn(), get: vi.fn() },
}));
const get = vi.mocked(api.get);

// covers: suite spec 0019 AC-1 (the band and footer), AC-2 (tiles, labels, number keys), AC-3 (Suite management), AC-7 (no admin call), AC-8 (arrival), AC-10 (launch cover)

const USER = { id: "u1", name: "Armando Cruz", email: "armando@welinc.com", picture: null };
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
const VRMS_CHIEF = sys("VRMS", "Vehicle Repair Management System", [["CHIEF_MECHANIC", "Chief Mechanic"]]);
const VMMS_OPS = sys("VMMS", "Vehicle Maintenance Management System", [["OPERATIONS", "Operations"]]);
const VMMS_ADMIN = sys("VMMS", "Vehicle Maintenance Management System", [["ADMIN", "Admin"]]);
const BMS_ADMIN = sys("BMS", "Booking Management System", [["ADMIN", "Admin"]]);

function renderLauncher(over: Partial<LauncherAnswer>, onLaunch = vi.fn(), arrive = false) {
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Launcher
              answer={{ user: USER, systems: [], ...CUTOFFS, ...over }}
              params={new URLSearchParams()}
              banner={null}
              arrive={arrive}
              onLaunch={onLaunch}
            />
          }
        />
        <Route path="/admin" element={<p>Suite management page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return onLaunch;
}

const tiles = () => within(screen.getByRole("region", { name: "Your systems" })).getAllByRole("link");

beforeEach(() => {
  get.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});
const cover = () => document.querySelector("[data-launch]");

describe("launcher", () => {
  it("shows Armando's three systems in order, then Suite management, with keys 1 to 4 and the labels", () => {
    renderLauncher({ systems: [VRMS_CHIEF, BMS_ADMIN, VMMS_OPS] });
    const links = tiles();
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["http://bms.test", "http://vmms.test", "http://vrms.test", "/admin"]);
    expect(links.map((l) => l.getAttribute("aria-keyshortcuts"))).toEqual(["1", "2", "3", "4"]);
    expect(within(links[0]).getByText("Admin")).toBeInTheDocument();
    expect(within(links[1]).getByText("Operations")).toBeInTheDocument();
    expect(within(links[2]).getByText("Chief Mechanic")).toBeInTheDocument();
    expect(within(links[2]).getByText("Vehicle Repair Management System")).toBeInTheDocument();
    expect(within(links[3]).getByText("For BMS")).toBeInTheDocument();
    expect(within(links[3]).getByText("People, roles and access")).toBeInTheDocument();
    expect(screen.getByText("Systems")).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "p" })).toBeInTheDocument();
    // The count beside "Your systems" counts system tiles only
    expect(screen.getByText("3", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText(/Open VRMS|Your role:|Good (morning|afternoon|evening)|Signed in until/)).toBeNull();
    expect(screen.getByText("EST. 2018")).toBeInTheDocument();
    expect(screen.getByText("Operations Workspace")).toBeInTheDocument();
  });

  it("shows no labels and no Suite management tile when someone administers nothing", () => {
    renderLauncher({ systems: [VRMS_CHIEF, VMMS_OPS] });
    expect(tiles()).toHaveLength(2);
    expect(screen.queryByText("Systems")).toBeNull();
    expect(screen.queryByText("Suite management")).toBeNull();
  });

  it("names only the systems you administer on the Suite management tile", () => {
    renderLauncher({ systems: [VRMS_ADMIN, VMMS_ADMIN] });
    expect(within(tiles()[2]).getByText("For VMMS and VRMS")).toBeInTheDocument();
  });

  it("covers every system for a suite admin with one temporary role", () => {
    renderLauncher({ systems: [VRMS_CHIEF], suiteAdmin: true });
    expect(within(tiles()[1]).getByText("For BMS, VMMS and VRMS")).toBeInTheDocument();
  });

  it("calls nothing under /auth/admin", () => {
    renderLauncher({ systems: [VRMS_ADMIN], suiteAdmin: true });
    expect(get).not.toHaveBeenCalled();
  });

  it("opens a system by its number key, the same as a click", () => {
    const onLaunch = renderLauncher({ systems: [VMMS_OPS, VRMS_CHIEF] });
    fireEvent.keyDown(window, { key: "2" });
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ system: "VRMS" }));
  });

  it("ignores a digit with no tile, a repeat, a modifier, and typing in a field", () => {
    const onLaunch = renderLauncher({ systems: [VMMS_OPS, VRMS_CHIEF] });
    fireEvent.keyDown(window, { key: "9" });
    fireEvent.keyDown(window, { key: "1", repeat: true });
    fireEvent.keyDown(window, { key: "1", metaKey: true });
    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "1" });
    field.remove();
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("opens Suite management by its key with no launch", () => {
    const onLaunch = renderLauncher({ systems: [VRMS_ADMIN] });
    fireEvent.keyDown(window, { key: "2" });
    expect(screen.getByText("Suite management page")).toBeInTheDocument();
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("plays no launch on a modifier click, so a new tab opens normally", () => {
    const onLaunch = renderLauncher({ systems: [VRMS_CHIEF] });
    fireEvent.click(tiles()[0], { metaKey: true });
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("raises a launch cover on a plain click and takes it away after 900ms", () => {
    vi.useFakeTimers();
    renderLauncher({ systems: [VRMS_CHIEF] });
    fireEvent.click(tiles()[0]);
    const scene = cover()?.getAttribute("data-launch");
    expect(["2", "3", "4"]).toContain(scene);
    expect(cover()).toHaveAttribute("aria-hidden", "true");
    expect(cover()).toHaveTextContent("VRMS");
    act(() => vi.advanceTimersByTime(899));
    expect(cover()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(cover()).toBeNull();
    // The next launch is never the same scene
    fireEvent.click(tiles()[0]);
    expect(cover()?.getAttribute("data-launch")).not.toBe(scene);
  });

  it("raises no cover on a modifier click and none for Suite management", () => {
    renderLauncher({ systems: [VRMS_ADMIN] });
    fireEvent.click(tiles()[0], { ctrlKey: true });
    expect(cover()).toBeNull();
    fireEvent.click(tiles()[1]);
    expect(cover()).toBeNull();
  });

  it("drops the cover when the page comes back from the back forward cache", () => {
    renderLauncher({ systems: [VRMS_CHIEF] });
    fireEvent.click(tiles()[0]);
    expect(cover()).not.toBeNull();
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    expect(cover()).toBeNull();
  });

  it("deals the tiles in after a sign in and ignores keys until the last one lands", () => {
    vi.useFakeTimers();
    const onLaunch = renderLauncher({ systems: [VMMS_OPS, VRMS_ADMIN] }, vi.fn(), true);
    const links = tiles();
    expect(links.every((l) => l.classList.contains("arrive-deal"))).toBe(true);
    expect(links.map((l) => l.style.getPropertyValue("--arrive-at"))).toEqual(["550ms", "640ms", "730ms"]);
    fireEvent.keyDown(window, { key: "1" });
    expect(onLaunch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1180));
    fireEvent.keyDown(window, { key: "1" });
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ system: "VMMS" }));
    act(() => vi.advanceTimersByTime(120));
    expect(tiles()[0].classList.contains("arrive-deal")).toBe(false);
  });

  it("shows the tiles in place without the arrival", () => {
    renderLauncher({ systems: [VRMS_CHIEF] });
    expect(tiles()[0].classList.contains("arrive-deal")).toBe(false);
  });
});
