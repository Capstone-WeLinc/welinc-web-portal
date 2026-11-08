import { describe, it, expect } from 'vitest';
import { loginRequest, mayContinueSession, nextAddress, noticeFor } from './auth';

// covers: spec 0003 AC-36 (messages, when the form must show, where the login goes next)
const params = (query: string) => new URLSearchParams(query);
const REQUEST = 'a'.repeat(43);
const answer = { user: { id: 'u1', name: 'Pedro', email: 'p@welinc.com' }, system: 'VRMS', url: 'http://localhost:8001' };

describe('portal session helpers', () => {
  it('has a plain message for each error code and reason', () => {
    for (const query of [
      'error=LOGIN_REQUEST_EXPIRED',
      'error=LOGIN_STATE_INVALID',
      'error=LOGIN_FAILED',
      'error=NO_SYSTEM_ACCESS&system=VRMS',
      'reason=idle',
      'reason=logout',
    ]) {
      expect(noticeFor(params(query))?.message).toBeTruthy();
    }
    expect(noticeFor(params('error=NO_SYSTEM_ACCESS&system=VRMS'))?.message).toContain('VRMS');
    expect(noticeFor(params('error=SOMETHING_ELSE'))).toBeNull();
    expect(noticeFor(params(''))).toBeNull();
  });

  it('never skips the form after a logout, an idle cutoff or with an error to read', () => {
    expect(mayContinueSession(params(''))).toBe(true);
    expect(mayContinueSession(params(`request=${REQUEST}`))).toBe(true);
    expect(mayContinueSession(params('reason=logout'))).toBe(false);
    expect(mayContinueSession(params('reason=idle'))).toBe(false);
    expect(mayContinueSession(params('error=LOGIN_FAILED'))).toBe(false);
  });

  it('keeps only a well formed login request id', () => {
    expect(loginRequest(params(`request=${REQUEST}`))).toBe(REQUEST);
    expect(loginRequest(params('request=short'))).toBeNull();
    expect(loginRequest(params('request=%3Cscript%3E'))).toBeNull();
  });

  it('resumes the code flow with a request, else goes to the system address', () => {
    expect(nextAddress(REQUEST, answer)).toBe(
      `http://localhost:3000/auth/authorize/resume?request=${REQUEST}`,
    );
    expect(nextAddress(null, answer)).toBe('http://localhost:8001');
  });
});
