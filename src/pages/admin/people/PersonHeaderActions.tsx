import { useState, type FormEvent } from 'react';
import { KeyRound, LockOpen, LogOut, MoreVertical, Power, RotateCcw, Send, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminMe, SystemCode } from '@/lib/admin';
import {
  deletePerson,
  endPersonSessions,
  errorMessage,
  ReauthCancelled,
  restorePerson,
  sendResetCode,
  setPersonActive,
  unlockPerson,
  updatePerson,
  type PersonDetail,
} from '@/lib/adminApi';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { PersonActions } from './personActions';
import { actionSystem, isPending, orList, personSystems, viewerAdmins } from './peopleRules';

type Confirm = null | 'deactivate' | 'delete' | 'sessions';

/**
 * Suite spec 0017, AC-8, AC-16 (board `People8`): the header buttons by status, Edit details, and
 * the ⋮ menu. Account wide actions send AC-16's system, never one the viewer picks; welinc-auth
 * asks for the viewer's password when the person is an admin elsewhere (`withReauth`).
 */
export function PersonHeaderActions({
  person,
  me,
  actions,
}: {
  person: PersonDetail;
  me: AdminMe;
  actions: PersonActions;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const self = person.id === me.user.id;
  const system = actionSystem(person, me);
  const pending = isPending(person);

  /** Runs one action: a toast on success, the conflict rule or the server's message on failure. */
  const run = async (action: () => Promise<unknown>, done: string, failed: string, quietGone = false) => {
    setBusy(true);
    try {
      await action();
      notifySuccess(done);
      actions.settled({ quietGone });
      return true;
    } catch (error) {
      if (error instanceof ReauthCancelled) return false;
      if (!actions.conflict(error)) notifyError(errorMessage(error, failed));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // AC-17: a deleted account shows Restore (suite admins only) and nothing else
  if (person.deletedAt) {
    if (!me.suiteAdmin) return null;
    return (
      <Button
        loading={busy}
        onClick={() =>
          void run(
            () => restorePerson(person.id, null),
            `${person.name} is back, still inactive. Reactivate them when they should sign in.`,
            "We couldn't restore this account.",
          )
        }
      >
        <RotateCcw aria-hidden="true" />
        Restore
      </Button>
    );
  }

  // AC-8: a system admin can't delete an account shared with a system they don't admin
  const sharedWith = me.suiteAdmin ? [] : personSystems(person).filter((s) => !viewerAdmins(me, s));
  const canDelete = !self && !person.suiteAdmin;
  const sendCode = (s: SystemCode) =>
    run(
      () => sendResetCode(person.id, s),
      `We emailed ${person.name} a ${person.passwordSet ? 'reset' : 'setup'} code.`,
      `We couldn't send a ${person.passwordSet ? 'reset' : 'setup'} code.`,
    );

  return (
    <div className="flex flex-wrap gap-2">
      {system && pending && (
        <Button loading={busy} onClick={() => void sendCode(system)}>
          <Send aria-hidden="true" />
          Resend invite
        </Button>
      )}
      {system && person.isLocked && (
        <Button
          loading={busy}
          onClick={() =>
            void run(() => unlockPerson(person.id, system), `${person.name} can sign in again.`, "We couldn't unlock this account.")
          }
        >
          <LockOpen aria-hidden="true" />
          Unlock account
        </Button>
      )}
      {system && (
        <Button variant="outline" disabled={busy} onClick={() => setEditing(true)}>
          Edit details
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="max-sm:size-11" aria-label="More account actions" disabled={busy}>
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {system && person.isActive && (
            <DropdownMenuItem onSelect={() => void sendCode(system)}>
              <KeyRound aria-hidden="true" />
              {pending ? 'Send setup code' : 'Send reset code'}
            </DropdownMenuItem>
          )}
          {system && !self && person.isActive && (
            <DropdownMenuItem onSelect={() => setConfirm('sessions')}>
              <LogOut aria-hidden="true" />
              End all sessions
            </DropdownMenuItem>
          )}
          {system && !self && !person.suiteAdmin && (
            <DropdownMenuItem
              onSelect={() =>
                person.isActive
                  ? setConfirm('deactivate')
                  : void run(
                      () => setPersonActive(person.id, system, true),
                      `${person.name} can sign in again.`,
                      "We couldn't reactivate this account.",
                    )
              }
            >
              <Power aria-hidden="true" />
              {person.isActive ? 'Deactivate' : 'Reactivate'}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              {system && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                disabled={sharedWith.length > 0}
                onSelect={() => setConfirm('delete')}
                className="flex-wrap"
              >
                <Trash2 aria-hidden="true" />
                Delete account
                {sharedWith.length > 0 && (
                  <span className="basis-full pl-6 text-caption font-normal text-muted-foreground">
                    Shared with {orList(sharedWith)}
                  </span>
                )}
              </DropdownMenuItem>
            </>
          )}
          {!system && !canDelete && (
            <DropdownMenuItem disabled>No actions for this account</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {system && (
        <EditDetailsDialog
          key={`${person.id}:${editing}`}
          open={editing}
          onOpenChange={setEditing}
          person={person}
          system={system}
          self={self}
          actions={actions}
        />
      )}

      {system && (
        <ConfirmAction
          open={confirm === 'deactivate'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Deactivate ${person.name}?`}
          body={
            personSystems(person).length > 1
              ? `They are signed out at once and can't sign in to any system (${personSystems(person).join(', ')}) until someone reactivates them.`
              : 'They’re signed out now and can’t sign in until reactivated. Their open work gets flagged for reassignment.'
          }
          action="Deactivate"
          onConfirm={() =>
            run(
              () => setPersonActive(person.id, system, false),
              `${person.name} is deactivated.`,
              "We couldn't deactivate this account.",
            )
          }
        />
      )}
      {system && (
        <ConfirmAction
          open={confirm === 'sessions'}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`End every session of ${person.name}?`}
          body="They’re signed out on every device and sign in again."
          action="End all sessions"
          onConfirm={() =>
            run(() => endPersonSessions(person.id, system), `${person.name} is signed out everywhere.`, "We couldn't end the sessions.")
          }
        />
      )}
      <ConfirmAction
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete ${person.name}'s account?`}
        body="They are signed out and can't sign in. You can restore the account during the grace period; after that their name and email are erased for good."
        action="Delete account"
        destructive
        onConfirm={() =>
          run(
            // AC-16: a suite admin deletes with no system; a system admin sends AC-16's system
            () => deletePerson(person.id, me.suiteAdmin ? null : system),
            `${person.name}'s account is deleted.`,
            "We couldn't delete this account.",
            true,
          )
        }
      />
    </div>
  );
}

/** Name and email; a role changes from the Access tab (AC-12, AC-13). */
function EditDetailsDialog({
  open,
  onOpenChange,
  person,
  system,
  self,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonDetail;
  system: SystemCode;
  self: boolean;
  actions: PersonActions;
}) {
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: { name?: string; email?: string } = {};
    if (!name.trim()) found.name = 'Enter a name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = 'Enter an email like name@example.com.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input: { name?: string; email?: string } = {};
    if (name.trim() !== person.name) input.name = name.trim();
    if (!self && email.trim().toLowerCase() !== person.email.toLowerCase()) input.email = email.trim();
    if (Object.keys(input).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setProblem('');
    try {
      const next = await updatePerson(person.id, system, input);
      notifySuccess(`${next.name} is saved.`);
      onOpenChange(false);
      actions.settled();
    } catch (error) {
      if (error instanceof ReauthCancelled) return;
      if (actions.conflict(error)) onOpenChange(false);
      else setProblem(errorMessage(error, "We couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {person.name}</DialogTitle>
          <DialogDescription>A new email is confirmed at their next sign in.</DialogDescription>
        </DialogHeader>
        <form id="edit-details" noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-details-name">Full name</Label>
            <Input
              id="edit-details-name"
              value={name}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'edit-details-name-error' : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <p id="edit-details-name-error" className="text-small text-destructive">
                {errors.name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-details-email">Work email</Label>
            <Input
              id="edit-details-email"
              type="email"
              value={email}
              disabled={self}
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={self ? 'edit-details-email-hint' : errors.email ? 'edit-details-email-error' : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
            {self && (
              <p id="edit-details-email-hint" className="text-small text-muted-foreground">
                Change your own email from your profile, with a code.
              </p>
            )}
            {errors.email && (
              <p id="edit-details-email-error" className="text-small text-destructive">
                {errors.email}
              </p>
            )}
          </div>
          {problem && (
            <p role="alert" className="text-body text-destructive">
              {problem}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-details" loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmAction({
  open,
  onOpenChange,
  title,
  body,
  action,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              setBusy(true);
              void onConfirm().then((ok) => {
                setBusy(false);
                if (ok) onOpenChange(false);
              });
            }}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
