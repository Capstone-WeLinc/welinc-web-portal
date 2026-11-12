import { useState } from 'react';
import { Clock, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
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
import { ViewEmpty, ViewError, ViewHeader } from '../AdminStates';
import { useAsync } from '../useAsync';
import { TemporaryAccessDialog } from './TemporaryAccessDialog';

type State = 'live' | 'all';

const END_REASONS: Record<NonNullable<TemporaryGrant['endReason']>, string> = {
  EXPIRED: 'ran out',
  ENDED_EARLY: 'ended early',
  SUITE_ADMIN_REMOVED: 'ended when they stopped being a suite admin',
};

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
        window.location.assign('/login?reason=logout');
        return;
      }
      toast.success(`${grant.holder.name}'s ${grant.system} access has ended.`);
      setEnding(null);
      setAttempt((n) => n + 1);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't end this access."));
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
      toast.error(errorMessage(error, "We couldn't load more."));
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
            ? 'Short, reasoned access a suite admin gives themselves to look inside a system.'
            : `Suite admins who stepped into ${me.adminOf.join(' or ')}. You can end their access.`
        }
        action={
          me.suiteAdmin && (
            <Button size="touch" className="w-full sm:w-auto md:h-10" onClick={() => setStarting(true)}>
              <KeyRound aria-hidden="true" />
              Temporary access
            </Button>
          )
        }
      />
      <div role="radiogroup" aria-label="Which grants" className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['live', 'Live now'],
            ['all', 'History'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={state === value}
            onClick={() => setState(value)}
            className={cn(
              'min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:min-h-9',
              state === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

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
          <ul className="divide-y divide-border rounded-lg border border-border">
            {load.value.items.map((grant) => (
              <li key={grant.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-foreground">
                    {grant.holder.name} · {grant.system} {grant.roleName}
                  </p>
                  <p className="mt-1 text-sm break-words text-foreground">"{grant.reason}"</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(grant.startedAt)} to {formatDateTime(grant.endedAt ?? grant.expiresAt)}
                    {grant.endReason &&
                      ` · ${END_REASONS[grant.endReason]}${grant.endedBy ? ` by ${grant.endedBy.name}` : ''}`}
                  </p>
                </div>
                {!grant.endedAt && (
                  <Button variant="outline" className="shrink-0" disabled={busy} onClick={() => setEnding(grant)}>
                    End now
                  </Button>
                )}
              </li>
            ))}
          </ul>
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
                ? 'This signs you out everywhere, the portal included, so you will sign in again.'
                : `${ending?.holder.name ?? 'They'} loses the role at once and is signed out of every session that opened ${ending?.system}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
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
