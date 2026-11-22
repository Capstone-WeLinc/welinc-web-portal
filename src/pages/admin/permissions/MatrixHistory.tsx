import { useState } from 'react';
import { History } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import { errorMessage, matrixHistory, type MatrixHistoryPage } from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import { ViewEmpty, ViewError } from '../AdminStates';
import { useAsync } from '../useAsync';
import { historyValue } from './matrixDraft';

/** Suite spec 0013, AC-27: every matrix change, newest first, with Load more. */
export function MatrixHistory({ system, reloadKey }: { system: SystemCode; reloadKey: string }) {
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const { state, replace } = useAsync<MatrixHistoryPage>(`${reloadKey}|${attempt}`, () => matrixHistory(system));

  const more = async (cursor: string) => {
    setLoadingMore(true);
    try {
      const page = await matrixHistory(system, cursor);
      replace((current) => ({ items: [...current.items, ...page.items], nextCursor: page.nextCursor }));
    } catch (error) {
      notifyError(errorMessage(error, "We couldn't load more changes."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section aria-labelledby="matrix-history-title">
      <h3 id="matrix-history-title" className="mb-2 text-base font-semibold text-foreground">
        Change history
      </h3>
      {state.kind === 'loading' && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading changes">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {state.kind === 'error' && (
        <ViewError
          message={errorMessage(state.error, "We couldn't load the change history.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {state.kind === 'ready' && state.value.items.length === 0 && (
        <ViewEmpty icon={<History className="size-5" aria-hidden="true" />} message="No changes yet." />
      )}
      {state.kind === 'ready' && state.value.items.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {state.value.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                <p className="text-sm break-words text-foreground">
                  <span className="font-medium">{item.roleName}</span>: {item.label}.{' '}
                  {historyValue(item.before, item.after)}.
                </p>
                <p className="text-xs break-words text-muted-foreground">
                  <span className="tabular-nums">{formatDateTime(item.createdAt)}</span>, by {item.actorName}
                  {item.imported && ', moved from VRMS'}
                </p>
                {item.note && <p className="text-xs break-words text-muted-foreground">Note: {item.note}</p>}
              </li>
            ))}
          </ul>
          {state.value.nextCursor && (
            <Button
              variant="outline"
              className="mt-3"
              disabled={loadingMore}
              onClick={() => state.value.nextCursor && void more(state.value.nextCursor)}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
