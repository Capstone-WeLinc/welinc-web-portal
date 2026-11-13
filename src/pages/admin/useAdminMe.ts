import { useEffect, useState } from 'react';
import { fetchAdminMe, type AdminMe } from '@/lib/admin';

/**
 * Suite spec 0013, AC-22: who the signed in person administers, from `GET /auth/admin/me`.
 * `null` until it answers, and on a failure, so callers hide admin links rather than break. The
 * check runs again when the tab comes back into focus, so a passing network error doesn't leave
 * an admin without the link.
 */
export function useAdminMe(): AdminMe | null {
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let checking = false;
    const check = () => {
      if (settled || checking) return;
      checking = true;
      fetchAdminMe()
        .then((answer) => {
          settled = true;
          if (!cancelled) setMe(answer);
        })
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    };
    check();
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
    };
  }, []);

  return me;
}
