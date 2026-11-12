import { useState } from 'react';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminMe } from '@/lib/admin';
import { errorMessage, fetchMatrix, type MatrixCellChange, type PermissionMatrix } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { NoSystemScope, SystemSwitcher, ViewError, ViewHeader } from '../AdminStates';
import { useAdminSystem } from '../useAdminSystem';
import { useAsync } from '../useAsync';
import { MatrixHistory } from './MatrixHistory';
import { MatrixReviewDialog } from './MatrixReviewDialog';
import { groupsOf, isLocked, pendingChanges, shownValue, toggle, type MatrixDraft } from './matrixDraft';

/**
 * Suite spec 0013, AC-27: what each role may do in one system. Suite admins flip cells, review the
 * changes and save them in one go; a system admin reads their own system's matrix. Locked cells
 * never change. The history below lists every change, the ones moved from VRMS included.
 */
export function PermissionsView({ me }: { me: AdminMe }) {
  const scope = useAdminSystem(me);
  const system = scope.kind === 'ok' ? scope.system : null;
  const [attempt, setAttempt] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);
  const { state, replace } = useAsync(`${system}|${attempt}`, () =>
    system ? fetchMatrix(system) : Promise.resolve(null),
  );

  return (
    <>
      <ViewHeader
        title="Permissions"
        context={
          system
            ? me.suiteAdmin
              ? `What each ${system} role may do. Changes reach ${system} within about a minute.`
              : `What each ${system} role may do. Only suite admins change it.`
            : undefined
        }
      />
      {scope.kind !== 'none' && (
        <div className="mb-4">
          <SystemSwitcher value={system} choices={scope.choices} onChange={(next) => next && scope.choose(next)} />
        </div>
      )}
      {scope.kind === 'none' && <NoSystemScope />}
      {scope.kind === 'not-admin' && <NoSystemScope asked={scope.asked} />}
      {system && state.kind === 'loading' && <MatrixSkeleton />}
      {system && state.kind === 'error' && (
        <ViewError
          message={errorMessage(state.error, "We couldn't load the permissions.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {system && state.kind === 'ready' && state.value && (
        <>
          {state.value.permissions.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              {system} has no permission matrix yet. Its roles alone decide what people may do.
            </p>
          ) : (
            <MatrixEditor
              // A new version (a save, or a reload after a stale save) starts a clean draft
              key={`${system}|${state.value.version}`}
              matrix={state.value}
              onSaved={(next) => {
                replace(() => next);
                setHistoryKey((n) => n + 1);
              }}
              onReload={() => setAttempt((n) => n + 1)}
            />
          )}
          <MatrixHistory system={system} reloadKey={`${system}|${historyKey}`} />
        </>
      )}
    </>
  );
}

function MatrixEditor({
  matrix,
  onSaved,
  onReload,
}: {
  matrix: PermissionMatrix;
  onSaved: (next: PermissionMatrix) => void;
  onReload: () => void;
}) {
  const [draft, setDraft] = useState<MatrixDraft>({});
  const [reviewing, setReviewing] = useState(false);
  const changes: MatrixCellChange[] = pendingChanges(matrix, draft);
  const editable = matrix.canEdit;

  return (
    <div className="flex flex-col gap-6">
      {groupsOf(matrix).map(({ group, permissions }) => (
        <section key={group} aria-labelledby={`matrix-group-${group}`}>
          <h3
            id={`matrix-group-${group}`}
            className="mb-2 text-xs font-semibold tracking-wide text-muted-strong uppercase"
          >
            {group}
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <div aria-hidden="true" className="hidden items-center gap-3 bg-muted px-4 py-2 md:flex">
              <span className="flex-1 text-xs font-semibold tracking-wide text-muted-strong uppercase">Permission</span>
              {matrix.roles.map((role) => (
                <span
                  key={role.code}
                  className="w-28 shrink-0 text-center text-xs font-semibold tracking-wide text-muted-strong uppercase"
                >
                  {role.name}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {permissions.map((p) => (
                <li key={p.key} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words text-foreground">{p.label}</p>
                    {p.description && <p className="text-xs break-words text-muted-foreground">{p.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 md:flex-nowrap md:gap-0">
                    {matrix.roles.map((role) => {
                      const locked = isLocked(p, role.code);
                      const value = shownValue(matrix, draft, role.code, p.key);
                      const changed = draft[`${role.code}|${p.key}`] !== undefined;
                      return (
                        <label
                          key={role.code}
                          className={cn(
                            'flex min-h-11 items-center gap-2 rounded-md px-2 md:w-28 md:min-h-9 md:justify-center',
                            changed && 'bg-highlight/20 ring-1 ring-highlight',
                            editable && !locked && 'cursor-pointer',
                          )}
                          title={locked ? `${role.name} always keeps this setting` : undefined}
                        >
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 accent-primary disabled:opacity-60"
                            checked={value}
                            disabled={!editable || locked}
                            onChange={() => setDraft((d) => toggle(matrix, d, role.code, p.key))}
                            aria-label={`${role.name}: ${p.label}${locked ? ' (locked)' : ''}${changed ? ' (changed, not saved)' : ''}`}
                          />
                          <span className="text-sm text-foreground md:sr-only">{role.name}</span>
                          {locked && <Lock aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
                        </label>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {editable && changes.length > 0 && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-0 flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-md sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground tabular-nums">
            {changes.length === 1 ? '1 change not saved' : `${changes.length} changes not saved`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDraft({})}>
              Discard
            </Button>
            <Button onClick={() => setReviewing(true)}>Review and save</Button>
          </div>
        </div>
      )}

      <MatrixReviewDialog
        open={reviewing}
        matrix={matrix}
        changes={changes}
        onClose={() => setReviewing(false)}
        onSaved={(next) => {
          setReviewing(false);
          toast.success(
            changes.length === 1
              ? `1 permission saved. ${next.system} admins got an email.`
              : `${changes.length} permissions saved. ${next.system} admins got an email.`,
          );
          onSaved(next);
        }}
        onReload={() => {
          setReviewing(false);
          onReload();
        }}
      />
    </div>
  );
}

function MatrixSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading permissions">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
