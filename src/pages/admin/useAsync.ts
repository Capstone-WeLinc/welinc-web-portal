import { useCallback, useEffect, useState } from 'react';

type Settled<T> = { key: string; ok: true; value: T } | { key: string; ok: false; error: unknown };

export type AsyncState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; value: T };

/**
 * Loads once per `key` (put everything the request reads in it, plus a retry counter). Loading
 * is derived, never set inside the effect: an answer for an older key counts as not loaded yet,
 * so a fast switch never shows the previous system's rows. `replace` swaps the loaded value
 * (Load more, or a row that left the list).
 */
export function useAsync<T>(key: string, load: () => Promise<T>) {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (value) => !cancelled && setSettled({ key, ok: true, value }),
      (error: unknown) => !cancelled && setSettled({ key, ok: false, error }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is a new function each render; `key` says when what it reads changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const replace = useCallback(
    (update: (value: T) => T) =>
      setSettled((current) => (current?.key === key && current.ok ? { ...current, value: update(current.value) } : current)),
    [key],
  );

  const state: AsyncState<T> =
    settled?.key !== key
      ? { kind: 'loading' }
      : settled.ok
        ? { kind: 'ready', value: settled.value }
        : { kind: 'error', error: settled.error };
  return { state, replace };
}
