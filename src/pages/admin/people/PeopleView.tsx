import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe } from '@/lib/admin';
import { errorMessage, listPeople, type ManagedPerson, type PeopleStatus, type Scope } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { notifyError } from '@/lib/notify';
import { useAsync } from '../useAsync';
import { NoSystemScope, SystemSwitcher, Toolbar, ViewEmpty, ViewError, ViewHeader } from '../AdminStates';
import { roleNames, useSystemsCatalog } from '../useCatalogs';
import type { CatalogSystem } from '@/lib/adminApi';
import { useAdminScope } from '../useAdminSystem';
import { StatusBadge, SuiteAdminBadge, TemporaryBadge } from './Badges';
import { RoleChip } from '@/components/ui/role-chip';
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
              : 'Everyone in the suite. Pick a system to add someone.'
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
        <Toolbar>
          <SystemSwitcher
            value={system}
            choices={scope.choices}
            onChange={scope.choose}
            allowAll={scope.kind === 'ok' && scope.allowAll}
          />
        </Toolbar>
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
      notifyError(errorMessage(error, "We couldn't load more people."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
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
          {/* design.md: a table from md up, stacked rows on phones */}
          <PeopleTable people={load.value.items} system={system} catalog={catalog} />
          <ul className="divide-y divide-border rounded-2xl border border-transparent bg-card shadow-card md:hidden">
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

/** Where a person's page opens: the listed system, or (All people) their first system. */
function personHref(person: ManagedPerson, system: Scope): string {
  const opensIn = system ?? person.roles[0]?.system;
  return opensIn ? `/admin/people/${person.id}?system=${opensIn}` : `/admin/people/${person.id}`;
}

function PersonRoles({
  person,
  system,
  catalog,
}: {
  person: ManagedPerson;
  system: Scope;
  catalog: CatalogSystem[] | null;
}) {
  return (
    <>
      {person.suiteAdmin && <SuiteAdminBadge />}
      {person.roles.map((r) => (
        <RoleChip key={`${r.system}:${r.role}`}>
          {system
            ? roleName(r.role, roleNames(catalog, r.system))
            : `${r.system} ${roleName(r.role, roleNames(catalog, r.system))}`}
        </RoleChip>
      ))}
      {person.temporaryUntil && <TemporaryBadge until={person.temporaryUntil} />}
    </>
  );
}

function PersonStatus({ person }: { person: ManagedPerson }) {
  return (
    <>
      <StatusBadge status={accountStatus(person)} />
      {person.pendingDeletion && <StatusBadge status="PENDING_DELETION" />}
    </>
  );
}

const TH = 'px-4 py-2.5 text-left text-label text-muted-strong';

/**
 * design.md tables: a light header, divided rows, the whole row one link (the name cell's link
 * stretches over the row, so the row reads and tabs as one stop).
 */
function PeopleTable({
  people,
  system,
  catalog,
}: {
  people: ManagedPerson[];
  system: Scope;
  catalog: CatalogSystem[] | null;
}) {
  const showOther = people.some((p) => p.otherSystems.length > 0);
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-transparent bg-card shadow-card md:block">
      <table className="w-full text-body">
        <thead className="bg-muted">
          <tr>
            {/* break-all lets the browser shrink this column until emails split mid word; a floor keeps a typical address whole */}
            <th scope="col" className={cn(TH, 'min-w-64')}>
              Person
            </th>
            <th scope="col" className={TH}>
              {system ? `${system} roles` : 'Roles'}
            </th>
            {showOther && (
              <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>
                Also in
              </th>
            )}
            <th scope="col" className={TH}>
              Status
            </th>
            <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>
              Added
            </th>
            <th scope="col" className="w-10">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {people.map((person) => (
            <tr key={person.id} className="relative transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/50">
              <td className="px-4 py-3 align-middle">
                <Link
                  to={personHref(person, system)}
                  className="font-medium break-words text-foreground after:absolute after:inset-0 focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {person.name}
                </Link>
                <p className="text-caption break-all text-muted-foreground">{person.email}</p>
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex flex-wrap gap-1.5">
                  <PersonRoles person={person} system={system} catalog={catalog} />
                </div>
              </td>
              {showOther && (
                <td className="hidden px-4 py-3 align-middle text-caption text-muted-foreground lg:table-cell">
                  {person.otherSystems.length > 0 ? person.otherSystems.join(', ') : '—'}
                </td>
              )}
              <td className="px-4 py-3 align-middle">
                <div className="flex flex-wrap gap-1.5">
                  <PersonStatus person={person} />
                </div>
              </td>
              <td className="hidden px-4 py-3 align-middle text-caption whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
                {formatDate(person.createdAt)}
              </td>
              <td className="px-2 py-3 align-middle">
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  return (
    <Link
      to={personHref(person, system)}
      className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium break-words text-foreground">{person.name}</p>
        <p className="text-caption break-all text-muted-foreground">{person.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <PersonRoles person={person} system={system} catalog={catalog} />
          <PersonStatus person={person} />
          {person.otherSystems.length > 0 && (
            <span className="text-caption text-muted-foreground">Also in {person.otherSystems.join(', ')}</span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/** The status filter: a select beside the search, so it doesn't look like a second system switcher. */
function StatusFilter({
  value,
  onChange,
}: {
  value: PeopleStatus | undefined;
  onChange: (next: PeopleStatus | undefined) => void;
}) {
  return (
    <div className="relative sm:w-56">
      <select
        aria-label="Status"
        value={value ?? ''}
        onChange={(e) => onChange(parseStatus(e.target.value))}
        className="h-11 w-full appearance-none rounded-lg border border-input bg-card pr-9 pl-3 text-base-input text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-10 md:text-body"
      >
        <option value="">Every status</option>
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

function PeopleSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-border rounded-2xl border border-transparent bg-card shadow-card">
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
