import type { AdminMe } from '@/lib/admin';
import { systemActivity } from '@/lib/adminApi';
import { NoSystemScope, SystemSwitcher, ViewHeader } from '../AdminStates';
import { useAdminSystem } from '../useAdminSystem';
import { ActivityList } from './ActivityList';

/**
 * Suite spec 0013, AC-23: the system's account activity for its admins (spec 0011's feed), newest
 * first. The Suite wide tab for suite admins comes with slice 3.
 */
export function ActivityView({ me }: { me: AdminMe }) {
  const scope = useAdminSystem(me);
  const system = scope.kind === 'ok' ? scope.system : null;
  return (
    <>
      <ViewHeader
        title="Activity"
        context={system ? `Sign ins and account changes of ${system} people.` : undefined}
      />
      {scope.kind !== 'none' && (
        <div className="mb-4">
          <SystemSwitcher value={system} choices={scope.choices} onChange={scope.choose} />
        </div>
      )}
      {scope.kind === 'none' && <NoSystemScope />}
      {scope.kind === 'not-admin' && <NoSystemScope asked={scope.asked} />}
      {system && (
        <ActivityList
          system={system}
          reloadKey={system}
          showPerson
          load={(cursor) => systemActivity(system, cursor)}
          emptyMessage={`Nothing recorded for ${system} yet.`}
        />
      )}
    </>
  );
}
