import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import { errorMessage, type EventPage, type EventView } from '@/lib/adminApi';
import { describeEvent } from './describeEvent';
import { formatDateTime } from '@/lib/format';
import { ViewEmpty, ViewError } from '../AdminStates';
import { useEventCatalog } from '../useCatalogs';
import { useAsync } from '../useAsync';

/**
 * Suite spec 0013, AC-23: a page of account events, newest first, with Load more. `load` is the
 * fetch for one person or for the whole system; `showPerson` adds the person on feed rows.
 */
export function ActivityList({
  load: fetchPage,
  reloadKey,
  showPerson,
  system,
  emptyMessage,
}: {
  load: (cursor?: string) => Promise<EventPage>;
  reloadKey: string;
  showPerson?: boolean;
  /** Null on a suite wide feed: the person link then picks the event's system, if any. */
  system: SystemCode | null;
  emptyMessage: string;
}) {
  const catalog = useEventCatalog();
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const { state: load, replace } = useAsync(`${reloadKey}|${attempt}`, () => fetchPage());

  const more = async () => {
    if (load.kind !== 'ready' || !load.value.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(load.value.nextCursor);
      replace((current) => ({ data: [...current.data, ...page.data], nextCursor: page.nextCursor }));
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't load more activity."));
    } finally {
      setLoadingMore(false);
    }
  };

  if (load.kind === 'loading') {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Loading activity</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (load.kind === 'error') {
    return (
      <ViewError
        message={errorMessage(load.error, "We couldn't load the activity.")}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  const { data, nextCursor } = load.value;
  if (data.length === 0) {
    return <ViewEmpty icon={<History className="size-5" aria-hidden="true" />} message={emptyMessage} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border">
        {data.map((event: EventView) => {
          const { label, details } = describeEvent(event, catalog);
          return (
            <li key={event.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-start sm:gap-4">
              <time dateTime={event.createdAt} className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-32">
                {formatDateTime(event.createdAt)}
              </time>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {showPerson && event.user && (
                    <>
                      <Link
                        to={
                          (system ?? event.system)
                            ? `/admin/people/${event.user.id}?system=${system ?? event.system}`
                            : `/admin/people/${event.user.id}`
                        }
                        className="font-medium break-words text-primary underline-offset-4 hover:underline"
                      >
                        {event.user.name}
                      </Link>
                      {': '}
                    </>
                  )}
                  {label}
                </p>
                {details && <p className="text-xs break-words text-muted-foreground">{details}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <Button variant="outline" className="self-start" loading={loadingMore} onClick={() => void more()}>
          Load more
        </Button>
      )}
    </div>
  );
}
