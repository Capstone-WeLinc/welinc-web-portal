import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AdminMe, SystemCode } from '@/lib/admin';
import { fetchFacets, type CatalogSystem, type PeopleFacets } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { SYSTEM_ICONS } from '../../launcher/systemIcons';
import {
  filterCount,
  filterSystems,
  picksToParams,
  roleTicked,
  rowPill,
  rowState,
  samePicks,
  STATUS_CHIPS,
  toggleRole,
  toggleStatus,
  toggleSystem,
  type FilterPicks,
  type RowState,
} from './filterRules';

/** How long the counts wait after a draft change (AC-21b). */
const FACETS_DELAY_MS = 250;

/**
 * Suite spec 0019, AC-21 (board `Filter18`, option 2 soft tint chips): one Filter button opening
 * the popover. Status is checkbox chips; system and role are accordion rows, one open at a time.
 * The picks are a draft: the list changes only on Show, and Esc or a click outside discards it.
 * Every chip and row carries its count from `GET /auth/admin/users/facets`.
 */
export function PeopleFilter({
  me,
  catalog,
  scope,
  q,
  applied,
  onApply,
}: {
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  /** `?system`: the popover shows only that row and the counts send it. */
  scope: SystemCode | null;
  /** The applied search from the address, never text still being typed. */
  q: string;
  applied: FilterPicks;
  onApply: (picks: FilterPicks) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(applied);
  const [openRow, setOpenRow] = useState<SystemCode | null>(null);
  const systems = filterSystems(me, scope);
  const facets = useFacets(open, draft, scope, q);
  const appliedCount = filterCount(applied);
  const draftCount = filterCount(draft);
  const total = facets?.total ?? null;

  const changeOpen = (next: boolean) => {
    if (next) {
      // Each opening starts the draft from the applied picks; closing without Show discards it
      setDraft(applied);
      setOpenRow(systems.find((s) => applied.access[s]) ?? null);
    }
    setOpen(next);
  };

  const show = () => {
    if (!samePicks(draft, applied)) onApply(draft);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="shrink-0" aria-label={appliedCount > 0 ? `Filter, ${appliedCount} on` : 'Filter'}>
          <ListFilter aria-hidden="true" />
          Filter
          {appliedCount > 0 && (
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-primary font-mono text-caption text-primary-foreground tabular-nums"
            >
              {appliedCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Filters"
        className="flex max-h-(--radix-popover-content-available-height) w-84 max-w-(--radix-popover-content-available-width) flex-col overflow-hidden rounded-2xl p-0"
      >
        <div className="flex items-center px-4.5 pt-4 pb-1.5">
          <h2 className="flex-1 text-group text-foreground">Filters</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            disabled={draftCount === 0}
            onClick={() => setDraft({ status: [], access: {} })}
          >
            Clear all
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <fieldset className="flex flex-col gap-2.5 px-4.5 pt-2 pb-3.5">
            <legend className="mb-2.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">Status</legend>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map(({ value, label }) => {
                const on = draft.status.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setDraft((d) => toggleStatus(d, value))}
                    className={cn(
                      'flex h-7.5 items-center gap-1.75 rounded-md border px-2.5 text-small text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11',
                      on ? 'border-primary bg-info-bg font-semibold' : 'border-input bg-card font-medium hover:bg-accent',
                    )}
                  >
                    <TickBox state={on ? 'all' : 'off'} small />
                    {label}
                    <Count value={facets ? facets.status[value] : null} />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="h-px bg-divider" />
          <fieldset className="flex flex-col gap-1 px-2.5 pt-3.5 pb-2.5">
            <legend className="mb-1.5 px-2 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              System and role
            </legend>
            {systems.map((system) => (
              <SystemRow
                key={system}
                system={system}
                draft={draft}
                catalog={catalog}
                facets={facets}
                expanded={openRow === system}
                onExpand={() => setOpenRow((cur) => (cur === system ? null : system))}
                onChange={setDraft}
              />
            ))}
          </fieldset>
        </div>
        <div className="flex items-center gap-2.5 border-t border-divider bg-background px-4 py-3">
          <span className="flex-1 text-small text-muted-foreground">
            {draftCount > 0 ? `${draftCount} filter${draftCount === 1 ? '' : 's'} on` : 'No filters'}
          </span>
          <Button disabled={total === 0} onClick={show}>
            {total === 0 ? 'No one matches' : `Show ${total ?? '–'} ${total === 1 ? 'person' : 'people'}`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SystemRow({
  system,
  draft,
  catalog,
  facets,
  expanded,
  onExpand,
  onChange,
}: {
  system: SystemCode;
  draft: FilterPicks;
  catalog: CatalogSystem[] | null;
  facets: PeopleFacets | null;
  expanded: boolean;
  onExpand: () => void;
  onChange: (update: (d: FilterPicks) => FilterPicks) => void;
}) {
  const state = rowState(draft, system);
  const entry = catalog?.find((s) => s.code === system);
  const counts = facets?.systems.find((s) => s.system === system) ?? null;
  const Icon = SYSTEM_ICONS[system];
  const foldId = `filter-roles-${system}`;
  const on = state !== 'off';
  return (
    <div
      className={cn(
        'rounded-xl transition-colors',
        expanded ? 'bg-card shadow-card ring-1 ring-border' : on ? 'bg-info-bg' : undefined,
      )}
    >
      <div className="flex h-12.5 items-center gap-1 rounded-xl pr-1.5 pl-2 hover:bg-background">
        <button
          type="button"
          role="checkbox"
          aria-checked={state === 'some' ? 'mixed' : on}
          aria-label={`All of ${system}`}
          onClick={() => onChange((d) => toggleSystem(d, system))}
          className="flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:size-11"
        >
          <TickBox state={state} />
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={foldId}
          onClick={onExpand}
          className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              on ? 'bg-primary text-highlight' : 'bg-muted text-muted-strong',
            )}
          >
            {Icon && <Icon className="size-3.75" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
            {system} <span className="text-small font-normal text-muted-foreground">{shortName(entry?.name, system)}</span>
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold tabular-nums',
              on ? 'bg-info-bg text-primary' : 'text-muted-foreground',
            )}
          >
            {rowPill(draft, system, catalog, counts?.count ?? null)}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fold) ease-enter motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </div>
      <div id={foldId} className="fold" data-open={expanded || undefined} inert={!expanded}>
        <div>
          <div role="group" aria-label={`${system} roles`} className="flex flex-wrap gap-1.5 pt-0 pr-3 pb-3 pl-12">
            {(entry?.roles ?? []).map((role) => {
              const ticked = roleTicked(draft, system, role.code);
              const count = counts?.roles.find((r) => r.code === role.code)?.count ?? null;
              return (
                <button
                  key={role.code}
                  type="button"
                  role="checkbox"
                  aria-checked={ticked}
                  onClick={() => onChange((d) => toggleRole(d, system, role.code, catalog))}
                  className={cn(
                    'flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-small transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11',
                    ticked ? 'bg-info-bg font-semibold text-primary' : 'bg-background font-medium text-muted-strong hover:bg-accent',
                  )}
                >
                  {ticked && <Check aria-hidden="true" className="size-3" strokeWidth={3.2} />}
                  {role.name}
                  <Count value={count} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The board's one word beside the code (Repair, Maintenance, Bookings). */
function shortName(name: string | undefined, system: SystemCode): string {
  return SHORT_NAMES[system] ?? name ?? '';
}

const SHORT_NAMES: Record<SystemCode, string> = { VRMS: 'Repair', VMMS: 'Maintenance', BMS: 'Bookings' };

/** A drawn checkbox inside a chip or row: the chip or row carries the role and state. */
function TickBox({ state, small = false }: { state: RowState; small?: boolean }) {
  const on = state !== 'off';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center text-primary-foreground transition-colors',
        small ? 'size-3.25 rounded-sm' : 'size-4.25 rounded-sm',
        on ? 'bg-primary' : 'border-2 border-input bg-card',
      )}
    >
      {state === 'all' && <Check className={small ? 'size-2.5' : 'size-3'} strokeWidth={3.4} />}
      {state === 'some' && <span className={cn('h-0.5 rounded-full bg-primary-foreground', small ? 'w-1.5' : 'w-2')} />}
    </span>
  );
}

/** A facet count, or a dash while it loads or after it failed. */
function Count({ value }: { value: number | null }) {
  return <span className="font-mono text-caption font-normal text-muted-foreground tabular-nums">{value ?? '–'}</span>;
}

/**
 * AC-21b: the counts for the draft. Asks when the popover opens and 250 ms after each draft
 * change, aborts any older call, and ignores an answer older than the newest sent. A failure
 * (429, `ADMIN_CODE_REQUIRED`, aborted) leaves the dashes with no toast.
 */
function useFacets(open: boolean, draft: FilterPicks, scope: SystemCode | null, q: string): PeopleFacets | null {
  const [result, setResult] = useState<{ key: string; facets: PeopleFacets } | null>(null);
  const seq = useRef(0);
  const asked = useRef(false);
  const { status, access } = picksToParams(draft);
  const key = `${scope ?? ''}|${q}|${status ?? ''}|${access ?? ''}`;

  useEffect(() => {
    if (!open) {
      asked.current = false;
      return;
    }
    const controller = new AbortController();
    const mine = ++seq.current;
    const timer = window.setTimeout(
      () => {
        asked.current = true;
        fetchFacets({ system: scope, q: q || undefined, status: status ?? undefined, access: access ?? undefined }, controller.signal)
          .then((facets) => {
            if (mine === seq.current) setResult({ key, facets });
          })
          .catch(() => undefined);
      },
      asked.current ? FACETS_DELAY_MS : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // key carries every input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  // Counts for other picks are never shown: while the new ones load, every count is a dash
  return open && result?.key === key ? result.facets : null;
}
