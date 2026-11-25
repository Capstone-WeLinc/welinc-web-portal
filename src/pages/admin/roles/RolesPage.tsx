import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SaveBar, type SaveBarChange, type SaveBarPeople } from '@/components/ui/save-bar';
import { useDraft } from '@/hooks/useDraft';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { AdminMe, SystemCode } from '@/lib/admin';
import { errorMessage, fetchRoles, listPeople, type RolesData } from '@/lib/adminApi';
import { notify, notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { NoSystemScope, ViewError } from '../AdminStates';
import { pendingChanges, toggle, type MatrixDraft } from '../permissions/matrixDraft';
import { useAsync } from '../useAsync';
import { RoleDetail, RoleSkeleton } from './RoleDetail';
import { RoleList } from './RoleList';
import { RoleReviewDialog, type SaveConflict } from './RoleReviewDialog';
import {
  barSubline,
  checkDraft,
  deletedCount,
  draftFromStored,
  parseRoleSystem,
  reachLine,
  resetToDefaults,
  roleSystems,
  rolesCopy,
  rolesHref,
  storedChanges,
  storedCurrent,
  toMatrix,
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
  const reset =
    data && role && data.canEdit && data.supportsCustomRoles && role.builtIn
      ? {
          disabled: !resetToDefaults(data, draft, role.code).changed,
          onReset: () => setDraft((d) => resetToDefaults(data, d, role.code).draft),
        }
      : undefined;

  return (
    <div className="md:flex md:h-below-bar">
      <div className={cn('md:w-90 md:shrink-0 md:border-r md:border-border', roleCode && 'max-md:hidden')}>
        <RoleList
          systems={systems}
          system={system}
          data={data}
          selected={roleCode}
          draft={draft}
          onSystem={(next) => navigate(rolesHref(next), { replace: true })}
          onSelect={(code) => navigate(rolesHref(system, code), { replace: true })}
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
              reset={reset}
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
