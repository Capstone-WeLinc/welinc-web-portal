import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Suite spec 0019, AC-3, AC-7: the counts on the launcher's Suite management strip, from
 * welinc-auth's `GET /auth/admin/summary` (any admin, no step up, numbers only). The portal gives
 * up after 3 seconds, holds an answer for 30 seconds in memory, and asks again when the window
 * regains focus after that. A failure or timeout never blocks the launcher: the tiles show a dash.
 */
export type AdminSummary = { needsAttention: number; deletionRequests: number; temporaryGrants?: number };

export type SummaryState = { kind: 'loading' } | { kind: 'ready'; summary: AdminSummary } | { kind: 'failed' };

export const SUMMARY_TIMEOUT_MS = 3_000;
export const SUMMARY_HOLD_MS = 30_000;

let held: { at: number; summary: AdminSummary } | null = null;

const fresh = () => (held && Date.now() - held.at < SUMMARY_HOLD_MS ? held.summary : null);

/** Forgets the held answer (a sign out, tests). */
export function forgetSummary() {
  held = null;
}

/** Asks once, aborting at 3 seconds; resolves to the answer, or null on any failure. */
export async function fetchSummary(): Promise<AdminSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const { data } = await api.get<AdminSummary>('/auth/admin/summary', { signal: controller.signal });
    held = { at: Date.now(), summary: data };
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The strip's counts; `enabled` is false for someone who administers nothing (no call at all). */
export function useAdminSummary(enabled: boolean): SummaryState {
  const [state, setState] = useState<SummaryState>(() => {
    const summary = fresh();
    return summary ? { kind: 'ready', summary } : { kind: 'loading' };
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let asking = false;
    const load = () => {
      const summary = fresh();
      if (summary) {
        setState({ kind: 'ready', summary });
        return;
      }
      if (asking) return;
      asking = true;
      void fetchSummary().then((answer) => {
        asking = false;
        if (!alive) return;
        // A failed refresh keeps numbers already shown; with none, the tiles show a dash
        setState((prev) => (answer ? { kind: 'ready', summary: answer } : prev.kind === 'ready' ? prev : { kind: 'failed' }));
      });
    };
    load();
    const onFocus = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  return state;
}
