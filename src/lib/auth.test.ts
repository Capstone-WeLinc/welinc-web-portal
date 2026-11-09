import { describe, it, expect } from 'vitest';
import {
  currentSystem,
  loginRequest,
  noticeFor,
  resumeAddress,
  screenForAnswer,
  screenForSso,
  ssoFailure,
  startFor,
} from './auth';

// covers: spec 0003 AC-36 (messages, when the form must show, where the login goes next)
const params = (query: string) => new URLSearchParams(query);
const REQUEST = 'a'.repeat(43);
const answer = { user: { id: 'u1', name: 'Pedro', email: 'p@welinc.com', picture: null }, systems: [] };

describe('portal session helpers', () => {
  it('has a plain message for each error code and reason', () => {
    for (const query of [
      'error=LOGIN_REQUEST_EXPIRED',
      'error=LOGIN_STATE_INVALID',
      'error=LOGIN_FAILED',
      'error=NO_SYSTEM_ACCESS&system=VRMS',
      'reason=idle',
      'reason=maxage',
      'reason=logout',
    ]) {
      expect(noticeFor(params(query))?.message).toBeTruthy();
    }
    expect(noticeFor(params('error=NO_SYSTEM_ACCESS&system=VRMS'))?.message).toContain('VRMS');
    expect(noticeFor(params('reason=maxage'))?.message).toContain('12 hour limit');
    expect(noticeFor(params('reason=maxage'))?.message).not.toContain('30 minutes');
    expect(noticeFor(params('error=SOMETHING_ELSE'))).toBeNull();
    expect(noticeFor(params(''))).toBeNull();
  });

  it('keeps only a well formed login request id', () => {
    expect(loginRequest(params(`request=${REQUEST}`))).toBe(REQUEST);
    expect(loginRequest(params('request=short'))).toBeNull();
    expect(loginRequest(params('request=%3Cscript%3E'))).toBeNull();
  });

  it('resumes the code flow through welinc-auth', () => {
    expect(resumeAddress(REQUEST)).toBe(`http://localhost:3000/auth/authorize/resume?request=${REQUEST}`);
  });
});

// covers: spec 0007 AC-11 to AC-14 (the routing rules), AC-16 ("You're here")
describe('portal routing rules', () => {
  const sys = (system: string) => ({
    system,
    name: system,
    description: 'd',
    url: `http://${system.toLowerCase()}.test`,
    roles: [],
  });
  const one = { ...answer, systems: [sys('VRMS')] };
  const three = { ...answer, systems: [sys('BMS'), sys('VMMS'), sys('VRMS')] };

  it('checks reason first, then request, then a direct visit', () => {
    expect(startFor(params(`reason=logout&request=${REQUEST}`))).toEqual({ kind: 'form' });
    expect(startFor(params('reason=idle'))).toEqual({ kind: 'form' });
    expect(startFor(params(`request=${REQUEST}&error=LOGIN_FAILED`))).toEqual({ kind: 'request', request: REQUEST });
    expect(startFor(params('error=LOGIN_FAILED'))).toEqual({ kind: 'direct' });
    expect(startFor(params(''))).toEqual({ kind: 'direct' });
  });

  it('goes straight in with one system and no error, else shows the launcher', () => {
    expect(screenForAnswer(params(''), one)).toEqual({ kind: 'go', url: 'http://vrms.test' });
    expect(screenForAnswer(params('error=LOGIN_FAILED'), one)).toEqual({ kind: 'launcher', answer: one });
    expect(screenForAnswer(params(''), three)).toEqual({ kind: 'launcher', answer: three });
  });

  it('maps each /auth/sso outcome to its screen', () => {
    expect(screenForSso(params(''), { kind: 'ended' })).toEqual({ kind: 'form' });
    expect(screenForSso(params(''), { kind: 'no-access', email: 'a@welinc.com' })).toEqual({
      kind: 'no-access',
      email: 'a@welinc.com',
    });
    expect(screenForSso(params(''), { kind: 'failed' })).toEqual({ kind: 'error' });
    expect(screenForSso(params(''), { kind: 'live', answer: three }).kind).toBe('launcher');
  });

  it('reads 401, 403 NO_SYSTEM_ACCESS and anything else from a failed call', () => {
    const fail = (status: number, data: unknown = {}) => ({ response: { status, data } });
    expect(ssoFailure(fail(401))).toEqual({ kind: 'ended' });
    expect(ssoFailure(fail(403, { code: 'NO_SYSTEM_ACCESS', user: { email: 'a@welinc.com' } }))).toEqual({
      kind: 'no-access',
      email: 'a@welinc.com',
    });
    expect(ssoFailure(fail(403, { code: 'NO_SYSTEM_ACCESS' }))).toEqual({ kind: 'no-access', email: null });
    expect(ssoFailure(fail(403, { code: 'CSRF_REJECTED' }))).toEqual({ kind: 'failed' });
    expect(ssoFailure(fail(429))).toEqual({ kind: 'failed' });
    expect(ssoFailure(new Error('network'))).toEqual({ kind: 'failed' });
  });

  it('tags only a system the user holds, never anything else in from', () => {
    expect(currentSystem(params('from=VRMS'), three)).toBe('VRMS');
    expect(currentSystem(params('from=https://evil.test'), three)).toBeNull();
    expect(currentSystem(params('from=BMS'), one)).toBeNull();
    expect(currentSystem(params(''), three)).toBeNull();
  });
});
