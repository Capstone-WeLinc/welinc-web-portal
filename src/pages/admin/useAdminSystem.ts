import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminMe, SystemCode } from '@/lib/admin';

const SYSTEMS: readonly SystemCode[] = ['VRMS', 'VMMS', 'BMS'];

export type AdminSystem =
  | { kind: 'ok'; system: SystemCode; choices: SystemCode[]; choose: (next: SystemCode) => void }
  | { kind: 'not-admin'; asked: SystemCode; choices: SystemCode[]; choose: (next: SystemCode) => void }
  | { kind: 'none' };

/**
 * Suite spec 0013, AC-16, AC-23: the system a view acts in, from `?system=` so deep links work.
 * No `system` picks the admin's first; one they don't admin says so instead of switching quietly.
 * A suite admin holds no system role, so until slice 3 adds suite scope they get `none`.
 */
export function useAdminSystem(me: AdminMe): AdminSystem {
  const [params, setParams] = useSearchParams();
  const choices = me.adminOf;
  const choose = useCallback(
    (next: SystemCode) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set('system', next);
          copy.delete('cursor');
          return copy;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  if (choices.length === 0) return { kind: 'none' };
  const raw = params.get('system');
  const asked = SYSTEMS.find((s) => s === raw);
  if (asked && !choices.includes(asked)) return { kind: 'not-admin', asked, choices, choose };
  return { kind: 'ok', system: asked ?? choices[0], choices, choose };
}
