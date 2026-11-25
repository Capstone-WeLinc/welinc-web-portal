import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ API_BASE_URL: 'http://localhost:3000' }));

import {
  firstName,
  greetingFor,
  initialsOf,
  orderedSystems,
  pictureUrl,
  roleTag,
  signedInSystems,
  signOutLine,
  suiteEntryFor,
  todayLabel,
} from './launcher';

// covers: spec 0007 AC-15 (greeting, first name), AC-17 (picture, initials)
describe('launcher display rules', () => {
  it('greets by the local hour', () => {
    expect(greetingFor(0)).toBe('Good evening');
    expect(greetingFor(1)).toBe('Good evening');
    expect(greetingFor(4)).toBe('Good evening');
    expect(greetingFor(5)).toBe('Good morning');
    expect(greetingFor(11)).toBe('Good morning');
    expect(greetingFor(12)).toBe('Good afternoon');
    expect(greetingFor(17)).toBe('Good afternoon');
    expect(greetingFor(18)).toBe('Good evening');
    expect(greetingFor(23)).toBe('Good evening');
  });

  it('takes the first word as the first name, and first and last initials', () => {
    expect(firstName('  Corazon   Villareal ')).toBe('Corazon');
    expect(initialsOf('Corazon Dela Cruz Villareal')).toBe('CV');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('')).toBe('?');
  });

  it('loads only /uploads/ pictures, from welinc-auth', () => {
    expect(pictureUrl('/uploads/u1.png')).toBe('http://localhost:3000/uploads/u1.png');
    expect(pictureUrl('https://tracker.test/p.png')).toBeNull();
    expect(pictureUrl('//evil.test/uploads/x.png')).toBeNull();
    expect(pictureUrl(null)).toBeNull();
  });
});

describe('signedInSystems', () => {
  const web = (system: string) => ({ system, name: system, description: '', url: '', roles: [] });
  const phone = (system: string) => ({ ...web(system), app: { clientId: 'x', released: true } });

  it('lists the web systems, then the phone only ones, each once', () => {
    expect(signedInSystems({ systems: [web('VRMS'), web('BMS')], mobileSystems: [phone('VMMS'), phone('VRMS')] })).toEqual(['VRMS', 'BMS', 'VMMS']);
  });

  it('is empty for a suite admin with no systems and an older answer without mobileSystems', () => {
    expect(signedInSystems({ systems: [] })).toEqual([]);
  });
});

describe('signOutLine', () => {
  it('names one system', () => {
    expect(signOutLine(['VMMS'])).toBe("You'll be signed out of VMMS on this browser, and need to sign in again to use it.");
  });

  it('names two or three systems with "and"', () => {
    expect(signOutLine(['VRMS', 'VMMS'])).toBe("You'll be signed out of VRMS and VMMS on this browser, and need to sign in again to use them.");
    expect(signOutLine(['VRMS', 'VMMS', 'BMS'])).toContain('of VRMS, VMMS and BMS on this browser');
  });

  it('says only to sign in again when no system is known', () => {
    expect(signOutLine()).toBe("You'll need to sign in again.");
    expect(signOutLine([])).toBe("You'll need to sign in again.");
  });
});

// covers: suite spec 0019 AC-2, AC-20 (the role chip: Admin only, else the real role names)
describe('roleTag', () => {
  const system = (roles: { code: string; name: string }[]) => ({
    system: 'VRMS',
    name: 'VRMS',
    description: '',
    url: 'http://vrms.test',
    roles,
  });

  it('says Admin alone for an admin of the system', () => {
    expect(roleTag(system([{ code: 'ADMIN', name: 'Admin' }, { code: 'MECHANIC', name: 'Mechanic' }]))).toBe('Admin');
  });

  it('names the real roles for everyone else', () => {
    expect(roleTag(system([{ code: 'CHIEF_MECHANIC', name: 'Chief Mechanic' }]))).toBe('Chief Mechanic');
  });
});

// covers: suite spec 0019 AC-2 (the order), AC-3 (which Suite management entry, and where it points)
describe('launcher order and Suite management', () => {
  const sys = (system: string, codes: string[] = ['MECHANIC']) => ({
    system,
    name: system,
    description: '',
    url: '',
    roles: codes.map((code) => ({ code, name: code })),
  });

  it('orders BMS, VMMS, VRMS whatever welinc-auth sends', () => {
    expect(orderedSystems([sys('VRMS'), sys('BMS'), sys('VMMS')]).map((s) => s.system)).toEqual(['BMS', 'VMMS', 'VRMS']);
  });

  it('writes today as weekday, month and day', () => {
    expect(todayLabel(new Date(2026, 10, 24, 9))).toMatch(/Tuesday.*November.*24/);
  });

  it('picks no entry, a strip or the large card', () => {
    expect(suiteEntryFor({ systems: [sys('VRMS')] })).toEqual({ kind: 'none' });
    expect(suiteEntryFor({ systems: [], suiteAdmin: true })).toMatchObject({ kind: 'card', system: null });
    expect(suiteEntryFor({ systems: [sys('VRMS')], suiteAdmin: true })).toEqual({
      kind: 'strip',
      suiteAdmin: true,
      system: null,
      line: 'Users and permissions in every system',
    });
  });

  it("points a system admin's links at the first system they administer, in order", () => {
    const entry = suiteEntryFor({ systems: [sys('VRMS', ['ADMIN']), sys('VMMS', ['ADMIN']), sys('BMS')] });
    expect(entry).toEqual({
      kind: 'strip',
      suiteAdmin: false,
      system: 'VMMS',
      line: 'Users and permissions in VMMS, VRMS',
    });
  });
});
