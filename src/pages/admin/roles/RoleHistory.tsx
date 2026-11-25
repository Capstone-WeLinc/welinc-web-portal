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
    return <ViewError message={errorMessage(state.error, `We couldn't load the history of ${role.name}.`)} onRetry={retry} />;
  }
  if (state.value.items.length === 0) {
    return <ViewEmpty icon={<History className="size-5" aria-hidden="true" />} message="No changes yet" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol
        aria-label={`History of ${role.name}`}
        className="divide-y divide-divider overflow-hidden rounded-2xl border border-transparent bg-card shadow-card"
      >
        {state.value.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body break-words text-foreground">
                <span className="font-medium">{item.actorName}</span> {historyWords(item)}
              </p>
              {item.note && <p className="text-small break-words text-muted-foreground">“{item.note}”</p>}
            </div>
            <time dateTime={item.at} className="shrink-0 font-mono text-caption text-muted-foreground">
              {formatDateTime(item.at)}
            </time>
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
