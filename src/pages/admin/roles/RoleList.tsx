import { useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsTile } from '@/components/ui/initials-tile';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import type { MatrixDraft } from '../permissions/matrixDraft';
import { draftCount, matchRoles, peopleWords, roleCountWords } from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-2 (board Roles9): the list pane. The title with the count, the
 * system switch (only with two or more systems), a search over names and descriptions, and the
 * sticky Built in and Custom headings. Each row: a square initials tile, the name, the people in
 * words, and the gold draft bubble when the row holds unsaved changes (AC-7).
 */
export function RoleList({
  systems,
  system,
  data,
  selected,
  draft,
  onSystem,
  onSelect,
}: {
  systems: SystemCode[];
  system: SystemCode;
  /** Null while the system's roles load. */
  data: RolesData | null;
  selected: string | undefined;
  draft: MatrixDraft;
  onSystem: (next: SystemCode) => void;
  onSelect: (code: string) => void;
}) {
  const [q, setQ] = useState('');
  const roles = data ? matchRoles(data.roles, q) : [];
  const builtIn = roles.filter((r) => r.builtIn);
  const custom = roles.filter((r) => !r.builtIn);
  const noMatch = data !== null && q.trim() !== '' && roles.length === 0;

  return (
    <section aria-label="Role list" className="flex min-h-0 flex-col bg-card md:h-full">
      <div className="flex flex-col gap-3 px-5 pt-6 pb-3.5">
        <div className="flex items-baseline gap-2.5">
          <h1 id="admin-view-title" className="text-title text-foreground">
            Roles
          </h1>
          <span className="text-small text-muted-foreground" aria-live="polite">
            {data ? roleCountWords(data.roles.length) : <span className="sr-only">Loading roles</span>}
          </span>
        </div>
        {systems.length > 1 && (
          <SegmentedControl
            aria-label="System"
            value={system}
            onValueChange={(next) => {
              setQ('');
              onSystem(next as SystemCode);
            }}
            className="flex w-full"
          >
            {systems.map((s) => (
              <SegmentedControlItem key={s} value={s} className="flex-1">
                {s}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        )}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Find a role"
            placeholder="Find a role"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 w-full rounded-lg border border-transparent bg-background pr-3 pl-9 text-base-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11 md:text-body"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-divider pb-4">
        {data === null ? (
          <ListSkeleton />
        ) : noMatch ? (
          <NoMatch q={q} onClear={() => setQ('')} />
        ) : (
          <>
            <RoleGroup
              id="roles-built-in"
              title="Built in"
              roles={builtIn}
              selected={selected}
              draft={draft}
              onSelect={onSelect}
            />
            {data.supportsCustomRoles && (
              <RoleGroup
                id="roles-custom"
                title="Custom"
                roles={custom}
                selected={selected}
                draft={draft}
                onSelect={onSelect}
                empty={q.trim() ? null : 'No custom roles yet'}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RoleGroup({
  id,
  title,
  roles,
  selected,
  draft,
  onSelect,
  empty = null,
}: {
  id: string;
  title: string;
  roles: RoleSummary[];
  selected: string | undefined;
  draft: MatrixDraft;
  onSelect: (code: string) => void;
  /** Shown under the heading when the group has no role; null hides the whole group then. */
  empty?: string | null;
}) {
  if (roles.length === 0 && empty === null) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="sticky top-0 z-1 bg-card px-5 pt-3.5 pb-1.5 text-label text-muted-strong">
        {title}
      </h2>
      {roles.length === 0 ? (
        <p className="px-5 py-2 text-small text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {roles.map((role) => (
            <li key={role.code}>
              <RoleRow
                role={role}
                selected={role.code === selected}
                drafts={draftCount(draft, role.code)}
                onSelect={() => onSelect(role.code)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoleRow({
  role,
  selected,
  drafts,
  onSelect,
}: {
  role: RoleSummary;
  selected: boolean;
  drafts: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'bg-info-bg before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-primary hover:bg-info-bg',
      )}
    >
      <InitialsTile name={role.name} shape="square" className="size-9 text-small" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-semibold text-foreground">{role.name}</span>
        <span className="truncate text-caption font-normal text-muted-foreground">{peopleWords(role.peopleCount)}</span>
      </span>
      {drafts > 0 && (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-highlight px-1.5 font-mono text-caption text-highlight-foreground"
          aria-label={drafts === 1 ? '1 unsaved change' : `${drafts} unsaved changes`}
        >
          {drafts}
        </span>
      )}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col pt-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Suite spec 0016's no match state: an icon tile, the search, one hint, and Clear. */
function NoMatch({ q, onClear }: { q: string; onClear: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 px-5 py-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
        <SearchX className="size-5" aria-hidden="true" />
      </span>
      <p className="text-body font-semibold break-words text-foreground">No role matches “{q.trim()}”</p>
      <p className="text-small text-muted-foreground">Search by a role's name or what it's for.</p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
