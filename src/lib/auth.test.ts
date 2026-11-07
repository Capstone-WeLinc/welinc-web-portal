import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  decodeJwt,
  getCurrentUser,
  getReturnSystem,
  getStoredSystem,
  logout,
  setSession,
} from './auth';

function b64url(value: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const token = (payload: object) => `h.${b64url(payload)}.s`;
const future = () => Math.floor(Date.now() / 1000) + 600;
const past = () => Math.floor(Date.now() / 1000) - 600;

afterEach(() => vi.useRealTimers());

describe('decodeJwt', () => {
  it('reads the payload', () => {
    expect(decodeJwt<{ sub: string }>(token({ sub: 'u1' })).sub).toBe('u1');
  });

  it('handles url safe base64 and non ASCII text', () => {
    const decoded = decodeJwt<{ name: string }>(token({ name: 'Peñaflor ✓?>' }));
    expect(decoded.name).toBe('Peñaflor ✓?>');
  });

  it('throws on a token with no payload part', () => {
    expect(() => decodeJwt('nodots')).toThrow('Invalid token');
  });
});

// covers: spec 0002 AC-7 (a return visit goes to the stored system, never worked out from the token)
describe('session storage', () => {
  it('stores the token and the system together', () => {
    setSession('tok', 'VMMS');

    expect(localStorage.getItem('welinc_token')).toBe('tok');
    expect(getStoredSystem()).toBe('VMMS');
  });

  it('overwrites the system on every login', () => {
    setSession('a', 'VRMS');
    setSession('b', 'BMS');

    expect(getStoredSystem()).toBe('BMS');
  });

  it('ignores a stored system that is not one of the three', () => {
    localStorage.setItem('welinc_system', 'ADMIN');

    expect(getStoredSystem()).toBeNull();
  });

  it('logout clears token, user and system', () => {
    setSession('t', 'VRMS');
    localStorage.setItem('welinc_user', '{}');
    logout();

    expect(localStorage.length).toBe(0);
  });
});

describe('getCurrentUser', () => {
  it('returns null with no token', () => {
    expect(getCurrentUser()).toBeNull();
  });

  it('maps sub, email and roles from a live token', () => {
    const roles = [{ role: 'ADMIN', system: 'VRMS' }];
    setSession(token({ sub: 'u1', email: 'a@welinc.com', roles, exp: future() }), 'VRMS');

    expect(getCurrentUser()).toEqual({ id: 'u1', email: 'a@welinc.com', roles });
  });

  it('defaults a missing email and roles', () => {
    setSession(token({ sub: 'u1', exp: future() }), 'VRMS');

    expect(getCurrentUser()).toEqual({ id: 'u1', email: '', roles: [] });
  });

  it('clears the session and returns null for an expired token', () => {
    setSession(token({ sub: 'u1', exp: past() }), 'VRMS');

    expect(getCurrentUser()).toBeNull();
    expect(localStorage.getItem('welinc_token')).toBeNull();
    expect(getStoredSystem()).toBeNull();
  });

  it('clears the session for a malformed token', () => {
    setSession('garbage', 'VRMS');

    expect(getCurrentUser()).toBeNull();
    expect(localStorage.getItem('welinc_token')).toBeNull();
  });

  it('accepts a token with no exp', () => {
    setSession(token({ sub: 'u1' }), 'VRMS');

    expect(getCurrentUser()?.id).toBe('u1');
  });
});

describe('getReturnSystem', () => {
  it('returns the stored system while the token is live', () => {
    setSession(token({ sub: 'u1', exp: future() }), 'BMS');

    expect(getReturnSystem()).toBe('BMS');
  });

  it('returns null once the token has expired, even with a stored system', () => {
    setSession(token({ sub: 'u1', exp: past() }), 'BMS');

    expect(getReturnSystem()).toBeNull();
  });

  it('returns null when a live token has no stored system', () => {
    localStorage.setItem('welinc_token', token({ sub: 'u1', exp: future() }));

    expect(getReturnSystem()).toBeNull();
  });
});
