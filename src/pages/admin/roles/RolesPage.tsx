import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SaveBar, type SaveBarChange } from '@/components/ui/save-bar';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { AdminMe, SystemCode } from '@/lib/admin';
import { errorMessage, fetchRoles, type RolesData } from '@/lib/adminApi';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { NoSystemScope, ViewError } from '../AdminStates';
import { MatrixReviewDialog } from '../permissions/MatrixReviewDialog';
import { pendingChanges, toggle, type MatrixDraft } from '../permissions/matrixDraft';
import { useAsync } from '../useAsync';
import { RoleDetail, RoleSkeleton } from './RoleDetail';
import { RoleList } from './RoleList';
import { joinNames, keepLiveDraft, parseRoleSystem, peopleWords, roleSystems, rolesHref, toMatrix } from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-1 (board Roles9): `/admin/roles/:system/:role` is one page, the
 * role list beside one role, each scrolling on its own. `/admin/roles` and `/admin/roles/:system`
 * open the first role of the viewer's first system with `replace` (below 768px they show the
 * list instead, since the list and the role are separate screens there). Picking a role replaces
 * the address. Flipped switches collect in one draft per system, keyed `role|key`, and are saved
 * together through the matrix PATCH.
 */
export function RolesPage({ me }: { me: AdminMe }) {
  const params = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const systems = roleSystems(me);
  const fromPath = parseRoleSystem(me, params.system);
  const hinted = parseRoleSystem(me, new URLSearchParams(search).get('system'));
  const system = fromPath ?? hinted ?? systems[0];

  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Partial<Record<SystemCode, MatrixDraft>>>({});
  const [reviewing, setReviewing] = useState(false);
  const { state } = useAsync<RolesData | null>(`${system ?? ''}|${attempt}`, () =>
    system ? fetchRoles(system) : Promise.resolve(null),
  );
  const data = state.kind === 'ready' ? state.value : null;

  // Each read (load, after a save, after a stale save) keeps only the draft entries that still
  // change something on a live role, adjusted during render, not in an effect
  const [seen, setSeen] = useState<RolesData | null>(null);
  if (data && data !== seen) {
    setSeen(data);
    setDrafts((current) => ({ ...current, [data.system]: keepLiveDraft(toMatrix(data), current[data.system] ?? {}) }));
  }

  if (!system) return <NoSystemScope />;
  // A missing, unknown or lower case system becomes the canonical address
  if (params.system !== system) {
    return <Navigate to={fromPath ? rolesHref(system, params.role) : rolesHref(system)} replace />;
  }

  const draft = drafts[system] ?? {};
  const matrix = data ? toMatrix(data) : null;
  const role = data?.roles.find((r) => r.code === params.role);
  if (data && !params.role && !isMobile && data.roles[0]) {
    return <Navigate to={rolesHref(system, data.roles[0].code)} replace />;
  }

  const setDraft = (update: (current: MatrixDraft) => MatrixDraft) =>
    setDrafts((current) => ({ ...current, [system]: update(current[system] ?? {}) }));
  const changes = matrix ? pendingChanges(matrix, draft) : [];
  const touched = data ? data.roles.filter((r) => changes.some((c) => c.role === r.code)) : [];
  const people = touched.reduce((sum, r) => sum + r.peopleCount, 0);

  const barChanges: SaveBarChange[] = matrix
    ? changes.map((c) => {
        const permission = matrix.permissions.find((p) => p.key === c.key);
        const roleName = matrix.roles.find((r) => r.code === c.role)?.name ?? c.role;
        return {
          id: `${c.role}|${c.key}`,
          group: touched.length > 1 ? roleName : (permission?.group ?? ''),
          label: permission?.label ?? c.key,
          kind: c.allowed ? 'added' : 'removed',
          from: c.allowed ? 'Off' : 'On',
          to: c.allowed ? 'On' : 'Off',
          onUndo: () => setDraft((d) => toggle(matrix, d, c.role, c.key)),
        };
      })
    : [];

  return (
    <div className="md:flex md:h-below-bar">
      <div className={cn('md:w-90 md:shrink-0 md:border-r md:border-border', params.role && 'max-md:hidden')}>
        <RoleList
          systems={systems}
          system={system}
          data={data}
          selected={params.role}
          draft={draft}
          onSystem={(next) => navigate(rolesHref(next), { replace: true })}
          onSelect={(code) => navigate(rolesHref(system, code), { replace: true })}
        />
      </div>
      <div
        className={cn(
          'relative flex min-w-0 flex-1 flex-col md:overflow-y-auto md:overscroll-contain',
          !params.role && 'max-md:hidden',
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
        {data && matrix && params.role && !role && <MissingRole system={system} first={data.roles[0]?.code} />}
        {data && matrix && role && (
          <div className={cn('flex-1', data.canEdit && 'pb-24')}>
            <RoleDetail
              data={data}
              matrix={matrix}
              role={role}
              draft={draft}
              onToggle={(key) => setDraft((d) => toggle(matrix, d, role.code, key))}
            />
          </div>
        )}
        {data?.canEdit && (
          <SaveBar
            name={touched.length === 1 ? touched[0].name : `${touched.length} roles`}
            changes={barChanges}
            subline={
              touched.length > 0
                ? `${joinNames(touched.map((r) => r.name))} · ${people > 0 ? `affects ${peopleWords(people).toLowerCase()}` : 'no one holds it yet'}`
                : undefined
            }
            onDiscard={() => setDraft(() => ({}))}
            onReview={() => setReviewing(true)}
          />
        )}
      </div>
      {matrix && (
        <MatrixReviewDialog
          open={reviewing}
          matrix={matrix}
          changes={changes}
          onClose={() => setReviewing(false)}
          onSaved={() => {
            setReviewing(false);
            notifySuccess(
              changes.length === 1
                ? `Saved 1 change to ${system} roles.`
                : `Saved ${changes.length} changes to ${system} roles.`,
            );
            setDraft(() => ({}));
            setAttempt((n) => n + 1);
          }}
          onReload={() => {
            setReviewing(false);
            setAttempt((n) => n + 1);
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
