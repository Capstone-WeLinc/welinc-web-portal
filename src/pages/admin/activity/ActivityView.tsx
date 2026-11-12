import type { AdminMe } from '@/lib/admin';
import { systemActivity } from '@/lib/adminApi';
import { NoSystemScope, SystemSwitcher, ViewHeader } from '../AdminStates';
import { useAdminScope } from '../useAdminSystem';
import { ActivityList } from './ActivityList';

/**
 * Suite spec 0013, AC-20, AC-23: account activity, newest first (spec 0011's feed). A system
 * admin reads their system's; a suite admin also gets a Suite wide tab with every person's
 * events, former members included.
 */
export function ActivityView({ me }: { me: AdminMe }) {
  const scope = useAdminScope(me);
  const system = scope.kind === 'ok' ? scope.system : null;
  return (
    <>
      <ViewHeader
        title="Activity"
        context={
          scope.kind !== 'ok'
            ? undefined
            : system
              ? `Sign ins and account changes of ${system} people.`
              : 'Sign ins and account changes of everyone in the suite, former members included.'
        }
      />
      {scope.kind !== 'none' && (
        <div className="mb-4">
          <SystemSwitcher
            value={system}
            choices={scope.choices}
            onChange={scope.choose}
            allLabel={scope.kind === 'ok' && scope.allowAll ? 'Suite wide' : undefined}
          />
        </div>
      )}
      {scope.kind === 'none' && <NoSystemScope />}
      {scope.kind === 'not-admin' && <NoSystemScope asked={scope.asked} />}
      {scope.kind === 'ok' && (
        <ActivityList
          system={system}
          reloadKey={system ?? 'all'}
          showPerson
          load={(cursor) => systemActivity(system, cursor)}
          emptyMessage={system ? `Nothing recorded for ${system} yet.` : 'Nothing recorded yet.'}
        />
      )}
    </>
  );
}
