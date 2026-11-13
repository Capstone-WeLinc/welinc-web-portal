import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { History, KeyRound, LogIn, MonitorSmartphone, UserCog, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import { errorMessage, type EventPage, type EventView } from '@/lib/adminApi';
import { describeEvent } from './describeEvent';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
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

  const days = byDay(data);
  return (
    <div className="flex flex-col gap-3">
      {/* On the feed the list is its own surface; on a person's page it sits inside their card */}
      <div className={cn(showPerson && 'overflow-hidden rounded-lg border border-border bg-card')}>
        {days.map(({ day, events }) => (
          <section key={day} aria-labelledby={`activity-day-${day}`}>
            <h3
              id={`activity-day-${day}`}
              className={cn(
                'flex items-baseline gap-2 border-b border-border bg-muted px-4 py-2 text-xs font-medium text-muted-strong',
                !showPerson && 'rounded-md',
              )}
            >
              <span className="tracking-wide uppercase">{dayWord(day)}</span>
              {dayWord(day) !== day && <span className="tabular-nums">{day}</span>}
            </h3>
            <ul className="divide-y divide-border">
              {events.map((event) => {
                const { label, details } = describeEvent(event, catalog);
                const { icon: Icon, failed } = eventLook(event);
                return (
                  <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <time
                      dateTime={event.createdAt}
                      className="w-11 shrink-0 pt-1 text-xs text-muted-foreground tabular-nums"
                    >
                      {formatTime(event.createdAt)}
                    </time>
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md',
                        failed ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-strong',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm break-words', failed ? 'text-destructive' : 'text-foreground')}>
                        {showPerson && event.user && (
                          <>
                            <Link
                              to={
                                (system ?? event.system)
                                  ? `/admin/people/${event.user.id}?system=${system ?? event.system}`
                                  : `/admin/people/${event.user.id}`
                              }
                              className="font-medium break-words text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                            >
                              {event.user.name}
                            </Link>
                            <span className="text-muted-foreground"> · </span>
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
          </section>
        ))}
      </div>
      {nextCursor && (
        <Button variant="outline" className="self-start" loading={loadingMore} onClick={() => void more()}>
          Load more
        </Button>
      )}
    </div>
  );
}

/** Events that went wrong read in red, so a run of failed sign ins stands out. */
const FAILED_TYPES = new Set(['SIGN_IN_FAILED', 'LOCKED_OUT', 'CODE_MAIL_FAILED', 'PASSWORD_CONFIRM_FAILED']);

/** welinc-auth's four event categories (spec 0011), each with its own icon. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  SIGN_IN: LogIn,
  SESSION: MonitorSmartphone,
  CODE: KeyRound,
  ACCOUNT: UserCog,
};

function eventLook(event: EventView): { icon: LucideIcon; failed: boolean } {
  return { icon: CATEGORY_ICONS[event.category] ?? History, failed: FAILED_TYPES.has(event.type) };
}

/** Newest first in, newest first out: consecutive events grouped under their Manila date. */
function byDay(events: EventView[]): { day: string; events: EventView[] }[] {
  const out: { day: string; events: EventView[] }[] = [];
  for (const event of events) {
    const day = formatDate(event.createdAt);
    const last = out[out.length - 1];
    if (last && last.day === day) last.events.push(event);
    else out.push({ day, events: [event] });
  }
  return out;
}

/** "Today" and "Yesterday" beside the date (design.md: a relative word never replaces it). */
function dayWord(day: string): string {
  const now = Date.now();
  if (day === formatDate(new Date(now).toISOString())) return 'Today';
  if (day === formatDate(new Date(now - 86_400_000).toISOString())) return 'Yesterday';
  return day;
}
