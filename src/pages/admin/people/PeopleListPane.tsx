import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Plus, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InitialsTile } from '@/components/ui/initials-tile';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe, SystemCode } from '@/lib/admin';
import {
  errorMessage,
  listPeople,
  type CatalogSystem,
  type ManagedPerson,
  type PeopleCounts,
  type PeopleGroup,
  type PeoplePage,
  type PeopleSort,
} from '@/lib/adminApi';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { ViewError } from '../AdminStates';
import { useAsync } from '../useAsync';
import { useSystemsCatalog } from '../useCatalogs';
import { SystemChip } from './peopleParts';
import { PeopleFilter } from './PeopleFilter';
import { addSystem, filterCount, filterSystems, NO_PICKS, parsePicks, picksToParams, type FilterPicks } from './filterRules';
import {
  isPending,
  parseListSystem,
  parseSort,
  PEOPLE_GROUPS,
  PEOPLE_PAGE_SIZE,
  PEOPLE_SORTS,
  sortLabel,
  subLine,
  systemChips,
} from './peopleRules';

/** How long typing waits before the search runs. */
const SEARCH_DELAY_MS = 300;

/**
 * The list's inputs from the address (AC-1, AC-3): `?q`, `?system`, `?sort`, plus suite spec
 * 0019's `?status` and `?access` (AC-21). Stale filter values are dropped and the address
 * rewritten before any call; `rolesPending` holds the calls until the catalog can check roles.
 */
function useListParams(me: AdminMe, catalog: CatalogSystem[] | null) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const system = parseListSystem(me, params.get('system'));
  const sort = parseSort(params.get('sort'));
  const raw = { status: params.get('status'), access: params.get('access') };
  const { picks, rolesPending } = parsePicks(raw, filterSystems(me, system), catalog);
  const clean = picksToParams(picks);
  const stale = !rolesPending && (clean.status !== raw.status || clean.access !== raw.access);
  const set = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) copy.set(key, value);
          else copy.delete(key);
        }
        return copy;
      },
      { replace: true },
    );

  useEffect(() => {
    if (stale) set(clean);
    // set is rebuilt each render; the clean values are in the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, clean.status, clean.access]);

  return { q, system, sort, picks, filters: clean, waiting: rolesPending || stale, set };
}

type ListInputs = {
  q: string;
  system: SystemCode | null;
  sort: PeopleSort;
  filters: { status: string | null; access: string | null };
  /** Stale filters are being dropped: no call until the address is clean. */
  waiting: boolean;
  attempt: number;
};

/**
 * Suite spec 0017, AC-3 to AC-6 (board `People8`): the 360px list pane. Three server groups,
 * each with its count and its own Load more; the selected row is marked, never fetched or
 * scrolled to when it isn't in the loaded pages (AC-1).
 */
export function PeopleListPane({
  me,
  selectedId,
  reloadKey,
  onSelect,
  onAdd,
}: {
  me: AdminMe;
  selectedId: string | undefined;
  /** Bumped after an action on the person pane, so the groups load again (AC-18). */
  reloadKey: number;
  onSelect: (id: string) => void;
  /** Opens Add person over the page, keeping the open person, the search and the sort. */
  onAdd: (system: SystemCode | null) => void;
}) {
  const catalog = useSystemsCatalog();
  const { q, system, sort, picks, filters, waiting, set } = useListParams(me, catalog);
  const [typed, setTyped] = useState(q);
  const [attempt, setAttempt] = useState(0);
  const filtered = filterCount(picks) > 0;

  // Typing waits a moment, then the search moves into the address (and loads)
  useEffect(() => {
    if (typed.trim() === q) return;
    const timer = window.setTimeout(() => set({ q: typed.trim() || null }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // set is rebuilt each render; the timer only needs the latest text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, q]);

  const inputs: ListInputs = { q, system, sort, filters, waiting, attempt: attempt + reloadKey };
  const attention = useGroup('attention', inputs);
  const active = useGroup('active', inputs);
  const inactive = useGroup('inactive', inputs);
  const groups = { attention, active, inactive };
  const states = [attention, active, inactive];

  const counts = states.find((g) => g.state.kind === 'ready' && g.state.value.counts)?.state;
  const totals: PeopleCounts | null = counts?.kind === 'ready' ? (counts.value.counts ?? null) : null;
  const loading = states.some((g) => g.state.kind === 'loading');
  const failed = states.find((g) => g.state.kind === 'error')?.state;
  const total = totals ? totals.attention + totals.active + totals.inactive : 0;

  const clearAll = () => {
    setTyped('');
    set({ q: null, system: null, status: null, access: null });
  };
  const applyPicks = (next: FilterPicks) => set(picksToParams(next));
  const add = () => onAdd(addSystem(system, picks));

  return (
    <section aria-label="People" className="flex min-h-0 flex-col bg-card lg:h-full">
      <div className="flex flex-col gap-3 px-5 pt-6 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <h1 id="admin-view-title" className="text-title text-foreground">
            People
          </h1>
          <Button size="sm" onClick={add}>
            <Plus aria-hidden="true" />
            Add user
          </Button>
        </div>
        <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search people"
            placeholder="Name, email or role"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-10 w-full rounded-lg border border-transparent bg-background pr-3 pl-9 text-base-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11 md:text-body"
          />
        </div>
        <PeopleFilter me={me} catalog={catalog} scope={system} q={q} applied={picks} onApply={applyPicks} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-y border-divider bg-background py-2 pr-3 pl-5">
        <span className="text-small text-muted-strong" aria-live="polite">
          {totals ? (
            <>
              <strong className="font-semibold text-foreground tabular-nums">{total}</strong> {total === 1 ? 'person' : 'people'}
            </>
          ) : (
            <span className="sr-only">Loading people</span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="font-normal">
              <span className="text-muted-foreground">Sort:</span>
              <span className="font-semibold">{sortLabel(sort)}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup value={sort} onValueChange={(next) => set({ sort: next === 'name' ? null : next })}>
              {PEOPLE_SORTS.map((s) => (
                <DropdownMenuRadioItem key={s.sort} value={s.sort}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {failed?.kind === 'error' ? (
          <div className="p-5">
            <ViewError kind="tile" subject="people" message={errorMessage(failed.error, "We couldn't load people.")} onRetry={() => setAttempt((n) => n + 1)} />
          </div>
        ) : loading ? (
          <ListSkeleton />
        ) : total === 0 ? (
          q || system || filtered ? (
            <NoMatch
              q={q}
              system={system}
              picks={picks}
              onClearSearch={() => {
                setTyped('');
                set({ q: null });
              }}
              onClearSystem={() => set({ system: null })}
              onClearPicks={() => applyPicks(NO_PICKS)}
              onClearAll={clearAll}
            />
          ) : (
            <EmptyList onAdd={add} />
          )
        ) : (
          PEOPLE_GROUPS.map(({ group, label }) => (
            <GroupSection
              key={group}
              group={group}
              label={label}
              count={totals?.[group] ?? 0}
              loader={groups[group]}
              render={(person) => (
                <PersonRow
                  person={person}
                  me={me}
                  catalog={catalog}
                  sort={sort}
                  system={system}
                  selected={person.id === selectedId}
                  onSelect={() => onSelect(person.id)}
                />
              )}
            />
          ))
        )}
      </div>
    </section>
  );
}

type GroupLoader = ReturnType<typeof useGroup>;

/** One group's first page (with `counts`) and its Load more. */
function useGroup(group: PeopleGroup, { q, system, sort, filters, waiting, attempt }: ListInputs) {
  const [loadingMore, setLoadingMore] = useState(false);
  const query = {
    system,
    q: q || undefined,
    status: filters.status ?? undefined,
    access: filters.access ?? undefined,
    group,
    sort,
    limit: PEOPLE_PAGE_SIZE,
  };
  const key = waiting
    ? `${group}|waiting`
    : `${group}|${system ?? 'all'}|${q}|${sort}|${filters.status ?? ''}|${filters.access ?? ''}|${attempt}`;
  // While waiting the call never starts, so the list keeps its skeletons
  const { state, replace } = useAsync<PeoplePage>(key, () => (waiting ? new Promise<PeoplePage>(() => {}) : listPeople(query)));
  const more = async () => {
    if (state.kind !== 'ready' || !state.value.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listPeople({ ...query, cursor: state.value.next });
      replace((current) => ({ ...current, items: [...current.items, ...page.items], next: page.next }));
    } catch (error) {
      notifyError(errorMessage(error, "We couldn't load more people."));
    } finally {
      setLoadingMore(false);
    }
  };
  return { state, more, loadingMore };
}

function GroupSection({
  group,
  label,
  count,
  loader,
  render,
}: {
  group: PeopleGroup;
  label: string;
  count: number;
  loader: GroupLoader;
  render: (person: ManagedPerson) => ReactNode;
}) {
  if (count === 0 || loader.state.kind !== 'ready') return null;
  const { items, next } = loader.state.value;
  const headingId = `people-group-${group}`;
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className={cn(
          'flex justify-between px-5 pt-3.5 pb-1.5 text-caption font-semibold',
          group === 'attention' ? 'text-warning' : 'text-muted-strong',
        )}
      >
        {label}
        <span className="font-mono tabular-nums">{count}</span>
      </h2>
      <ul>
        {items.map((person) => (
          <li key={person.id}>{render(person)}</li>
        ))}
      </ul>
      {next && (
        <div className="px-5 pt-1 pb-3">
          <Button variant="outline" size="sm" loading={loader.loadingMore} onClick={() => void loader.more()}>
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}

function PersonRow({
  person,
  me,
  catalog,
  sort,
  system,
  selected,
  onSelect,
}: {
  person: ManagedPerson;
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  sort: PeopleSort;
  system: SystemCode | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const pending = isPending(person);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative flex min-h-15 w-full items-center gap-3 px-5 py-2.5 text-left transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'bg-info-bg before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-primary hover:bg-info-bg',
      )}
    >
      <InitialsTile
        name={person.name}
        className={cn('size-9 text-small', pending && 'border-2 border-border bg-card')}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-semibold text-foreground">{person.name}</span>
        <span className="truncate text-caption font-normal text-muted-foreground">
          {subLine(person, { sort, system, me, catalog })}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        {systemChips(person, me).map(({ system: code, filled }) => (
          <SystemChip key={code} system={code} filled={filled} />
        ))}
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Suite spec 0016's no match state: the search, one hint, the active filters as chips. Suite
 * spec 0019, AC-21: under a filter, Clear filters takes the place of Add user.
 */
function NoMatch({
  q,
  system,
  picks,
  onClearSearch,
  onClearSystem,
  onClearPicks,
  onClearAll,
}: {
  q: string;
  system: SystemCode | null;
  picks: FilterPicks;
  onClearSearch: () => void;
  onClearSystem: () => void;
  onClearPicks: () => void;
  onClearAll: () => void;
}) {
  const count = filterCount(picks);
  return (
    <div role="status" className="flex flex-col gap-3 px-5 py-6">
      <p className="text-body font-semibold text-foreground">
        {q ? `No one matches “${q}”` : count > 0 ? 'No one matches these filters' : `No one in ${system}`}
      </p>
      <p className="text-small text-muted-foreground">
        {q ? 'Check the spelling, or search by email or role.' : 'Try fewer filters, or another system.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {q && <FilterChip label={`“${q}”`} onRemove={onClearSearch} />}
        {system && <FilterChip label={system} onRemove={onClearSystem} />}
        {count > 0 && <FilterChip label={`${count} filter${count === 1 ? '' : 's'}`} onRemove={onClearPicks} />}
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={onClearAll}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card pr-1 pl-3 text-small text-foreground">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function EmptyList({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="text-body text-muted-strong">No one has access yet.</p>
      <Button size="sm" onClick={onAdd}>
        <Plus aria-hidden="true" />
        Add user
      </Button>
    </div>
  );
}
