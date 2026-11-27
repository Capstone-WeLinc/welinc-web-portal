import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, EllipsisVertical, PencilLine, Plus, RotateCcw, Text, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InitialsTile } from '@/components/ui/initials-tile';
import { RoleChip } from '@/components/ui/role-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SystemCode } from '@/lib/admin';
import type { PermissionMatrix, RoleSummary, RolesData } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MatrixDraft } from '../permissions/matrixDraft';
import { PermissionGroups } from './PermissionGroups';
import { RoleHistory } from './RoleHistory';
import { RolePeople } from './RolePeople';
import { allowedCount, customRoleCopy, permissionTotal, roleHelp, rolesHref } from './rolesRules';

/**
 * Child 0002, AC-21, AC-24 to AC-26: what the header offers a suite admin on a system with
 * permissions. Built in roles get Reset to defaults only; custom roles Rename, Edit description
 * and Delete, never Reset. Duplicate is for both, disabled at the custom role limit.
 */
export type RoleHeaderActions = {
  /** Reset to defaults (built in only); `disabled` when the role already shows its defaults. */
  reset?: { disabled: boolean; onReset: () => void };
  onDuplicate: () => void;
  /** The system has 20 live custom roles (AC-22). */
  atLimit: boolean;
  /** Custom roles only. */
  custom?: { onRename: () => void; onDescribe: () => void; onDelete: () => void };
};

export type RoleTab = 'permissions' | 'people' | 'history';

/**
 * Suite spec 0018, child 0001 AC-3 and AC-4 (board Roles9): one role. The header (tile, name,
 * Built in or Custom chip, description, one help line, the facts), then the tabs. A system without
 * permissions shows only People (AC-3). The open tab belongs to the page, so it stays when you
 * pick another role. `reset` is set only for a suite admin on a built in role of a system with
 * permissions (AC-10).
 */
export function RoleDetail({
  data,
  matrix,
  role,
  draft,
  onToggle,
  actions,
  tab,
  onTab,
  peopleVersion,
  onAddPeople,
}: {
  data: RolesData;
  matrix: PermissionMatrix;
  role: RoleSummary;
  draft: MatrixDraft;
  onToggle: (key: string) => void;
  /** Set only for a suite admin on a system with permissions. */
  actions?: RoleHeaderActions;
  tab: RoleTab;
  onTab: (tab: RoleTab) => void;
  /** Raised after Add people, so the People tab reads its list again. */
  peopleVersion: number;
  /** Opens Add people (AC-13). */
  onAddPeople?: () => void;
}) {
  const total = permissionTotal(data);
  const allowed = allowedCount(data, role.code);
  const withPermissions = data.supportsCustomRoles;
  const shown: RoleTab = withPermissions ? tab : 'people';
  return (
    <div className="flex min-h-full flex-col">
      <PhoneBack system={data.system} />
      <div className="flex flex-1 flex-col px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <RoleHeader role={role} data={data} allowed={allowed} total={total} actions={actions} />
        <Tabs value={shown} onValueChange={(next) => onTab(next as RoleTab)} className="flex-1 gap-0">
          <div className="mt-5.5 mb-3.5 flex items-end gap-2 border-b border-border">
            <TabsList aria-label="Role sections" className="-mb-px h-11 gap-1">
              {withPermissions && (
                <TabsTrigger value="permissions" className="px-3">
                  Permissions
                  <TabCount on={shown === 'permissions'}>
                    {allowed}/{total}
                  </TabCount>
                </TabsTrigger>
              )}
              <TabsTrigger value="people" className="px-3">
                People
                <TabCount on={shown === 'people'}>{role.peopleCount}</TabCount>
              </TabsTrigger>
              {withPermissions && <TabsTrigger value="history" className="px-3">History</TabsTrigger>}
            </TabsList>
            {shown === 'people' && onAddPeople && (
              <Button size="sm" className="mb-1.5 ml-auto" onClick={onAddPeople}>
                <Plus aria-hidden="true" />
                Add people
              </Button>
            )}
          </div>
          {withPermissions && (
            <TabsContent value="permissions">
              {/* Remounted per role, so each role opens with its first group open (AC-4) */}
              <PermissionGroups
                key={role.code}
                data={data}
                matrix={matrix}
                role={role.code}
                draft={draft}
                onToggle={onToggle}
              />
            </TabsContent>
          )}
          <TabsContent value="people">
            <RolePeople data={data} role={role} version={peopleVersion} />
          </TabsContent>
          {withPermissions && (
            <TabsContent value="history">
              <RoleHistory system={data.system} role={role} version={`${data.version}|${role.lastChanged?.at ?? ''}`} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

/** The count beside a tab name: filled navy on the open tab, quiet on the others (board Roles9). */
function TabCount({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.75 py-0.5 font-mono text-caption',
        on ? 'bg-primary text-primary-foreground' : 'bg-track text-muted-strong',
      )}
    >
      {children}
    </span>
  );
}

function RoleHeader({
  role,
  data,
  allowed,
  total,
  actions,
}: {
  role: RoleSummary;
  data: RolesData;
  allowed: number;
  total: number;
  actions?: RoleHeaderActions;
}) {
  return (
    <section aria-label={role.name} className="rounded-3xl bg-card shadow-card">
      <div className="flex items-start gap-4 px-5.5 pt-5.5 pb-4.5">
        <InitialsTile name={role.name} shape="square" size="header" className="font-bold" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-title break-words text-foreground">{role.name}</h2>
            <RoleChip custom={!role.builtIn}>{role.builtIn ? 'Built in' : 'Custom'}</RoleChip>
          </div>
          {role.description && <p className="text-body break-words text-muted-strong">{role.description}</p>}
          <p className="text-small text-muted-foreground">{roleHelp(role, data)}</p>
          {actions?.atLimit && (
            <p id="role-limit" className="text-small text-muted-strong">
              {customRoleCopy.limit(data.system)}
            </p>
          )}
        </div>
        {actions && <RoleActions actions={actions} />}
      </div>
      <dl className={cn('grid grid-cols-2 border-t border-divider', data.supportsCustomRoles && 'sm:grid-cols-3')}>
        <Fact label="People">
          <span className="font-mono text-heading">{role.peopleCount}</span>
        </Fact>
        {data.supportsCustomRoles && (
          <Fact label="Permissions">
            <span className="font-mono text-heading">{allowed}</span>{' '}
            <span className="text-small font-normal text-muted-foreground">of {total}</span>
          </Fact>
        )}
        <Fact label="Last changed" wide={data.supportsCustomRoles}>
          {role.lastChanged ? (
            <span className="flex flex-col gap-px pt-0.75">
              <span className="font-mono text-body font-medium">{formatDate(role.lastChanged.at)}</span>
              <span className="text-caption font-normal text-muted-foreground">by {role.lastChanged.byName}</span>
            </span>
          ) : (
            <span className="block pt-0.75 text-body font-medium">Not changed yet</span>
          )}
        </Fact>
      </dl>
    </section>
  );
}

/** AC-3 and child 0002: Duplicate beside the ⋮ "More role actions" menu (board Roles9). */
function RoleActions({ actions }: { actions: RoleHeaderActions }) {
  const { reset, custom } = actions;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        variant="outline"
        disabled={actions.atLimit}
        aria-describedby={actions.atLimit ? 'role-limit' : undefined}
        onClick={actions.onDuplicate}
        className="max-sm:hidden"
      >
        <Copy aria-hidden="true" />
        Duplicate
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More role actions">
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {/* On phones Duplicate moves into the menu, so the header keeps room for the name */}
          <DropdownMenuItem disabled={actions.atLimit} onSelect={actions.onDuplicate} className="sm:hidden">
            <Copy aria-hidden="true" />
            Duplicate
          </DropdownMenuItem>
          {custom && (
            <>
              <DropdownMenuItem onSelect={custom.onRename}>
                <PencilLine aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={custom.onDescribe}>
                <Text aria-hidden="true" />
                Edit description
              </DropdownMenuItem>
            </>
          )}
          {reset && (
            <DropdownMenuItem disabled={reset.disabled} onSelect={reset.onReset} className="items-start">
              <RotateCcw aria-hidden="true" className="mt-0.5" />
              <span className="flex flex-col">
                <span>Reset to defaults</span>
                {reset.disabled && <span className="text-caption text-muted-foreground">Already on the defaults</span>}
              </span>
            </DropdownMenuItem>
          )}
          {custom && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={custom.onDelete}>
                <Trash2 aria-hidden="true" />
                Delete role
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One fact cell; `wide` takes the whole row on phones, under the two short facts. */
function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 border-divider px-4 py-3.5 not-last:border-r max-sm:nth-2:border-r-0 sm:px-5.5',
        wide && 'col-span-2 border-t sm:col-span-1 sm:border-t-0',
      )}
    >
      <dt className="text-caption font-normal text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Below 768px the role is its own screen with a way back to the list (AC-1). */
function PhoneBack({ system }: { system: SystemCode }) {
  return (
    <div className="border-b border-border bg-card px-2 py-1 md:hidden">
      {/* The list and its "Roles" title are a separate screen here, so the page keeps one h1 */}
      <h1 className="sr-only">Roles</h1>
      <Link to={rolesHref(system)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft aria-hidden="true" />
        Roles
      </Link>
    </div>
  );
}

export function RoleSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5 px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <span className="sr-only">Loading the role</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
