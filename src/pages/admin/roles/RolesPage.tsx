import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SaveBar, type SaveBarChange, type SaveBarPeople } from '@/components/ui/save-bar';
import { useDraft } from '@/hooks/useDraft';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { AdminMe, SystemCode } from '@/lib/admin';
import { errorMessage, fetchRoles, listPeople, type CreatedRole, type RoleSummary, type RolesData } from '@/lib/adminApi';
import { notify, notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { NoSystemScope, ViewError } from '../AdminStates';
import { pendingChanges, toggle, type MatrixDraft } from '../permissions/matrixDraft';
import { useAsync } from '../useAsync';
import { refreshSystemsCatalog } from '../useCatalogs';
import { AddPeopleDialog } from './AddPeopleDialog';
import {
  DeleteRoleDialog,
  RoleFieldDialog,
  RoleFormDialog,
  type RoleFieldKind,
  type RoleFormStart,
} from './CustomRoleDialogs';
import { downloadRolesCsv } from './downloadRolesCsv';
import { RoleDetail, RoleSkeleton, type RoleHeaderActions, type RoleTab } from './RoleDetail';
import { RoleList } from './RoleList';
import { RoleReviewDialog, type SaveConflict } from './RoleReviewDialog';
import {
  atCustomRoleLimit,
  barSubline,
  checkDraft,
  customRoleCopy,
  deletedCount,
  draftFromStored,
  dropRoleFromDraft,
  duplicateName,
  parseRoleSystem,
  reachLine,
  resetToDefaults,
  roleSystems,
  rolesCopy,
  rolesHref,
  storedChanges,
  storedCurrent,
  toMatrix,
  withCreatedRole,
  withUpdatedRole,
} from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-1 (board Roles9): `/admin/roles/:system/:role` is one page, the
 * role list beside one role, each scrolling on its own. `/admin/roles` and `/admin/roles/:system`
 * open the first role of the viewer's first system with `replace` (below 768px they show the
 * list instead, since the list and the role are separate screens there). Picking a role replaces
 * the address. Each system mounts its own `SystemRoles`, so each keeps its own draft (AC-12).
 */
export function RolesPage({ me }: { me: AdminMe }) {
  const params = useParams();
  const { search } = useLocation();
  const systems = roleSystems(me);
  const fromPath = parseRoleSystem(me, params.system);
  const hinted = parseRoleSystem(me, new URLSearchParams(search).get('system'));
  const system = fromPath ?? hinted ?? systems[0];

  if (!system) return <NoSystemScope />;
  // A missing, unknown or lower case system becomes the canonical address
  if (params.system !== system) {
    return <Navigate to={fromPath ? rolesHref(system, params.role) : rolesHref(system)} replace />;
  }
  return <SystemRoles key={system} me={me} systems={systems} system={system} roleCode={params.role} />;
}

/**
 * One system's roles, its draft and its saving (AC-6 to AC-12). Flipped switches collect in one
 * draft keyed `role|key`, stored through `useDraft` under `welinc:draft:<user>:roles:<system>`.
 * Every read of the role data after a save or a conflict checks the draft again (`checkDraft`).
 */
function SystemRoles({
  me,
  systems,
  system,
  roleCode,
}: {
  me: AdminMe;
  systems: SystemCode[];
  system: SystemCode;
  roleCode: string | undefined;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<MatrixDraft>({});
  const [reviewing, setReviewing] = useState(false);
  const [holders, setHolders] = useState<Record<string, string[]>>({});
  const [tab, setTab] = useState<RoleTab>('permissions');
  const [adding, setAdding] = useState(false);
  const [peopleVersion, setPeopleVersion] = useState(0);
  // Child 0002: the custom role dialogs, and the row that just landed
  const [forming, setForming] = useState<RoleFormStart | null>(null);
  const [editing, setEditing] = useState<RoleFieldKind | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [landed, setLanded] = useState<string | undefined>(undefined);
  const asked = useRef(new Set<string>());
  const { state, replace } = useAsync<RolesData>(`${system}|${attempt}`, () => fetchRoles(system));
  const data = state.kind === 'ready' ? state.value : null;
  const matrix = useMemo(() => (data ? toMatrix(data) : null), [data]);

  const changes = matrix ? pendingChanges(matrix, draft) : [];
  const touched = data ? data.roles.filter((r) => changes.some((c) => c.role === r.code)) : [];
  const stored = useMemo(() => storedChanges(draft), [draft]);

  const { keptAt, clear } = useDraft<boolean>({
    userId: me.user.id,
    screenId: `roles:${system}`,
    name: rolesCopy.draftName(touched, system),
    changes: stored,
    ready: data !== null,
    current: (key, change) => (data ? storedCurrent(data, key, change) : undefined),
    onRestore: (kept) => {
      if (!data) return;
      const check = checkDraft(data, draftFromStored(kept));
      setDraft(check.kept);
      if (deletedCount(check) > 0) notify(rolesCopy.deleted(deletedCount(check)), 'warning');
    },
    staleNotice: { title: rolesCopy.draftOutOfDate(system) },
  });

  /** Up to three holders per role, for the faces lines (umbrella value sourcing), read once. */
  const loadHolders = useCallback(
    (codes: string[]) => {
      for (const code of codes) {
        if (asked.current.has(code)) continue;
        asked.current.add(code);
        listPeople({ system, role: code, limit: 3, sort: 'name' }).then(
          (page) => setHolders((h) => ({ ...h, [code]: page.items.map((p) => p.name) })),
          () => setHolders((h) => ({ ...h, [code]: [] })),
        );
      }
    },
    [system],
  );
  const touchedHeld = touched.filter((r) => r.peopleCount > 0).map((r) => r.code);

  /**
   * AC-14: after Add people, read the counts again in place (no loading state) and check the
   * draft as every read does (AC-11). The faces lines are read again on the next open.
   */
  const afterMove = async () => {
    setAdding(false);
    setPeopleVersion((n) => n + 1);
    asked.current.clear();
    setHolders({});
    try {
      const next = await fetchRoles(system);
      replace(() => next);
      const check = checkDraft(next, draft);
      setDraft(check.kept);
      if (deletedCount(check) > 0) notify(rolesCopy.deleted(deletedCount(check)), 'warning');
    } catch {
      setAttempt((n) => n + 1);
    }
  };

  /** AC-11: read the role data again after a save or a refused save, then check the draft. */
  const reread = async (cause: 'saved' | SaveConflict, count = 0) => {
    const before = data;
    let next: RolesData;
    try {
      next = await fetchRoles(system);
    } catch {
      if (cause === 'saved') {
        setDraft({});
        clear();
        notifySuccess(rolesCopy.saved(count, system));
      }
      setAttempt((n) => n + 1);
      return;
    }
    replace(() => next);
    if (cause === 'saved') {
      setDraft({});
      clear();
      notifySuccess(rolesCopy.saved(count, system));
      return;
    }
    const check = checkDraft(next, draft);
    setDraft(check.kept);
    const nameOf = (code: string) => before?.roles.find((r) => r.code === code)?.name ?? code;
    if (cause === 'MATRIX_STALE') notify(rolesCopy.stale(system), 'warning');
    if (cause === 'LOCKED_CELL') {
      const labels = check.locked.map((id) => {
        const [role, key] = id.split('|');
        const label = next.groups.flatMap((g) => g.permissions).find((p) => p.key === key)?.label ?? key;
        return `${label} for ${nameOf(role)}`;
      });
      notifyError(labels.length > 0 ? rolesCopy.locked(labels) : "A permission in your draft is locked now. Check your changes and save again.");
    }
    if (cause === 'UNKNOWN_ROLE') {
      const names = Object.keys(check.deleted).map(nameOf);
      notifyError(names.length > 0 ? rolesCopy.unknownRole(names) : 'A role in your draft no longer exists.');
    } else if (deletedCount(check) > 0) {
      notify(rolesCopy.deleted(deletedCount(check)), 'warning');
    }
  };

  /**
   * AC-20, AC-23: take the new role, its cells and the new version from the create answer (so a
   * later save isn't refused as stale), flash its row and open it on Permissions.
   */
  const afterCreate = (created: CreatedRole, source: string) => {
    setForming(null);
    refreshSystemsCatalog();
    replace((current) => withCreatedRole(current, created));
    setLanded(created.role.code);
    setTab('permissions');
    navigate(rolesHref(system, created.role.code), { replace: true });
    notifySuccess(customRoleCopy.created(created.role.name, source));
  };

  /** AC-24: the answer is the role as the list shows it. */
  const afterUpdate = (saved: RoleSummary, kind: RoleFieldKind) => {
    setEditing(null);
    refreshSystemsCatalog();
    replace((current) => withUpdatedRole(current, saved));
    notifySuccess(kind === 'name' ? customRoleCopy.renamed(saved.name) : customRoleCopy.described);
  };

  /** AC-25: drop the role from the draft, read the roles again and open the system's first role. */
  const afterDelete = async (deleted: RoleSummary) => {
    setDeleting(false);
    refreshSystemsCatalog();
    const kept = dropRoleFromDraft(draft, deleted.code);
    setDraft(kept);
    if (Object.keys(kept).length === 0) clear();
    notifySuccess(customRoleCopy.deleted(deleted.name));
    try {
      const next = await fetchRoles(system);
      replace(() => next);
      setDraft(checkDraft(next, kept).kept);
      navigate(rolesHref(system, next.roles[0]?.code), { replace: true });
    } catch {
      navigate(rolesHref(system), { replace: true });
      setAttempt((n) => n + 1);
    }
  };

  const role = data?.roles.find((r) => r.code === roleCode);
  if (data && !roleCode && !isMobile && data.roles[0]) {
    return <Navigate to={rolesHref(system, data.roles[0].code)} replace />;
  }

  const flip = (code: string, key: string) => matrix && setDraft((d) => toggle(matrix, d, code, key));
  const several = touched.length > 1;
  const barChanges: SaveBarChange[] = matrix
    ? changes.map((c) => {
        const permission = matrix.permissions.find((p) => p.key === c.key);
        return {
          id: `${c.role}|${c.key}`,
          section: several ? (matrix.roles.find((r) => r.code === c.role)?.name ?? c.role) : undefined,
          group: permission?.group ?? '',
          label: permission?.label ?? c.key,
          kind: c.allowed ? 'added' : 'removed',
          from: c.allowed ? 'Off' : 'On',
          to: c.allowed ? 'On' : 'Off',
          onUndo: () => flip(c.role, c.key),
        };
      })
    : [];
  const reach: SaveBarPeople[] = touched.map((r) => {
    const names = holders[r.code] ?? [];
    const line = reachLine(r, names, system);
    return { key: r.code, names, text: several && r.peopleCount > 0 ? `${r.name}: ${line}` : line };
  });
  // Suite admins on a system with permissions only (AC-10; child 0002, AC-20, AC-27)
  const manages = Boolean(data?.canEdit && data.supportsCustomRoles);
  const atLimit = data ? atCustomRoleLimit(data) : false;
  const actions: RoleHeaderActions | undefined =
    data && role && manages
      ? {
          reset: role.builtIn
            ? {
                disabled: !resetToDefaults(data, draft, role.code).changed,
                onReset: () => setDraft((d) => resetToDefaults(data, d, role.code).draft),
              }
            : undefined,
          onDuplicate: () => setForming({ kind: 'duplicate', from: role.code, name: duplicateName(role.name) }),
          atLimit,
          custom: role.builtIn
            ? undefined
            : {
                onRename: () => setEditing('name'),
                onDescribe: () => setEditing('description'),
                onDelete: () => setDeleting(true),
              },
        }
      : undefined;

  return (
    <div className="md:flex md:h-below-bar">
      <div className={cn('bg-card max-md:min-h-below-bar md:z-1 md:w-75 md:shrink-0 md:border-r md:border-border md:shadow-pane', roleCode && 'max-md:hidden')}>
        <RoleList
          systems={systems}
          system={system}
          data={data}
          selected={roleCode}
          draft={draft}
          onSystem={(next) => navigate(rolesHref(next), { replace: true })}
          onSelect={(code) => navigate(rolesHref(system, code), { replace: true })}
          onDownload={data?.supportsCustomRoles ? () => downloadRolesCsv(data) : undefined}
          newRole={
            data && manages
              ? { atLimit, onOpen: () => setForming({ kind: 'new', from: role?.code ?? data.roles[0]?.code ?? '' }) }
              : undefined
          }
          landed={landed}
        />
      </div>
      <div
        className={cn(
          'relative flex min-w-0 flex-1 flex-col md:overflow-y-auto md:overscroll-contain',
          !roleCode && 'max-md:hidden',
        )}
      >
        {state.kind === 'loading' && <RoleSkeleton />}
        {state.kind === 'error' && (
          <div className="p-6">
            <ViewError
              kind="tile"
              subject="roles"
              message={errorMessage(state.error, `We couldn't load the ${system} roles.`)}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          </div>
        )}
        {data && matrix && roleCode && !role && <MissingRole system={system} first={data.roles[0]?.code} />}
        {data && matrix && role && (
          <div className={cn('flex-1', data.canEdit && 'pb-24')}>
            <RoleDetail
              data={data}
              matrix={matrix}
              role={role}
              draft={draft}
              onToggle={(key) => flip(role.code, key)}
              actions={actions}
              tab={tab}
              onTab={setTab}
              peopleVersion={peopleVersion}
              onAddPeople={() => setAdding(true)}
            />
          </div>
        )}
        {data?.canEdit && (
          <SaveBar
            name={several ? `${touched.length} roles` : (touched[0]?.name ?? system)}
            changes={barChanges}
            countDetail={several ? ` in ${touched.length} roles` : undefined}
            subline={barSubline(touched)}
            keptAt={keptAt}
            people={reach}
            onOpenList={() => loadHolders(touchedHeld)}
            onDiscard={() => {
              setDraft({});
              clear();
            }}
            onReview={() => {
              loadHolders(touchedHeld);
              setReviewing(true);
            }}
          />
        )}
      </div>
      {data && role && (
        <AddPeopleDialog
          open={adding}
          data={data}
          role={role}
          onClose={() => setAdding(false)}
          onMoved={() => void afterMove()}
        />
      )}
      {data && manages && (
        <RoleFormDialog start={forming} data={data} draft={draft} onClose={() => setForming(null)} onCreated={afterCreate} />
      )}
      {data && role && manages && !role.builtIn && (
        <>
          <RoleFieldDialog
            kind={editing}
            data={data}
            role={role}
            onClose={() => setEditing(null)}
            onSaved={afterUpdate}
          />
          <DeleteRoleDialog
            open={deleting}
            data={data}
            role={role}
            onClose={() => setDeleting(false)}
            onDeleted={() => void afterDelete(role)}
            onShowPeople={() => {
              setDeleting(false);
              setTab('people');
            }}
          />
        </>
      )}
      {data?.canEdit && (
        <RoleReviewDialog
          open={reviewing}
          data={data}
          draft={draft}
          changes={changes}
          holders={holders}
          onClose={() => setReviewing(false)}
          onSaved={(count) => {
            setReviewing(false);
            void reread('saved', count);
          }}
          onConflict={(code) => {
            setReviewing(false);
            void reread(code);
          }}
        />
      )}
    </div>
  );
}

/** AC-1: a role code that isn't live. */
function MissingRole({ system, first }: { system: SystemCode; first: string | undefined }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-6 lg:p-9">
      <p className="text-body text-foreground">This role doesn't exist or was deleted.</p>
      <Link to={rolesHref(system, first)} replace className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <ArrowLeft aria-hidden="true" />
        {system} roles
      </Link>
    </div>
  );
}
