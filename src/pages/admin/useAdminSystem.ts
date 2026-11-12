import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminMe, SystemCode } from '@/lib/admin';

export const SYSTEMS: readonly SystemCode[] = ['VRMS', 'VMMS', 'BMS'];

/** `?system=all` (or none, on the views that allow it): a suite admin's suite wide view. */
const ALL = 'all';

export type AdminSystem =
  | { kind: 'ok'; system: SystemCode; choices: SystemCode[]; choose: (next: SystemCode) => void }
  | { kind: 'not-admin'; asked: SystemCode; choices: SystemCode[]; choose: (next: SystemCode) => void }
  | { kind: 'none' };

export type AdminScope =
  | {
      kind: 'ok';
      /** Null: every person in the suite (suite admins only, AC-17). */
      system: SystemCode | null;
      choices: SystemCode[];
      allowAll: boolean;
      choose: (next: SystemCode | null) => void;
    }
  | { kind: 'not-admin'; asked: SystemCode; choices: SystemCode[]; choose: (next: SystemCode | null) => void }
  | { kind: 'none' };

/** Systems the admin may pick: every system for a suite admin, else the ones they admin. */
export function systemChoices(me: AdminMe): SystemCode[] {
  return me.suiteAdmin ? [...SYSTEMS] : me.adminOf;
}

function useChoose() {
  const [params, setParams] = useSearchParams();
  const choose = useCallback(
    (next: SystemCode | null) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set('system', next ?? ALL);
          copy.delete('cursor');
          return copy;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { params, choose };
}

/**
 * Suite spec 0013, AC-16, AC-23: the one system a view acts in, from `?system=` so deep links
 * work. No `system` picks the first choice; one a system admin doesn't run says so instead of
 * switching quietly. A suite admin may pick any system (AC-17).
 */
export function useAdminSystem(me: AdminMe): AdminSystem {
  const { params, choose } = useChoose();
  const choices = systemChoices(me);
  if (choices.length === 0) return { kind: 'none' };
  const asked = SYSTEMS.find((s) => s === params.get('system'));
  if (asked && !choices.includes(asked)) return { kind: 'not-admin', asked, choices, choose };
  return { kind: 'ok', system: asked ?? choices[0], choices, choose: (next) => choose(next) };
}

/**
 * The same, for the views a suite admin may also see suite wide (People, Activity, Deletion
 * requests, AC-17, AC-20, AC-21): for them no `system` (or `all`) means every person.
 */
export function useAdminScope(me: AdminMe): AdminScope {
  const { params, choose } = useChoose();
  const choices = systemChoices(me);
  if (choices.length === 0) return { kind: 'none' };
  const raw = params.get('system');
  const asked = SYSTEMS.find((s) => s === raw);
  if (asked && !choices.includes(asked)) return { kind: 'not-admin', asked, choices, choose };
  if (me.suiteAdmin) {
    return { kind: 'ok', system: asked ?? null, choices, allowAll: true, choose };
  }
  return { kind: 'ok', system: asked ?? choices[0], choices, allowAll: false, choose };
}
