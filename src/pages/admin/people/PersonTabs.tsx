import { useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe, SystemCode } from '@/lib/admin';
import {
  endPersonSessions,
  errorMessage,
  listPersonSessions,
  personActivity,
  ReauthCancelled,
  type PersonDetail,
} from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ActivityList } from '../activity/ActivityList';
import { ViewError } from '../AdminStates';
import { useAsync } from '../useAsync';
import { PaneCard, SystemChip } from './peopleParts';
import type { PersonActions } from './personActions';
import { actionSystem, activityFilters } from './peopleRules';

/**
 * Suite spec 0017, AC-15: today's sessions list (read with AC-16's system, since the sessions
 * route still needs one), with End all sessions. A person with no role has nothing to show.
 */
export function DevicesTab({
  person,
  me,
  version,
  actions,
}: {
  person: PersonDetail;
  me: AdminMe;
  version: number;
  actions: PersonActions;
}) {
  const system = actionSystem(person, me);
  const self = person.id === me.user.id;
  const [attempt, setAttempt] = useState(0);
  const [ending, setEnding] = useState(false);
  const { state } = useAsync(`${person.id}|${system ?? ''}|${version}|${attempt}`, () =>
    system ? listPersonSessions(person.id, system) : Promise.resolve([]),
  );

  const endAll = async (s: SystemCode) => {
    setEnding(true);
    try {
      await endPersonSessions(person.id, s);
      notifySuccess(`${person.name} is signed out everywhere.`);
      actions.settled();
    } catch (error) {
      if (error instanceof ReauthCancelled) return;
      if (!actions.conflict(error)) notifyError(errorMessage(error, "We couldn't end the sessions."));
    } finally {
      setEnding(false);
    }
  };

  const sessions = state.kind === 'ready' ? state.value : [];
  return (
    <PaneCard
      title="Signed in devices"
      action={
        system &&
        !self &&
        sessions.length > 0 && (
          <Button variant="outline" size="sm" loading={ending} onClick={() => void endAll(system)}>
            End all sessions
          </Button>
        )
      }
    >
      <div className="px-5 py-3">
        {!system && <p className="py-1 text-body text-muted-foreground">No sessions to show.</p>}
        {system && state.kind === 'loading' && (
          <div aria-busy="true" className="flex flex-col gap-2 py-1">
            <span className="sr-only">Loading sessions</span>
            <Skeleton className="h-12" />
          </div>
        )}
        {system && state.kind === 'error' && (
          <ViewError message="We couldn't load their sessions." onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {system && state.kind === 'ready' && sessions.length === 0 && (
          <p className="py-1 text-body text-muted-foreground">Not signed in anywhere right now.</p>
        )}
        {sessions.length > 0 && (
          <ul className="divide-y divide-divider">
            {sessions.map((s) => (
              <li key={s.sid} className="flex items-start gap-3 py-3">
                <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-body break-words text-foreground">{s.device}</p>
                  <p className="text-caption font-normal text-muted-foreground tabular-nums">
                    {s.kind === 'mobile' ? 'Mobile app' : 'Web'} · last active {formatDateTime(s.lastActiveAt)}
                  </p>
                </div>
                <span className="flex shrink-0 gap-1">
                  {s.systems.map((code) => (
                    <SystemChip key={code} system={code} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PaneCard>
  );
}

/**
 * AC-15: the person's events from every system the viewer admins, newest first, each with its
 * system code. The filter is All plus the viewer's systems; there is no type or date filter.
 */
export function ActivityTab({ person, me, version }: { person: PersonDetail; me: AdminMe; version: number }) {
  const [picked, setFilter] = useState<SystemCode | 'all'>('all');
  const systems = activityFilters(person, me);
  // A pick from another person (or a role since removed) falls back to All
  const filter = picked !== 'all' && systems.includes(picked) ? picked : 'all';
  const system = filter === 'all' ? null : filter;
  return (
    <PaneCard
      title="Activity"
      action={
        systems.length > 0 && (
          <SegmentedControl aria-label="System" value={filter} onValueChange={(next) => setFilter(next as SystemCode | 'all')}>
            <SegmentedControlItem value="all">All</SegmentedControlItem>
            {systems.map((s) => (
              <SegmentedControlItem key={s} value={s}>
                {s}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        )
      }
    >
      <div className="py-2">
        <ActivityList
          system={system}
          showSystem
          reloadKey={`${person.id}:${filter}:${version}`}
          load={(cursor) => personActivity(person.id, system, cursor)}
          emptyMessage="Nothing recorded for this person yet."
        />
      </div>
    </PaneCard>
  );
}
