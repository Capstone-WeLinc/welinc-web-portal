import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ API_BASE_URL: 'http://localhost:3000' }));

import {
  accountInitials,
  coversLine,
  firstName,
  greetingFor,
  initialsOf,
  orderedSystems,
  pictureUrl,
  roleTag,
  signedInSystems,
  keyTarget,
  signOutLine,
  suiteTileFor,
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

  it('names the first real role, in catalog order, for everyone else', () => {
    expect(roleTag(system([{ code: 'CHIEF_MECHANIC', name: 'Chief Mechanic' }]))).toBe('Chief Mechanic');
    expect(roleTag(system([{ code: 'CHIEF_MECHANIC', name: 'Chief Mechanic' }, { code: 'MECHANIC', name: 'Mechanic' }]))).toBe(
      'Chief Mechanic',
    );
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

  it('gives no Suite management tile to someone who administers nothing', () => {
    expect(suiteTileFor({ systems: [sys('VRMS')] })).toBeNull();
  });

  it('covers every system for a suite admin, even one with a single other role', () => {
    expect(suiteTileFor({ systems: [], suiteAdmin: true })).toEqual({ covers: ['BMS', 'VMMS', 'VRMS'] });
    expect(suiteTileFor({ systems: [sys('VRMS')], suiteAdmin: true })).toEqual({ covers: ['BMS', 'VMMS', 'VRMS'] });
  });

  it('covers only the systems a system admin administers, in order', () => {
    expect(suiteTileFor({ systems: [sys('VRMS', ['ADMIN']), sys('VMMS', ['ADMIN']), sys('BMS')] })).toEqual({
      covers: ['VMMS', 'VRMS'],
    });
  });

  it('writes the For line', () => {
    expect(coversLine(['VRMS'])).toBe('For VRMS');
    expect(coversLine(['VMMS', 'VRMS'])).toBe('For VMMS and VRMS');
    expect(coversLine(['BMS', 'VMMS', 'VRMS'])).toBe('For BMS, VMMS and VRMS');
  });
});

// covers: suite spec 0019 AC-1 (the account circle), AC-2 (P5 number keys)
describe('account initials and number keys', () => {
  it('uses the initials, or the email letter when there is no name', () => {
    expect(accountInitials({ name: 'Armando Cruz', email: 'a@welinc.com' })).toBe('AC');
    expect(accountInitials({ name: '  ', email: 'pedro@welinc.com' })).toBe('P');
  });

  const key = (k: string, over: Partial<KeyboardEvent> = {}) => ({
    key: k,
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
  });

  it('maps a plain digit to its tile', () => {
    expect(keyTarget(key('1'), 4)).toBe(0);
    expect(keyTarget(key('4'), 4)).toBe(3);
  });

  it('ignores a digit with no tile, other keys, repeats and modifiers', () => {
    expect(keyTarget(key('9'), 4)).toBeNull();
    expect(keyTarget(key('0'), 4)).toBeNull();
    expect(keyTarget(key('a'), 4)).toBeNull();
    expect(keyTarget(key('2', { repeat: true }), 4)).toBeNull();
    expect(keyTarget(key('2', { metaKey: true }), 4)).toBeNull();
    expect(keyTarget(key('2', { ctrlKey: true }), 4)).toBeNull();
    expect(keyTarget(key('2', { altKey: true }), 4)).toBeNull();
    expect(keyTarget(key('2', { shiftKey: true }), 4)).toBeNull();
  });
});
