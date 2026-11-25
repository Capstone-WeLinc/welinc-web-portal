import { Link } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsTile } from '@/components/ui/initials-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, listPeople, type ManagedPerson, type RoleSummary, type RolesData } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { ViewEmpty, ViewError } from '../AdminStates';
import { TemporaryTag } from '../people/TemporaryTag';
import { heldRole } from './rolesRules';
import { usePaged } from './usePaged';

/**
 * Suite spec 0018, child 0001 AC-13: the role's holders by name, 25 at a time with Load more.
 * Each row opens the person on People (spec 0017). "Since" is when the person was given the role,
 * "Until" ends a temporary holder's role. `version` reloads the list after Add people.
 */
export function RolePeople({
  data,
  role,
  version,
  onAdd,
}: {
  data: RolesData;
  role: RoleSummary;
  version: number;
  /** Opens Add people; absent when the viewer can't change roles in this system. */
  onAdd?: () => void;
}) {
  const { state, busy, failed, loadMore, retry } = usePaged<ManagedPerson>(
    `${data.system}|${role.code}|${version}`,
    (cursor) => listPeople({ system: data.system, role: role.code, sort: 'name', limit: 25, cursor }),
  );

  return (
    <div className="flex flex-col gap-3">
      {onAdd && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onAdd}>
            <UserPlus aria-hidden="true" />
            Add people
          </Button>
        </div>
      )}
      {state.kind === 'loading' && <PeopleSkeleton />}
      {state.kind === 'error' && (
        <ViewError message={errorMessage(state.error, `We couldn't load the people with ${role.name}.`)} onRetry={retry} />
      )}
      {state.kind === 'ready' && state.value.items.length === 0 && (
        <ViewEmpty
          icon={<Users className="size-5" aria-hidden="true" />}
          message="No one has this role yet"
          action={
            <p className="text-small text-muted-foreground">
              Use “Add people” above, or change a person's role from their page.
            </p>
          }
        />
      )}
      {state.kind === 'ready' && state.value.items.length > 0 && (
        <>
          <ul
            aria-label={`People with ${role.name}`}
            className="divide-y divide-divider overflow-hidden rounded-2xl border border-transparent bg-card shadow-card"
          >
            {state.value.items.map((person) => (
              <li key={person.id}>
                <HolderRow person={person} data={data} role={role} />
              </li>
            ))}
          </ul>
          {state.value.next && (
            <div className="flex flex-col items-start gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={busy}>
                {busy ? 'Loading…' : 'Load more'}
              </Button>
              {failed && (
                <p role="alert" className="text-small text-destructive">
                  We couldn't load more people. Try again.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HolderRow({ person, data, role }: { person: ManagedPerson; data: RolesData; role: RoleSummary }) {
  const held = heldRole(person, data.system, role.code);
  return (
    <Link
      to={`/admin/people/${person.id}`}
      className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <InitialsTile name={person.name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-foreground">{person.name}</span>
        <span className="truncate text-small text-muted-foreground">{person.email}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-small text-muted-foreground">
        {held?.createdAt && (
          <span>
            Since <span className="font-mono">{formatDate(held.createdAt)}</span>
          </span>
        )}
        {held?.temporaryUntil && <TemporaryTag until={held.temporaryUntil} />}
      </span>
    </Link>
  );
}

function PeopleSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
      <span className="sr-only">Loading people</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
