import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import { errorMessage, roleHistory, type RoleHistoryItem, type RoleSummary } from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import { ViewEmpty, ViewError } from '../AdminStates';
import { historyWords } from './rolesRules';
import { usePaged } from './usePaged';

/**
 * Suite spec 0018, child 0001 AC-15: one role's history newest first, 25 at a time with Load more.
 * The server merges the role's permission changes and role events and leaves out the cell rows a
 * create or delete writes. `version` reloads it after a save.
 */
export function RoleHistory({ system, role, version }: { system: SystemCode; role: RoleSummary; version: string }) {
  const { state, busy, failed, loadMore, retry } = usePaged<RoleHistoryItem>(`${system}|${role.code}|${version}`, (cursor) =>
    roleHistory(system, role.code, cursor),
  );

  if (state.kind === 'loading') {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
        <span className="sr-only">Loading the history</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (state.kind === 'error') {
    return <ViewError kind="tile" subject="history" message={errorMessage(state.error, `We couldn't load the history of ${role.name}.`)} onRetry={retry} />;
  }
  if (state.value.items.length === 0) {
    return <ViewEmpty icon={<History className="size-5" aria-hidden="true" />} message="No changes yet" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol
        aria-label={`History of ${role.name}`}
        className="flex flex-col rounded-2xl bg-card px-5 pt-4.5 pb-1 shadow-card"
      >
        {state.value.items.map((item) => (
          <li key={item.id} className="flex gap-3 pb-4.5">
            <span aria-hidden="true" className="flex w-6 shrink-0 justify-center pt-1.25">
              <span className="size-2.5 rounded-full bg-card ring-2 ring-primary" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body break-words text-foreground">
                <span className="font-semibold">{item.actorName}</span> {historyWords(item)}
              </p>
              {item.note && (
                <p className="mt-1 rounded-md bg-background px-2.5 py-1.5 text-small break-words text-muted-strong">
                  “{item.note}”
                </p>
              )}
              <time dateTime={item.at} className="font-mono text-caption text-muted-foreground">
                {formatDateTime(item.at)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {state.value.next && (
        <div className="flex flex-col items-start gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={busy}>
            {busy ? 'Loading…' : 'Load more'}
          </Button>
          {failed && (
            <p role="alert" className="text-small text-destructive">
              We couldn't load more changes. Try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
