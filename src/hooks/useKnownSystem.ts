import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * The system named in the address, only once `/auth/systems` lists that code; null (shown as
 * "this system") until then, when it doesn't, or when the catalog can't be read. The raw
 * parameter is never shown (suite spec 0014, AC-7).
 */
export function useKnownSystem(system: string | null): string | null {
  const [known, setKnown] = useState<string | null>(null);
  useEffect(() => {
    if (!system) return;
    let cancelled = false;
    api
      .get<{ systems: { code: string }[] }>('/auth/systems')
      .then(({ data }) => {
        const match = data.systems.find((s) => s.code === system);
        if (!cancelled && match) setKnown(match.code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [system]);
  return known;
}
