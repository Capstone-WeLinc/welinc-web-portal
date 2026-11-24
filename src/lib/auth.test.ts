import { describe, it, expect } from 'vitest';
import {
  CODE_EXPIRED_MESSAGE,
  codeFailure,
  lockedMessage,
  loginFailure,
  currentSystem,
  isEmailStep,
  loginRequest,
  noticeFor,
  resumeAddress,
  returnPath,
  screenForAnswer,
  signInAgainHref,
  screenForSso,
  ssoFailure,
  startFor,
} from './auth';

// covers: spec 0003 AC-36 (messages, when the form must show, where the login goes next)
const params = (query: string) => new URLSearchParams(query);
const REQUEST = 'a'.repeat(43);
// Suite spec 0016, AC-12a: every launcher answer carries the session's cutoffs
const CUTOFFS = {
  sessionExpiresAt: "2026-11-23T10:30:00.000Z",
  sessionAbsoluteExpiresAt: "2026-11-23T22:00:00.000Z",
  serverTime: "2026-11-23T10:00:00.000Z",
};
const answer = { user: { id: 'u1', name: 'Pedro', email: 'p@welinc.com', picture: null }, systems: [], ...CUTOFFS };

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

  it('keeps a one system admin on the launcher, so the Admin card is reachable', () => {
    const admin = {
      ...answer,
      systems: [{ ...sys('VRMS'), roles: [{ code: 'ADMIN', name: 'Admin' }] }],
    };
    expect(screenForAnswer(params(''), admin)).toEqual({ kind: 'launcher', answer: admin });
    const mechanic = { ...answer, systems: [{ ...sys('VRMS'), roles: [{ code: 'MECHANIC', name: 'Mechanic' }] }] };
    expect(screenForAnswer(params(''), mechanic)).toEqual({ kind: 'go', url: 'http://vrms.test' });
  });

  // covers: suite spec 0013 AC-14 (an admin whose session ended signs in and lands back on the page)
  it('says the session ended and returns an admin to the page they were on', () => {
    expect(noticeFor(params('reason=ended'))?.message).toBe('Your session ended. Sign in again.');
    // Suite spec 0019, AC-15: a sign out is a success, an ended session a warning
    expect(noticeFor(params('reason=logout'))?.tone).toBe('success');
    for (const reason of ['ended', 'idle', 'maxage']) {
      expect(noticeFor(params(`reason=${reason}`))?.tone).toBe('warning');
    }
    expect(noticeFor(params('error=LOGIN_STATE_INVALID'))?.tone).toBe('error');
    expect(startFor(params('reason=ended&next=%2Fadmin%2Fpeople'))).toEqual({ kind: 'form' });
    expect(signInAgainHref('/admin/people/u1?system=VRMS', true)).toBe(
      '/login?reason=ended&next=%2Fadmin%2Fpeople%2Fu1%3Fsystem%3DVRMS',
    );
    expect(signInAgainHref('/admin/overview', false)).toBe('/login?next=%2Fadmin%2Foverview');
    const next = params('reason=ended&next=%2Fadmin%2Fpeople%2Fu1%3Fsystem%3DVRMS');
    expect(screenForAnswer(next, three)).toEqual({ kind: 'go', url: '/admin/people/u1?system=VRMS' });
  });

  it('never returns anywhere outside the admin section', () => {
    for (const next of ['https://evil.test/admin', '//evil.test/admin', '/\\evil.test', '/login', '/administrator', 'admin']) {
      expect(returnPath(params(`next=${encodeURIComponent(next)}`))).toBeNull();
    }
    expect(returnPath(params(''))).toBeNull();
    expect(returnPath(params('next=%2Fadmin'))).toBe('/admin');
    expect(screenForAnswer(params('next=https%3A%2F%2Fevil.test'), one)).toEqual({ kind: 'go', url: 'http://vrms.test' });
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

// covers: suite spec 0009 AC-25 (the step answer and each code error's message)
describe('the email code step', () => {
  const fail = (data: unknown, status = 400, headers: Record<string, string> = {}) => ({
    response: { status, data, headers },
  });

  it('recognises the step answer and nothing else', () => {
    const step = {
      status: 'EMAIL_VERIFICATION_REQUIRED',
      challengeId: 'c'.repeat(43),
      email: 'p@welinc.com',
      resendAfter: 60,
    };
    expect(isEmailStep(step)).toBe(true);
    expect(isEmailStep(answer)).toBe(false);
    expect(isEmailStep({ status: 'EMAIL_VERIFICATION_REQUIRED' })).toBe(false);
    expect(isEmailStep(null)).toBe(false);
  });

  it('says how many tries are left and clears the boxes on a wrong code', () => {
    expect(codeFailure(fail({ code: 'INVALID_CODE', attemptsLeft: 3 }))).toEqual({
      kind: 'message',
      message: "That code isn't right. 3 tries left.",
      clearCode: true,
    });
    expect(codeFailure(fail({ code: 'INVALID_CODE', attemptsLeft: 1 }))).toMatchObject({
      message: "That code isn't right. 1 try left.",
    });
  });

  it('sends a dead code or ticket back to the password step', () => {
    expect(codeFailure(fail({ code: 'CODE_EXPIRED' }))).toEqual({
      kind: 'expired',
    });
    expect(CODE_EXPIRED_MESSAGE).toBe('That code expired. Sign in again to get a new one.');
  });

  it('turns Retry-After into minutes for the send limit', () => {
    expect(codeFailure(fail({ code: 'CODE_SEND_LIMIT' }, 429, { 'retry-after': '600' }))).toMatchObject({
      message: 'Too many codes sent. Try again in 10 minutes.',
    });
    expect(codeFailure(fail({ code: 'CODE_SEND_LIMIT' }, 429, { 'retry-after': '42' }))).toMatchObject({
      message: 'Too many codes sent. Try again in 1 minute.',
    });
  });

  // covers: suite spec 0015 AC-3, AC-5, AC-6
  it('names when a lock ends, and stays general without a time', () => {
    const until = new Date(2026, 10, 13, 15, 42).toISOString();
    expect(lockedMessage(until)).toMatch(/^Too many wrong passwords\. Try again at .*42.*, or reset your password\.$/);
    expect(lockedMessage(undefined)).toBe('Too many wrong passwords. Try again in a few minutes, or reset your password.');
    expect(lockedMessage('not a date')).toContain('in a few minutes');
    expect(codeFailure(fail({ code: 'ACCOUNT_LOCKED', isLocked: true }, 403))).toMatchObject({
      message: expect.stringContaining('Too many wrong passwords'),
    });
  });

  it('words each sign in failure, and never blames the connection for a 429 or a deactivated account', () => {
    expect(loginFailure(fail({ code: 'RATE_LIMITED' }, 429))).toBe(
      'Too many tries from this network. Wait a minute and try again.',
    );
    // An admin account out of sign in codes for the hour: about the account, with the wait
    expect(loginFailure(fail({ code: 'CODE_SEND_LIMIT' }, 429, { 'retry-after': '1500' }))).toBe(
      'This account was sent too many sign in codes. Try again in 25 minutes.',
    );
    expect(loginFailure(fail({ code: 'ACCOUNT_INACTIVE' }, 403))).toBe(
      'This account is deactivated. Ask your admin to turn it back on.',
    );
    expect(codeFailure(fail({ code: 'ACCOUNT_INACTIVE' }, 403))).toMatchObject({
      message: 'This account is deactivated. Ask your admin to turn it back on.',
    });
    expect(loginFailure(fail({ remainingAttempts: 2 }, 401))).toBe('Incorrect email or password.');
    expect(loginFailure(fail({ remainingAttempts: 1 }, 401))).toBe(
      'Incorrect email or password. One more wrong try locks your account for 15 minutes.',
    );
    expect(loginFailure(fail({}, 401))).toBe('Incorrect email or password.');
    expect(loginFailure(fail({}, 500))).toBe('Something went wrong on our side. Try again in a minute.');
    expect(loginFailure(new Error('Network Error'))).toContain('Unable to reach');
  });

  it('has a message for a mail failure and for no connection', () => {
    expect(codeFailure(fail({ code: 'MAIL_FAILED' }, 503))).toMatchObject({
      message: "We couldn't send your code. Try again in a minute.",
    });
    expect(codeFailure(new Error('Network Error'))).toMatchObject({
      kind: 'message',
    });
  });
});
