import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ API_BASE_URL: 'http://localhost:3000' }));

import { firstName, greetingFor, initialsOf, pictureUrl } from './launcher';

// covers: spec 0007 AC-15 (greeting, first name), AC-17 (picture, initials)
describe('launcher display rules', () => {
  it('greets by the local hour', () => {
    expect(greetingFor(0)).toBe('Good morning');
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
