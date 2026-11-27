import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert, UserRoundX } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fieldControl } from '@/components/ui/field-styles';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorCode } from '@/lib/admin';
import {
  createRole,
  deleteRole,
  errorDetail,
  errorMessage,
  listPeople,
  updateRole,
  type CreatedRole,
  type ManagedPerson,
  type RoleSummary,
  type RolesData,
} from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import type { MatrixDraft } from '../permissions/matrixDraft';
import { useAsync } from '../useAsync';
import {
  customRoleCopy,
  nameTaken,
  ROLE_DESCRIPTION_MAX,
  ROLE_NAME_MAX,
  roleNameProblem,
  sourceHasDraft,
  sourceHoldsPower,
} from './rolesRules';

/** The holders listed in the Delete dialog (umbrella Value sourcing: `limit=10`). */
const HOLDERS_SHOWN = 10;

const descriptionProblem = (text: string) =>
  text.trim().length > ROLE_DESCRIPTION_MAX ? `Description can have at most ${ROLE_DESCRIPTION_MAX} characters.` : null;

// ---- New role and Duplicate (AC-20 to AC-23) --------------------------------------------------

export type RoleFormStart = { kind: 'new'; from: string } | { kind: 'duplicate'; from: string; name: string };

/**
 * AC-20, AC-21: "New role" (Start from a select of the live roles, default the role on screen) or
 * "Duplicate [role]" (Start from fixed, Name prefilled). Create sends the source's saved cells,
 * never the draft; the dialog says so when the source holds unsaved changes.
 */
export function RoleFormDialog({
  start,
  data,
  draft,
  onClose,
  onCreated,
}: {
  /** Null when closed. */
  start: RoleFormStart | null;
  data: RolesData;
  draft: MatrixDraft;
  onClose: () => void;
  onCreated: (created: CreatedRole, source: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={start !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      {start && (
        <RoleFormBody
          key={`${start.kind}|${start.from}`}
          start={start}
          data={data}
          draft={draft}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </Dialog>
  );
}

function RoleFormBody({
  start,
  data,
  draft,
  busy,
  setBusy,
  onClose,
  onCreated,
}: {
  start: RoleFormStart;
  data: RolesData;
  draft: MatrixDraft;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onCreated: (created: CreatedRole, source: string) => void;
}) {
  const [name, setName] = useState(start.kind === 'duplicate' ? start.name : '');
  const [description, setDescription] = useState('');
  const [from, setFrom] = useState(start.from);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), description: useId(), from: useId() };
  const source = data.roles.find((r) => r.code === from);
  const sourceName = source?.name ?? from;
  const shownName = name.trim() || 'This role';
  const title = start.kind === 'duplicate' ? `Duplicate ${sourceName}` : 'New role';

  const submit = async () => {
    const problem =
      roleNameProblem(name) ?? (nameTaken(data.roles, name) ? customRoleCopy.taken(name.trim(), data.system) : null);
    const descProblem = descriptionProblem(description);
    setNameError(problem);
    setDescriptionError(descProblem);
    if (problem || descProblem) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createRole(data.system, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        from,
      });
      setBusy(false);
      onCreated(created, sourceName);
    } catch (e) {
      setBusy(false);
      const code = errorCode(e);
      if (code === 'ROLE_NAME_TAKEN') setNameError(customRoleCopy.taken(name.trim(), data.system));
      else if (code === 'VALIDATION_FAILED') setNameError(errorMessage(e, 'Check the name and try again.'));
      else if (code === 'CUSTOM_ROLE_LIMIT') setError(customRoleCopy.limit(data.system));
      else if (code === 'UNKNOWN_ROLE') setError(`${sourceName} was deleted. Pick another role to start from.`);
      else setError(errorMessage(e, "We couldn't create the role. Try again."));
    }
  };

  return (
    <DialogContent className="sm:max-w-lg" onEscapeKeyDown={(e) => busy && e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>A custom role for {data.system}. You can give it to people once it's made.</DialogDescription>
      </DialogHeader>
      <form
        id="role-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.name}>Name</Label>
          <Input
            id={ids.name}
            value={name}
            autoFocus
            maxLength={ROLE_NAME_MAX + 20}
            disabled={busy}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${ids.name}-error` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
          />
          {nameError && (
            <p id={`${ids.name}-error`} className="text-small text-error">
              {nameError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.description}>
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id={ids.description}
            value={description}
            rows={2}
            disabled={busy}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={`${ids.description}-hint`}
            onChange={(e) => {
              setDescription(e.target.value);
              setDescriptionError(null);
            }}
          />
          <p id={`${ids.description}-hint`} className={cn('text-caption font-normal', descriptionError ? 'text-error' : 'text-muted-foreground')}>
            {descriptionError ?? `${description.trim().length}/${ROLE_DESCRIPTION_MAX}`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {start.kind === 'duplicate' ? (
            <>
              <span className="text-label text-muted-strong">Start from</span>
              <p className="text-body font-medium text-foreground">{sourceName}</p>
            </>
          ) : (
            <Label htmlFor={ids.from}>Start from</Label>
          )}
          {start.kind === 'new' && (
            <select
              id={ids.from}
              value={from}
              disabled={busy}
              onChange={(e) => setFrom(e.target.value)}
              aria-describedby={`${ids.from}-hint`}
              className={cn('h-10 px-3 max-sm:h-11', fieldControl)}
            >
              {data.roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.builtIn ? r.name : `${r.name} (custom)`}
                </option>
              ))}
            </select>
          )}
          <p id={`${ids.from}-hint`} className="text-caption font-normal text-muted-foreground">
            Its permissions are copied. You can change them after.
          </p>
        </div>
        {sourceHasDraft(draft, from) && (
          <p className="flex items-start gap-2 text-small text-muted-strong">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {customRoleCopy.draftNotCopied(sourceName)}
          </p>
        )}
        {sourceHoldsPower(data, from) && (
          <p className="flex items-start gap-2 text-small text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {customRoleCopy.power(shownName, data.system)}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-small text-error">
            {error}
          </p>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" form="role-form" disabled={busy}>
          {busy ? 'Creating…' : 'Create role'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Rename and Edit description (AC-24) ------------------------------------------------------

export type RoleFieldKind = 'name' | 'description';

/** AC-24: one field and Save. The code never changes, so tokens and VRMS data are untouched. */
export function RoleFieldDialog({
  kind,
  data,
  role,
  onClose,
  onSaved,
}: {
  /** Null when closed. */
  kind: RoleFieldKind | null;
  data: RolesData;
  role: RoleSummary;
  onClose: () => void;
  onSaved: (role: RoleSummary, kind: RoleFieldKind) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={kind !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      {kind && (
        <RoleFieldBody
          key={`${kind}|${role.code}`}
          kind={kind}
          data={data}
          role={role}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function RoleFieldBody({
  kind,
  data,
  role,
  busy,
  setBusy,
  onClose,
  onSaved,
}: {
  kind: RoleFieldKind;
  data: RolesData;
  role: RoleSummary;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onSaved: (role: RoleSummary, kind: RoleFieldKind) => void;
}) {
  const [value, setValue] = useState(kind === 'name' ? role.name : role.description);
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();
  const isName = kind === 'name';

  const submit = async () => {
    const trimmed = value.trim();
    const found = isName
      ? (roleNameProblem(value) ??
        (nameTaken(data.roles, value, role.code) ? customRoleCopy.taken(trimmed, data.system) : null))
      : descriptionProblem(value);
    setProblem(found);
    if (found) return;
    // Nothing changed: close without a write, so no empty role event is recorded
    if (trimmed === (isName ? role.name : role.description)) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const saved = await updateRole(data.system, role.code, isName ? { name: trimmed } : { description: trimmed });
      setBusy(false);
      onSaved(saved, kind);
    } catch (e) {
      setBusy(false);
      if (errorCode(e) === 'ROLE_NAME_TAKEN') setProblem(customRoleCopy.taken(trimmed, data.system));
      else setProblem(errorMessage(e, "We couldn't save that. Try again."));
    }
  };

  return (
    <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => busy && e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{isName ? `Rename ${role.name}` : 'Edit description'}</DialogTitle>
        <DialogDescription>
          {isName
            ? 'Everyone who has it keeps it. Only the name changes.'
            : `What ${role.name} is for, shown under its name.`}
        </DialogDescription>
      </DialogHeader>
      <form
        id="role-field-form"
        noValidate
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Label htmlFor={id} className={cn(!isName && 'sr-only')}>
          {isName ? 'Name' : 'Description'}
        </Label>
        {isName ? (
          <Input
            id={id}
            value={value}
            autoFocus
            disabled={busy}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setProblem(null);
            }}
          />
        ) : (
          <Textarea
            id={id}
            value={value}
            rows={3}
            autoFocus
            disabled={busy}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${id}-error`}
            onChange={(e) => {
              setValue(e.target.value);
              setProblem(null);
            }}
          />
        )}
        {problem ? (
          <p id={`${id}-error`} role="alert" className="text-small text-error">
            {problem}
          </p>
        ) : (
          !isName && (
            <p id={`${id}-error`} className="text-caption font-normal text-muted-foreground">
              {value.trim().length}/{ROLE_DESCRIPTION_MAX}
            </p>
          )
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" form="role-field-form" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Delete (AC-25, board Confirm6 DB) --------------------------------------------------------

/**
 * AC-25 (`Confirm6` DB): with live holders the dialog is blocked and lists up to ten of them, each
 * with "Change role →" to their Access tab; with none it asks once. The server checks again and a
 * 409 `ROLE_IN_USE` turns the dialog into the blocked one with the server's count.
 */
export function DeleteRoleDialog({
  open,
  data,
  role,
  onClose,
  onDeleted,
  onShowPeople,
}: {
  open: boolean;
  data: RolesData;
  role: RoleSummary;
  onClose: () => void;
  onDeleted: (version: number) => void;
  /** "and [k] more": closes the dialog on the role's People tab. */
  onShowPeople: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      {open && (
        <DeleteRoleBody
          key={role.code}
          data={data}
          role={role}
          busy={busy}
          setBusy={setBusy}
          onDeleted={onDeleted}
          onShowPeople={onShowPeople}
        />
      )}
    </AlertDialog>
  );
}

function DeleteRoleBody({
  data,
  role,
  busy,
  setBusy,
  onDeleted,
  onShowPeople,
}: {
  data: RolesData;
  role: RoleSummary;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDeleted: (version: number) => void;
  onShowPeople: () => void;
}) {
  // The server's count wins once it refused (AC-25): someone was given the role meanwhile
  const [refusedCount, setRefusedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const count = refusedCount ?? role.peopleCount;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { version } = await deleteRole(data.system, role.code);
      setBusy(false);
      onDeleted(version);
    } catch (e) {
      setBusy(false);
      if (errorCode(e) === 'ROLE_IN_USE') setRefusedCount(errorDetail(e, 'count') ?? Math.max(1, role.peopleCount));
      else setError(errorMessage(e, `We couldn't delete ${role.name}. Try again.`));
    }
  };

  if (count > 0) {
    return (
      <AlertDialogContent>
        <AlertDialogHeader>
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-warning-bg text-warning"
          >
            <UserRoundX className="size-5.5" />
          </span>
          <AlertDialogTitle>{customRoleCopy.stillHeld(count, role.name)}</AlertDialogTitle>
          <AlertDialogDescription>
            Give them another role first. Then you can delete it. No one loses access by surprise.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Holders data={data} role={role} count={count} version={refusedCount ?? 0} onMore={onShowPeople} />
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <Button variant="destructive" disabled>
            Delete role
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    );
  }

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {role.name}?</AlertDialogTitle>
        <AlertDialogDescription>No one has it. Its history stays on record.</AlertDialogDescription>
      </AlertDialogHeader>
      {error && (
        <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-small text-error">
          {error}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
          {busy ? 'Deleting…' : 'Delete'}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

/** Up to ten holders, each linking to their Access tab, then "and [k] more" to the People tab. */
function Holders({
  data,
  role,
  count,
  version,
  onMore,
}: {
  data: RolesData;
  role: RoleSummary;
  count: number;
  version: number;
  onMore: () => void;
}) {
  const { state } = useAsync<ManagedPerson[]>(`${data.system}|${role.code}|${version}`, async () =>
    (await listPeople({ system: data.system, role: role.code, limit: HOLDERS_SHOWN, sort: 'name' })).items,
  );
  if (state.kind === 'loading') {
    return (
      <div aria-busy="true" className="flex flex-col gap-1.5">
        <span className="sr-only">Loading who has it</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (state.kind === 'error') return null;
  const more = count - state.value.length;
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={`People with ${role.name}`} className="flex flex-col rounded-lg border border-divider">
        {state.value.map((person) => (
          <li key={person.id} className="not-last:border-b not-last:border-divider">
            <Link
              to={`/admin/people/${person.id}?tab=access`}
              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 text-body font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{person.name}</span>
              <span className="shrink-0 text-small font-semibold text-primary">Change role →</span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Button variant="link" size="sm" className="self-start px-0" onClick={onMore}>
          and {more} more
        </Button>
      )}
    </div>
  );
}
