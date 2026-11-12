import { afterEach, describe, expect, it, vi } from 'vitest';
import { landingView, viewsFor } from '../pages/admin/adminViews';
import { isAdmin, needsCode, registerStepUpHost, withStepUp, type AdminMe } from './admin';
import { isEmailStep } from './auth';

vi.mock('./api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));

// covers: suite spec 0013 AC-5, AC-15, AC-22, AC-23

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'u1', name: 'Ramon', email: 'suite.admin@welinc.com', picture: null },
  suiteAdmin: false,
  adminOf: [],
  codeRequired: true,
  codePassed: false,
  ...over,
});

const codeRequired = () => ({ response: { status: 403, data: { code: 'ADMIN_CODE_REQUIRED' } } });

afterEach(() => registerStepUpHost(null));

describe('admin standing', () => {
  it('counts a suite admin or any system admin, nobody else', () => {
    expect(isAdmin(me())).toBe(false);
    expect(isAdmin(me({ suiteAdmin: true }))).toBe(true);
    expect(isAdmin(me({ adminOf: ['VRMS'] }))).toBe(true);
    expect(isAdmin(null)).toBe(false);
  });

  it('owes the code only while it is required and not passed', () => {
    expect(needsCode(me())).toBe(true);
    expect(needsCode(me({ codePassed: true }))).toBe(false);
    expect(needsCode(me({ codeRequired: false }))).toBe(false);
  });

  it('shows suite only views to suite admins and lands each on their first view', () => {
    const suite = me({ suiteAdmin: true });
    const system = me({ adminOf: ['VRMS'] });
    expect(viewsFor(suite).map((v) => v.path)).toContain('overview');
    expect(viewsFor(system).map((v) => v.path)).not.toContain('suite-admins');
    expect(landingView(suite)).toBe('overview');
    expect(landingView(system)).toBe('people');
  });

  it('reads the admin sign in step as a code step', () => {
    expect(
      isEmailStep({ status: 'SIGN_IN_CODE_REQUIRED', challengeId: 'c', email: 'a@welinc.com', resendAfter: 60 }),
    ).toBe(true);
  });
});

describe('withStepUp', () => {
  it('asks for the code once and retries the call once', async () => {
    const host = vi.fn(() => Promise.resolve(true));
    registerStepUpHost(host);
    const call = vi.fn().mockRejectedValueOnce(codeRequired()).mockResolvedValueOnce('ok');
    await expect(withStepUp(call)).resolves.toBe('ok');
    expect(host).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('keeps the error when the dialog is closed, and passes other errors straight through', async () => {
    registerStepUpHost(() => Promise.resolve(false));
    const refused = vi.fn().mockRejectedValue(codeRequired());
    await expect(withStepUp(refused)).rejects.toEqual(codeRequired());
    expect(refused).toHaveBeenCalledTimes(1);

    const other = { response: { status: 403, data: { code: 'NOT_AN_ADMIN' } } };
    const host = vi.fn(() => Promise.resolve(true));
    registerStepUpHost(host);
    await expect(withStepUp(vi.fn().mockRejectedValue(other))).rejects.toBe(other);
    expect(host).not.toHaveBeenCalled();
  });

  it('shares one dialog between calls that need the code at once', async () => {
    let open: (passed: boolean) => void = () => {};
    const host = vi.fn(() => new Promise<boolean>((resolve) => (open = resolve)));
    registerStepUpHost(host);
    const a = withStepUp(vi.fn().mockRejectedValueOnce(codeRequired()).mockResolvedValueOnce('a'));
    const b = withStepUp(vi.fn().mockRejectedValueOnce(codeRequired()).mockResolvedValueOnce('b'));
    await vi.waitFor(() => expect(host).toHaveBeenCalledTimes(1));
    open(true);
    await expect(Promise.all([a, b])).resolves.toEqual(['a', 'b']);
    expect(host).toHaveBeenCalledTimes(1);
  });
});
