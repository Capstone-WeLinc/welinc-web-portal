import { useState } from 'react';
import { Clock, KeyRound } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe } from '@/lib/admin';
import { endGrant, errorMessage, listGrants, type TemporaryGrant } from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Segmented, Toolbar, ViewEmpty, ViewError, ViewHeader } from '../AdminStates';
import { useAsync } from '../useAsync';
import { TemporaryAccessDialog } from './TemporaryAccessDialog';
import { goToSignedOut } from '@/lib/session';
import { Cell, DataTable, Muted, PersonCell, Row } from '../AdminTable';

type State = 'live' | 'all';

const END_REASONS: Record<NonNullable<TemporaryGrant['endReason']>, string> = {
  EXPIRED: 'Ran out',
  ENDED_EARLY: 'Ended early',
  SUITE_ADMIN_REMOVED: 'No longer a suite admin',
};

/** The End cell's second line: why it ended and by whom, or that it's still live. */
function endNote(grant: TemporaryGrant): string {
  if (!grant.endedAt) return 'Live';
  const why = grant.endReason ? END_REASONS[grant.endReason] : 'Ended';
  return grant.endedBy ? `${why} by ${grant.endedBy.name}` : why;
}

/**
 * Suite spec 0013, AC-10, AC-11, AC-23, AC-24: temporary access, newest first. A suite admin sees
 * every system and starts their own; a system admin sees their systems' grants and can end one.
 */
export function TemporaryAccessView({ me, onChanged }: { me: AdminMe; onChanged: () => void }) {
  const [state, setState] = useState<State>('live');
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState<TemporaryGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { state: load, replace } = useAsync(`${state}|${attempt}`, () => listGrants({ state }));

  const end = async (grant: TemporaryGrant) => {
    setBusy(true);
    try {
      await endGrant(grant.id);
      if (grant.holder.id === me.user.id) {
        // Your own grant ended your web session (AC-10)
        goToSignedOut();
        return;
      }
      notifySuccess(`${grant.holder.name}'s ${grant.system} access has ended.`);
      setEnding(null);
      setAttempt((n) => n + 1);
      onChanged();
    } catch (error) {
      notifyError(errorMessage(error, "We couldn't end this access."));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (load.kind !== 'ready' || !load.value.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listGrants({ state, cursor: load.value.next });
      replace((current) => ({ items: [...current.items, ...page.items], next: page.next }));
    } catch (error) {
      notifyError(errorMessage(error, "We couldn't load more."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <ViewHeader
        title="Temporary access"
        context={
          me.suiteAdmin
            ? 'Step into a system for a few hours, with a reason.'
            : `Suite admins inside ${me.adminOf.join(' or ')}. You can end their access.`
        }
        action={
          me.suiteAdmin && (
            <Button size="touch" className="w-full sm:w-auto md:h-10" onClick={() => setStarting(true)}>
              <KeyRound aria-hidden="true" />
              Start access
            </Button>
          )
        }
      />
      <Toolbar>
        <Segmented
          label="Which grants"
          value={state}
          onChange={setState}
          options={[
            { value: 'live', label: 'Live now' },
            { value: 'all', label: 'History' },
          ]}
        />
      </Toolbar>

      {load.kind === 'loading' && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}
      {load.kind === 'error' && (
        <ViewError
          message={errorMessage(load.error, "We couldn't load temporary access.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {load.kind === 'ready' && load.value.items.length === 0 && (
        <ViewEmpty
          icon={<Clock className="size-5" aria-hidden="true" />}
          message={state === 'live' ? 'Nobody has temporary access right now.' : 'Nobody has used temporary access yet.'}
        />
      )}
      {load.kind === 'ready' && load.value.items.length > 0 && (
        <div className="flex flex-col gap-4">
          <DataTable
            columns={[
              { label: 'Who' },
              { label: 'Access' },
              { label: 'Reason' },
              { label: 'Started' },
              { label: 'End' },
              { label: <span className="sr-only">Actions</span>, align: 'end' },
            ]}
          >
            {load.value.items.map((grant) => (
              <Row key={grant.id}>
                <Cell>
                  <PersonCell name={grant.holder.name} />
                </Cell>
                <Cell className="md:whitespace-nowrap">
                  {grant.system} {grant.roleName}
                </Cell>
                <Cell className="max-w-sm">
                  <p className="break-words text-foreground">"{grant.reason}"</p>
                </Cell>
                <Cell className="md:whitespace-nowrap">
                  <Muted>
                    <span className="md:hidden">Started </span>
                    <time dateTime={grant.startedAt}>{formatDateTime(grant.startedAt)}</time>
                  </Muted>
                </Cell>
                <Cell>
                  <p className="text-xs text-foreground tabular-nums md:whitespace-nowrap">
                    <span className="md:hidden">Ends </span>
                    <time dateTime={grant.endedAt ?? grant.expiresAt}>
                      {formatDateTime(grant.endedAt ?? grant.expiresAt)}
                    </time>
                  </p>
                  <p className={cn('text-xs', grant.endedAt ? 'text-muted-foreground' : 'font-medium text-success')}>
                    {endNote(grant)}
                  </p>
                </Cell>
                <Cell align="end">
                  {!grant.endedAt && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setEnding(grant)}
                    >
                      End now
                    </Button>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
          {load.value.next && (
            <Button variant="outline" className="self-start" loading={loadingMore} onClick={() => void loadMore()}>
              Load more
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={ending !== null} onOpenChange={(open) => !open && !busy && setEnding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this {ending?.system} access now?</AlertDialogTitle>
            <AlertDialogDescription>
              {ending?.holder.id === me.user.id
                ? 'This signs you out everywhere, the portal too.'
                : `${ending?.holder.name ?? 'They'} loses the role now and is signed out of ${ending?.system}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (ending) void end(ending);
              }}
            >
              {busy ? 'Ending' : 'End access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {me.suiteAdmin && (
        <TemporaryAccessDialog
          open={starting}
          onOpenChange={setStarting}
          onStarted={() => {
            setAttempt((n) => n + 1);
            onChanged();
          }}
        />
      )}
    </>
  );
}
