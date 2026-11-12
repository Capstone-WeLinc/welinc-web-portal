import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe } from '@/lib/admin';
import { errorMessage, listPeople, type ManagedPerson, type PeopleStatus, type Scope } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAsync } from '../useAsync';
import { NoSystemScope, SystemSwitcher, ViewEmpty, ViewError, ViewHeader } from '../AdminStates';
import { roleNames, useSystemsCatalog } from '../useCatalogs';
import type { CatalogSystem } from '@/lib/adminApi';
import { useAdminScope } from '../useAdminSystem';
import { RoleBadge, StatusBadge, SuiteAdminBadge, TemporaryBadge } from './Badges';
import { accountStatus, parseStatus, roleName, STATUS_FILTERS, STATUS_LABELS } from './personStatus';

/** How long typing waits before the search runs. */
const SEARCH_DELAY_MS = 300;

/**
 * Suite spec 0013, AC-17, AC-23: People for one system, or (suite admins) "All people" in the
 * suite, people with no role included, with search, a status filter and Load more. The system,
 * search and status live in the address, so a link reopens the same list.
 */
export function PeopleView({ me }: { me: AdminMe }) {
  const scope = useAdminScope(me);
  const system = scope.kind === 'ok' ? scope.system : null;

  return (
    <>
      <ViewHeader
        title="People"
        context={
          scope.kind !== 'ok'
            ? undefined
            : system
              ? `Everyone who holds a ${system} role.`
              : 'Everyone in the suite, people with no role included. Pick a system to add someone.'
        }
        action={
          system && (
            <Link
              to={`/admin/people/new?system=${system}`}
              className={cn(buttonVariants({ size: 'touch' }), 'w-full sm:w-auto md:h-10')}
            >
              <UserPlus aria-hidden="true" />
              Add person
            </Link>
          )
        }
      />
      {scope.kind !== 'none' && (
        <div className="mb-4">
          <SystemSwitcher
            value={system}
            choices={scope.choices}
            onChange={scope.choose}
            allLabel={scope.kind === 'ok' && scope.allowAll ? 'All people' : undefined}
          />
        </div>
      )}
      {scope.kind === 'none' && <NoSystemScope />}
      {scope.kind === 'not-admin' && <NoSystemScope asked={scope.asked} />}
      {scope.kind === 'ok' && <PeopleList key={system ?? 'all'} system={system} />}
    </>
  );
}

function PeopleList({ system }: { system: Scope }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = parseStatus(params.get('status'));
  const [typed, setTyped] = useState(q);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const catalog = useSystemsCatalog();

  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (value) copy.set(key, value);
        else copy.delete(key);
        return copy;
      },
      { replace: true },
    );

  // Typing waits a moment, then the search moves into the address (and loads)
  useEffect(() => {
    if (typed.trim() === q) return;
    const timer = window.setTimeout(() => setParam('q', typed.trim() || undefined), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // setParam is rebuilt each render; the timer only needs the latest text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, q]);

  const { state: load, replace } = useAsync(`${system ?? 'all'}|${q}|${status ?? ''}|${attempt}`, () =>
    listPeople({ system, q: q || undefined, status }),
  );

  const loadMore = async () => {
    if (load.kind !== 'ready' || !load.value.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listPeople({ system, q: q || undefined, status, cursor: load.value.next });
      replace((current) => ({ items: [...current.items, ...page.items], next: page.next }));
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't load more people."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search by name or email"
            placeholder="Search by name or email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="pl-9"
          />
        </div>
        <StatusFilter value={status} onChange={(next) => setParam('status', next)} />
      </div>

      {load.kind === 'loading' && <PeopleSkeleton />}
      {load.kind === 'error' && (
        <ViewError
          message={errorMessage(load.error, "We couldn't load people.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {load.kind === 'ready' && load.value.items.length === 0 && (
        <ViewEmpty
          icon={<Users className="size-5" aria-hidden="true" />}
          message={
            q || status
              ? 'Nobody matches this search.'
              : system
                ? `Nobody holds a ${system} role yet.`
                : 'Nobody has an account yet.'
          }
        />
      )}
      {load.kind === 'ready' && load.value.items.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {load.value.items.map((person) => (
              <li key={person.id}>
                <PersonRow person={person} system={system} catalog={catalog} />
              </li>
            ))}
          </ul>
          {load.value.next && (
            <Button variant="outline" className="self-start" loading={loadingMore} onClick={() => void loadMore()}>
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PersonRow({
  person,
  system,
  catalog,
}: {
  person: ManagedPerson;
  system: Scope;
  catalog: CatalogSystem[] | null;
}) {
  // In "All people" the page opens in the person's first system (a suite admin can switch there)
  const opensIn = system ?? person.roles[0]?.system;
  return (
    <Link
      to={opensIn ? `/admin/people/${person.id}?system=${opensIn}` : `/admin/people/${person.id}`}
      className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words text-foreground">{person.name}</p>
        <p className="text-xs break-all text-muted-foreground">{person.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {person.suiteAdmin && <SuiteAdminBadge />}
          {person.roles.map((r) => (
            <RoleBadge
              key={`${r.system}:${r.role}`}
              code={r.role}
              name={
                system
                  ? roleName(r.role, roleNames(catalog, r.system))
                  : `${r.system} ${roleName(r.role, roleNames(catalog, r.system))}`
              }
            />
          ))}
          {person.temporaryUntil && <TemporaryBadge until={person.temporaryUntil} />}
          <StatusBadge status={accountStatus(person)} />
          {person.pendingDeletion && <StatusBadge status="PENDING_DELETION" />}
          {person.otherSystems.length > 0 && (
            <span className="text-xs text-muted-foreground">Also in {person.otherSystems.join(', ')}</span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: PeopleStatus | undefined;
  onChange: (next: PeopleStatus | undefined) => void;
}) {
  const options: { value: PeopleStatus | undefined; label: string }[] = [
    { value: undefined, label: 'All' },
    ...STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];
  return (
    <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-lg border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:min-h-9',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PeopleSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-border rounded-lg border border-border">
      <span className="sr-only">Loading people</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
          <Skeleton className="h-5 w-32" />
        </div>
      ))}
    </div>
  );
}
