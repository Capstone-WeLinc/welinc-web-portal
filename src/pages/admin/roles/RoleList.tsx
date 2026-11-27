import { useState } from 'react';
import { EllipsisVertical, FileSpreadsheet, Plus, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InitialsTile } from '@/components/ui/initials-tile';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemCode } from '@/lib/admin';
import type { RoleSummary, RolesData } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import type { MatrixDraft } from '../permissions/matrixDraft';
import { customRoleCopy, draftCount, matchRoles, peopleWords, roleCountWords } from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-2 (board Roles9): the list pane. The title with the count, the
 * system switch (only with two or more systems), a search over names and descriptions, and the
 * sticky Built in and Custom headings. Each row: a square initials tile, the name, the people in
 * words, and the gold draft bubble when the row holds unsaved changes (AC-7). The ⋮ "More options"
 * holds the spreadsheet download (AC-16), for systems with permissions only. Child 0002, AC-20:
 * a suite admin on a system with permissions gets the dashed New role button pinned at the bottom;
 * a just created role lands with the landing flash.
 */
export function RoleList({
  systems,
  system,
  data,
  selected,
  draft,
  onSystem,
  onSelect,
  onDownload,
  newRole,
  landed,
}: {
  systems: SystemCode[];
  system: SystemCode;
  /** Null while the system's roles load. */
  data: RolesData | null;
  selected: string | undefined;
  draft: MatrixDraft;
  onSystem: (next: SystemCode) => void;
  onSelect: (code: string) => void;
  /** Download as spreadsheet; absent for a system without permissions. */
  onDownload?: () => void;
  /** New role (child 0002, AC-20); absent unless a suite admin views a system with permissions. */
  newRole?: { onOpen: () => void; atLimit: boolean };
  /** The code of a role that was just created, which gets the landing flash. */
  landed?: string;
}) {
  const [q, setQ] = useState('');
  const roles = data ? matchRoles(data.roles, q) : [];
  const builtIn = roles.filter((r) => r.builtIn);
  const custom = roles.filter((r) => !r.builtIn);
  const noMatch = data !== null && q.trim() !== '' && roles.length === 0;

  return (
    <section aria-label="Role list" className="flex min-h-0 flex-col bg-card md:h-full">
      <div className="flex flex-col gap-3 px-4 pt-6 pb-3.5">
        <div className="flex items-baseline gap-2.5">
          <h1 id="admin-view-title" className="text-title text-foreground">
            Roles
          </h1>
          <span className="ml-auto text-small text-muted-foreground" aria-live="polite">
            {data ? roleCountWords(data.roles.length) : <span className="sr-only">Loading roles</span>}
          </span>
          {onDownload && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options" className="-mr-2 self-center">
                  <EllipsisVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={onDownload}>
                  <FileSpreadsheet aria-hidden="true" />
                  Download as spreadsheet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            className="h-10 w-full rounded-md border border-transparent bg-background pr-3 pl-9 text-base-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11 md:text-body"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-divider px-2 pb-3">
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
                landed={landed}
                empty={q.trim() ? null : 'No custom roles yet'}
              />
            )}
          </>
        )}
      </div>
      {newRole && (
        <div className="flex flex-col gap-2 border-t border-divider bg-card px-4 pt-3 pb-4">
          <Button
            variant="outline"
            disabled={newRole.atLimit}
            aria-describedby={newRole.atLimit ? 'new-role-limit' : undefined}
            onClick={newRole.onOpen}
            className="h-11 w-full border-dashed border-muted-foreground bg-transparent font-semibold text-primary shadow-none"
          >
            <Plus aria-hidden="true" />
            New role
          </Button>
          {newRole.atLimit && (
            <p id="new-role-limit" className="text-caption font-normal text-muted-foreground">
              {customRoleCopy.limit(system)}
            </p>
          )}
        </div>
      )}
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
  landed,
  empty = null,
}: {
  id: string;
  title: string;
  roles: RoleSummary[];
  selected: string | undefined;
  draft: MatrixDraft;
  onSelect: (code: string) => void;
  landed?: string;
  /** Shown under the heading when the group has no role; null hides the whole group then. */
  empty?: string | null;
}) {
  if (roles.length === 0 && empty === null) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="sticky top-0 z-1 bg-card/95 px-4 pt-3.5 pb-1.5 text-label text-muted-foreground backdrop-blur-xs">
        {title}
      </h2>
      {roles.length === 0 ? (
        <p className="px-4 py-2 text-small text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {roles.map((role) => (
            <li key={role.code}>
              <RoleRow
                role={role}
                selected={role.code === selected}
                drafts={draftCount(draft, role.code)}
                landed={role.code === landed}
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
  landed,
  onSelect,
}: {
  role: RoleSummary;
  selected: boolean;
  drafts: number;
  landed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'my-px flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'bg-info-bg ring-1 ring-primary/15 ring-inset hover:bg-info-bg',
        landed && 'land-flash',
      )}
    >
      <InitialsTile
        name={role.name}
        shape="square"
        className={cn('size-9 rounded-lg text-small font-bold', selected && 'bg-primary text-primary-foreground')}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate text-body text-foreground', selected ? 'font-semibold' : 'font-medium')}>
          {role.name}
        </span>
        <span className="truncate text-caption font-normal text-muted-foreground">{peopleWords(role.peopleCount)}</span>
      </span>
      {drafts > 0 && (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-highlight px-1.5 font-mono text-caption font-semibold text-highlight-foreground"
          role="img"
          aria-label={drafts === 1 ? '1 unsaved change' : `${drafts} unsaved changes`}
          title={drafts === 1 ? '1 unsaved change' : `${drafts} unsaved changes`}
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
        <div key={i} className="flex items-center gap-3 px-2.5 py-3">
          <Skeleton className="size-9 rounded-lg" />
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
    <div role="status" className="flex flex-col items-start gap-3 px-2.5 py-6">
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
