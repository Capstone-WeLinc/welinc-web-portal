import { afterEach, describe, expect, it, vi } from 'vitest';
import { noticeSessionEnd, onSessionEnded } from './api';

// covers: suite spec 0013 AC-14 (a portal session that ends mid page sends the admin to sign in)

const failure = (status: number, code?: string) => ({ response: { status, data: code ? { code } : {} } });

afterEach(() => onSessionEnded(null));

describe('a portal session that ends mid page', () => {
  it('tells the registered page on 401 NOT_SIGNED_IN, and only then', () => {
    const ended = vi.fn();
    onSessionEnded(ended);
    noticeSessionEnd(failure(403, 'ADMIN_CODE_REQUIRED'));
    noticeSessionEnd(failure(401, 'INVALID_CREDENTIALS'));
    noticeSessionEnd(failure(401));
    noticeSessionEnd(new Error('network'));
    expect(ended).not.toHaveBeenCalled();
    noticeSessionEnd(failure(401, 'NOT_SIGNED_IN'));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no page listens', () => {
    expect(() => noticeSessionEnd(failure(401, 'NOT_SIGNED_IN'))).not.toThrow();
  });
});
