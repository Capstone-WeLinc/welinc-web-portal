import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ API_BASE_URL: 'http://localhost:3000' }));

import { firstName, greetingFor, initialsOf, pictureUrl, roleTag, signedInSystems, signOutLine } from './launcher';

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
