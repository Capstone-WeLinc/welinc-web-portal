import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, EllipsisVertical, RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InitialsTile } from '@/components/ui/initials-tile';
import { RoleChip } from '@/components/ui/role-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SystemCode } from '@/lib/admin';
import type { PermissionMatrix, RoleSummary, RolesData } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import type { MatrixDraft } from '../permissions/matrixDraft';
import { PermissionGroups } from './PermissionGroups';
import { RoleHistory } from './RoleHistory';
import { RolePeople } from './RolePeople';
import { allowedCount, permissionTotal, roleHelp, rolesHref } from './rolesRules';

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
  reset,
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
  /** Reset to defaults; `disabled` when the role already shows its defaults. */
  reset?: { disabled: boolean; onReset: () => void };
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
      <RoleHeader role={role} data={data} allowed={allowed} total={total} reset={reset} />
      <Tabs value={shown} onValueChange={(next) => onTab(next as RoleTab)} className="flex-1 gap-0">
        <div className="border-b border-border bg-card px-4 sm:px-6 lg:px-9">
          <TabsList aria-label="Role sections" className="-mb-px h-11 gap-5">
            {withPermissions && (
              <TabsTrigger value="permissions">
                Permissions
                <span className="font-mono text-caption text-muted-foreground">
                  {allowed}/{total}
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="people">
              People
              <span className="font-mono text-caption text-muted-foreground">{role.peopleCount}</span>
            </TabsTrigger>
            {withPermissions && <TabsTrigger value="history">History</TabsTrigger>}
          </TabsList>
        </div>
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-9">
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
            <RolePeople data={data} role={role} version={peopleVersion} onAdd={onAddPeople} />
          </TabsContent>
          {withPermissions && (
            <TabsContent value="history">
              <RoleHistory system={data.system} role={role} version={`${data.version}|${role.lastChanged?.at ?? ''}`} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function RoleHeader({
  role,
  data,
  allowed,
  total,
  reset,
}: {
  role: RoleSummary;
  data: RolesData;
  allowed: number;
  total: number;
  reset?: { disabled: boolean; onReset: () => void };
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-border bg-card px-4 pt-6 pb-6 sm:px-6 lg:px-9 lg:pt-7">
      <div className="flex items-start gap-4">
        <InitialsTile name={role.name} shape="square" size="header" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-title break-words text-foreground">{role.name}</h2>
            <RoleChip custom={!role.builtIn}>{role.builtIn ? 'Built in' : 'Custom'}</RoleChip>
          </div>
          {role.description && <p className="text-body break-words text-foreground">{role.description}</p>}
          <p className="text-small text-muted-foreground">{roleHelp(role, data)}</p>
        </div>
        {reset && <RoleActions reset={reset} />}
      </div>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-divider bg-divider sm:grid-cols-3">
        <Fact label="People">
          <span className="font-mono">{role.peopleCount}</span>
        </Fact>
        {data.supportsCustomRoles && (
          <Fact label="Permissions">
            <span className="font-mono">
              {allowed} of {total}
            </span>
          </Fact>
        )}
        <Fact label="Last changed">
          {role.lastChanged ? (
            <>
              <span className="font-mono">{formatDate(role.lastChanged.at)}</span> by {role.lastChanged.byName}
            </>
          ) : (
            'Not changed yet'
          )}
        </Fact>
      </dl>
    </div>
  );
}

/** AC-3: the ⋮ "More role actions" menu; child 0002 adds Duplicate, Rename, Edit description and Delete. */
function RoleActions({ reset }: { reset: { disabled: boolean; onReset: () => void } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More role actions" className="shrink-0">
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem disabled={reset.disabled} onSelect={reset.onReset} className="items-start">
          <RotateCcw aria-hidden="true" className="mt-0.5" />
          <span className="flex flex-col">
            <span>Reset to defaults</span>
            {reset.disabled && <span className="text-caption text-muted-foreground">Already on the defaults</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-background px-4 py-3">
      <dt className="text-caption font-normal text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Below 768px the role is its own screen with a way back to the list (AC-1). */
function PhoneBack({ system }: { system: SystemCode }) {
  return (
    <div className="border-b border-border bg-card px-2 py-1 md:hidden">
      <Link to={rolesHref(system)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft aria-hidden="true" />
        Roles
      </Link>
    </div>
  );
}

export function RoleSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5 px-4 pt-6 sm:px-6 lg:px-9 lg:pt-7">
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
