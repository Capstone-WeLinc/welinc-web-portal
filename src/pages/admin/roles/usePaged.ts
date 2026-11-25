import { useState } from 'react';
import { useAsync } from '../useAsync';

type Page<T> = { items: T[]; next: string | null };

/**
 * A list read 25 at a time with Load more (child 0001, AC-13 to AC-15). The first page loads per
 * `key` through `useAsync`; Load more appends the next page to it. A failed Load more keeps the
 * rows and lets the caller show the error beside the button.
 */
export function usePaged<T>(key: string, load: (cursor?: string) => Promise<Page<T>>) {
  const [attempt, setAttempt] = useState(0);
  const { state, replace } = useAsync<Page<T>>(`${key}|${attempt}`, () => load());
  const [more, setMore] = useState<{ key: string; busy: boolean; failed: boolean }>({
    key: '',
    busy: false,
    failed: false,
  });
  const current = more.key === key ? more : { key, busy: false, failed: false };

  const loadMore = async () => {
    if (state.kind !== 'ready' || !state.value.next || current.busy) return;
    setMore({ key, busy: true, failed: false });
    try {
      const page = await load(state.value.next);
      replace((value) => ({ items: [...value.items, ...page.items], next: page.next }));
      setMore({ key, busy: false, failed: false });
    } catch {
      setMore({ key, busy: false, failed: true });
    }
  };

  return {
    state,
    busy: current.busy,
    failed: current.failed,
    loadMore,
    retry: () => setAttempt((n) => n + 1),
  };
}
