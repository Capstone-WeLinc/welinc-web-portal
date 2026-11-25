import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from './api';
import { SUMMARY_HOLD_MS, SUMMARY_TIMEOUT_MS, fetchSummary, forgetSummary, useAdminSummary } from './adminSummary';

vi.mock('./api', () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
const SUMMARY = { needsAttention: 3, deletionRequests: 1, temporaryGrants: 2 };

beforeEach(() => {
  forgetSummary();
  get.mockReset();
});
afterEach(() => vi.useRealTimers());

// covers: suite spec 0019 AC-7 (the 3 s timeout, the 30 s hold, the refetch on focus), AC-3 (the dash)
describe('admin summary', () => {
  it('aborts the call at 3 seconds and answers null', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    get.mockImplementation((_url, config) => {
      signal = config?.signal as AbortSignal;
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const answer = fetchSummary();
    await vi.advanceTimersByTimeAsync(SUMMARY_TIMEOUT_MS);
    expect(signal?.aborted).toBe(true);
    await expect(answer).resolves.toBeNull();
  });

  it('shows the counts, holds them for 30 seconds, and asks again on focus after that', async () => {
    get.mockResolvedValue({ data: SUMMARY });
    const { result } = renderHook(() => useAdminSummary(true));
    expect(result.current).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current).toEqual({ kind: 'ready', summary: SUMMARY }));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(get).toHaveBeenCalledTimes(1);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + SUMMARY_HOLD_MS + 1);
    get.mockResolvedValue({ data: { ...SUMMARY, needsAttention: 4 } });
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current).toMatchObject({ summary: { needsAttention: 4 } }));
    expect(get).toHaveBeenCalledTimes(2);
    vi.mocked(Date.now).mockRestore();
  });

  it('fails to a dash, and never asks for someone who administers nothing', async () => {
    get.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useAdminSummary(true));
    await waitFor(() => expect(result.current).toEqual({ kind: 'failed' }));

    get.mockClear();
    renderHook(() => useAdminSummary(false));
    expect(get).not.toHaveBeenCalled();
  });
});
