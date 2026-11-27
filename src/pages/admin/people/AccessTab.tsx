import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { RoleChip } from '@/components/ui/role-chip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorCode, type AdminMe, type SystemCode } from '@/lib/admin';
import { errorMessage, ReauthCancelled, updatePerson, type CatalogSystem, type PersonDetail } from '@/lib/adminApi';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { PaneCard, SystemChip } from './peopleParts';
import { accessRows, personSystems, type AccessRow } from './peopleRules';
import { TemporaryTag } from './TemporaryTag';
import type { PersonActions } from './personActions';

/**
 * Suite spec 0017, AC-12, AC-17 (boards `People4` and `People8`): every system as a row. Rows the
 * viewer admins offer Change role or Give access; a system someone else admins is read only.
 */
export function AccessTab({
  person,
  me,
  catalog,
  actions,
  onGiveAccess,
}: {
  person: PersonDetail;
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  actions: PersonActions;
  onGiveAccess: (system: SystemCode) => void;
}) {
  const [changing, setChanging] = useState<Extract<AccessRow, { kind: 'held' }> | null>(null);
  const rows = accessRows(person, me, catalog);
  const none = personSystems(person).length === 0;

  return (
    <PaneCard title="Access">
      {none && (
        <p className="border-b border-divider px-5 py-3 text-small text-muted-foreground">No access to VRMS, VMMS or BMS.</p>
      )}
      <ul>
        {rows.map((row) => (
          <li
            key={row.system}
            className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-5 py-3 last:border-b-0"
          >
            <SystemChip system={row.system} filled={row.kind !== 'missing'} className="w-12" />
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
              <span
                className={cn(
                  'text-body',
                  row.kind === 'missing' ? 'text-muted-foreground' : 'font-semibold text-foreground',
                )}
              >
                {row.kind === 'missing' ? 'No access' : row.roles.join(', ') || 'A role'}
              </span>
              {row.kind === 'readonly' && (
                <span className="text-caption font-normal text-muted-foreground">Managed by the {row.system} admin</span>
              )}
              {row.kind === 'held' && row.action === 'temporary' && (
                <span className="text-caption font-normal text-muted-foreground">
                  Ends by itself ·{' '}
                  <Link
                    to="/admin/temporary-access"
                    className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    Temporary access
                  </Link>
                </span>
              )}
            </div>
            {row.kind === 'held' && row.temporaryUntil && <TemporaryTag until={row.temporaryUntil} />}
            {row.kind === 'held' && row.action === 'change' && (
              <Button variant="outline" size="sm" onClick={() => setChanging(row)}>
                Change role
              </Button>
            )}
            {row.kind === 'missing' && row.canGive && (
              <Button variant="outline" size="sm" className="border-dashed" onClick={() => onGiveAccess(row.system)}>
                <Plus aria-hidden="true" />
                Give access
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ChangeRoleDialog
        key={changing?.system ?? 'none'}
        row={changing}
        person={person}
        catalog={catalog}
        actions={actions}
        onClose={() => setChanging(null)}
      />
    </PaneCard>
  );
}

/** AC-13: one role per system, chosen from the catalog; Remove takes the person out of it. */
function ChangeRoleDialog({
  row,
  person,
  catalog,
  actions,
  onClose,
}: {
  row: Extract<AccessRow, { kind: 'held' }> | null;
  person: PersonDetail;
  catalog: CatalogSystem[] | null;
  actions: PersonActions;
  onClose: () => void;
}) {
  const system = row?.system;
  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];
  const [choice, setChoice] = useState(row?.roleCodes[0] ?? '');
  const [busy, setBusy] = useState<null | 'save' | 'remove'>(null);
  const [problem, setProblem] = useState('');
  const onlyAccess = personSystems(person).length === 1;

  if (!row || !system) return null;

  const send = async (kind: 'save' | 'remove') => {
    const next = kind === 'save' ? [{ role: choice, system }] : [];
    const label = roles.find((r) => r.code === choice)?.name ?? choice;
    setBusy(kind);
    setProblem('');
    try {
      await updatePerson(person.id, system, { roleAssignments: next });
      notifySuccess(
        kind === 'save' ? `${person.name} is now ${label} in ${system}.` : `${person.name} no longer has access to ${system}.`,
      );
      onClose();
      actions.settled({ roleChanged: true });
    } catch (error) {
      if (error instanceof ReauthCancelled) return;
      const message = roleProblem(error, person.name, system);
      if (message) setProblem(message);
      else if (actions.conflict(error)) onClose();
      else setProblem(errorMessage(error, "We couldn't change the role. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const unchanged = row.roleCodes.length === 1 && row.roleCodes[0] === choice;
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role in {system}</DialogTitle>
          <DialogDescription>
            {row.roles.length >= 2
              ? `This replaces ${row.roles.join(' and ')}.`
              : `Their access in the other systems stays as it is.`}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2" disabled={Boolean(busy)}>
          <legend className="sr-only">Role in {system}</legend>
          {roles.map((role) => (
            <label
              key={role.code}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-info-bg has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="change-role"
                value={role.code}
                checked={choice === role.code}
                onChange={() => setChoice(role.code)}
                className="mt-0.5 size-4 accent-primary outline-none"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-foreground">{role.name}</span>
                  {role.builtIn === false && <RoleChip custom>Custom</RoleChip>}
                </span>
                {role.description && (
                  <span className="text-caption font-normal text-muted-foreground">{role.description}</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        {problem && (
          <p role="alert" className="text-body text-destructive">
            {problem}
          </p>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="-ml-3"
              disabled={onlyAccess || Boolean(busy)}
              loading={busy === 'remove'}
              onClick={() => void send('remove')}
            >
              Remove from {system}
            </Button>
            {onlyAccess && (
              <span className="text-caption font-normal text-muted-foreground">
                This is their only access. Deactivate them instead.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={Boolean(busy)} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!choice || unchanged || Boolean(busy)} loading={busy === 'save'} onClick={() => void send('save')}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** AC-13: the role errors shown inside the dialog. */
function roleProblem(error: unknown, name: string, system: SystemCode): string | null {
  switch (errorCode(error)) {
    case 'LAST_ADMIN':
      return `${name} is the last active admin of ${system}. Make someone else admin first.`;
    case 'TEMPORARY_ROLE':
      return 'This role is temporary and ends by itself.';
    case 'ROLE_LIMIT':
      return errorMessage(error, 'They hold as many roles as this system allows.');
    default:
      return null;
  }
}
