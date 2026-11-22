import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  KeyRound,
  LockOpen,
  LogOut,
  MonitorSmartphone,
  MoreVertical,
  Pencil,
  Power,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
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
import { Skeleton } from '@/components/ui/skeleton';
import { errorStatus, type AdminMe, type SystemCode } from '@/lib/admin';
import {
  deletePerson,
  endPersonSessions,
  errorMessage,
  getPerson,
  listPersonSessions,
  personActivity,
  ReauthCancelled,
  restorePerson,
  sendResetCode,
  setPersonActive,
  unlockPerson,
  updatePerson,
  type ManagedPerson,
  type SessionView,
  type UpdatePersonInput,
} from '@/lib/adminApi';
import { formatDate, formatDateTime } from '@/lib/format';
import { ActivityList } from '../activity/ActivityList';
import { NoSystemScope, SystemSwitcher, Toolbar, ViewError, ViewHeader } from '../AdminStates';
import { roleNames, useSystemsCatalog } from '../useCatalogs';
import { useAdminSystem } from '../useAdminSystem';
import { useAsync } from '../useAsync';
import { BackToPeople } from './AddPersonPage';
import { DeletedBadge, RoleBadge, StatusBadge, SuiteAdminBadge, TemporaryBadge } from './Badges';
import { PersonForm } from './PersonForm';
import type { PersonFormValues } from './personValues';
import { accountStatus, roleName } from './personStatus';

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; person: ManagedPerson };

/** Runs one account action: a toast on success, the server's message on failure. */
async function run(action: () => Promise<unknown>, done: string, failed: string): Promise<boolean> {
  try {
    await action();
    notifySuccess(done);
    return true;
  } catch (error) {
    if (error instanceof ReauthCancelled) return false;
    notifyError(errorMessage(error, failed));
    return false;
  }
}

/**
 * Suite spec 0013, AC-16, AC-23: `/admin/people/:id?system=VRMS`, one person in one system with
 * every account action. welinc-auth applies today's rules (self, last admin, shared account) and
 * asks for the actor's password when the person is an admin (AC-14b).
 */
export function PersonPage({ me }: { me: AdminMe }) {
  const scope = useAdminSystem(me);
  const { id } = useParams();
  if (scope.kind === 'none') return <NoSystemScope />;
  if (scope.kind === 'not-admin') return <NoSystemScope asked={scope.asked} />;
  if (!id) return null;
  return (
    <>
      {me.suiteAdmin && (
        <Toolbar>
          <SystemSwitcher value={scope.system} choices={scope.choices} onChange={(next) => next && scope.choose(next)} />
        </Toolbar>
      )}
      <Person key={`${id}:${scope.system}`} id={id} system={scope.system} me={me} />
    </>
  );
}

function Person({ id, system, me }: { id: string; system: SystemCode; me: AdminMe }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Bumped after each change, so the sessions and activity below reload
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPerson(id, system)
      .then((person) => !cancelled && setLoad({ kind: 'ready', person }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad(
          errorStatus(error) === 404 || errorStatus(error) === 400
            ? { kind: 'missing' }
            : { kind: 'error', message: errorMessage(error, "We couldn't load this person.") },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, system, attempt]);

  const changed = useCallback((person?: ManagedPerson) => {
    if (person) setLoad({ kind: 'ready', person });
    else setAttempt((n) => n + 1);
    setVersion((n) => n + 1);
  }, []);

  return (
    <>
      <BackToPeople system={system} />
      {load.kind === 'loading' && <PersonSkeleton />}
      {load.kind === 'missing' && (
        <p role="alert" className="py-8 text-sm text-foreground">
          This person isn't in {system}, or the account no longer exists.
          {me.suiteAdmin && ' Pick another system above.'}
        </p>
      )}
      {load.kind === 'error' && <ViewError message={load.message} onRetry={() => setAttempt((n) => n + 1)} />}
      {load.kind === 'ready' && (
        <PersonDetails person={load.person} system={system} self={load.person.id === me.user.id} version={version} onChanged={changed} />
      )}
    </>
  );
}

function PersonDetails({
  person,
  system,
  self,
  version,
  onChanged,
}: {
  person: ManagedPerson;
  system: SystemCode;
  self: boolean;
  version: number;
  onChanged: (person?: ManagedPerson) => void;
}) {
  const navigate = useNavigate();
  const catalog = useSystemsCatalog();
  const names = roleNames(catalog, system);
  const deleted = Boolean(person.deletedAt);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | 'deactivate' | 'delete' | 'sessions'>(null);
  const [busy, setBusy] = useState(false);
  const status = accountStatus(person);
  const code = person.passwordSet ? 'reset' : 'setup';

  const act = async (action: () => Promise<unknown>, done: string, failed: string, after?: () => void) => {
    setBusy(true);
    const ok = await run(action, done, failed);
    setBusy(false);
    if (ok) (after ?? (() => onChanged()))();
    return ok;
  };

  return (
    <>
      <ViewHeader
        title={person.name}
        context={<span className="break-all">{person.email}</span>}
        action={
          deleted ? (
            <Button
              size="touch"
              className="w-full sm:w-auto md:h-10"
              loading={busy}
              onClick={() =>
                void act(
                  async () => onChanged(await restorePerson(person.id, system)),
                  `${person.name} is back, still inactive. Reactivate them when they should sign in.`,
                  "We couldn't restore this account.",
                  () => undefined,
                )
              }
            >
              <RotateCcw aria-hidden="true" />
              Restore
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="touch" className="flex-1 sm:flex-none md:h-10" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-touch" className="md:size-10" aria-label="More actions" disabled={busy}>
                    <MoreVertical aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {person.isActive && (
                    <DropdownMenuItem
                      onSelect={() =>
                        void act(
                          () => sendResetCode(person.id, system),
                          `We emailed ${person.name} a ${code} code.`,
                          `We couldn't send a ${code} code.`,
                        )
                      }
                    >
                      <KeyRound aria-hidden="true" />
                      Send {code} code
                    </DropdownMenuItem>
                  )}
                  {person.isLocked && (
                    <DropdownMenuItem
                      onSelect={() =>
                        void act(
                          async () => onChanged(await unlockPerson(person.id, system)),
                          `${person.name} can sign in again.`,
                          "We couldn't unlock this account.",
                          () => undefined,
                        )
                      }
                    >
                      <LockOpen aria-hidden="true" />
                      Unlock
                    </DropdownMenuItem>
                  )}
                  {!self && person.isActive && (
                    <DropdownMenuItem onSelect={() => setConfirm('sessions')}>
                      <LogOut aria-hidden="true" />
                      End all sessions
                    </DropdownMenuItem>
                  )}
                  {!self && !person.isActive && (
                    <DropdownMenuItem
                      onSelect={() =>
                        void act(
                          async () => onChanged(await setPersonActive(person.id, system, true)),
                          `${person.name} can sign in again.`,
                          "We couldn't reactivate this account.",
                          () => undefined,
                        )
                      }
                    >
                      <Power aria-hidden="true" />
                      Reactivate
                    </DropdownMenuItem>
                  )}
                  {!self && person.isActive && (
                    <DropdownMenuItem onSelect={() => setConfirm('deactivate')}>
                      <Power aria-hidden="true" />
                      Deactivate
                    </DropdownMenuItem>
                  )}
                  {!self && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('delete')}>
                        <Trash2 aria-hidden="true" />
                        Delete account
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {person.roles.map((r) => (
          <RoleBadge key={r.role} code={r.role} name={roleName(r.role, names)} />
        ))}
        {person.suiteAdmin && <SuiteAdminBadge />}
        {person.temporaryUntil && <TemporaryBadge until={person.temporaryUntil} />}
        {deleted ? <DeletedBadge /> : <StatusBadge status={status} />}
        {person.pendingDeletion && <StatusBadge status="PENDING_DELETION" />}
      </div>

      <Section title="Details">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Email">
            <span className="break-all">{person.email}</span>
            <span className="block text-xs text-muted-foreground">
              {person.emailVerified ? 'Confirmed' : 'Not confirmed yet'}
            </span>
          </Fact>
          <Fact label="Password">{person.passwordSet ? 'Set' : 'Setup pending: they have not set one yet'}</Fact>
          <Fact label="Other systems">{person.otherSystems.length > 0 ? person.otherSystems.join(', ') : '—'}</Fact>
          <Fact label="Added">{formatDate(person.createdAt)}</Fact>
          {person.lockedAt && <Fact label="Locked since">{formatDateTime(person.lockedAt)}</Fact>}
          {person.deletedAt && <Fact label="Deleted">{formatDateTime(person.deletedAt)}</Fact>}
        </dl>
        {person.otherSystems.length > 0 && !deleted && (
          <p className="mt-3 text-xs text-muted-foreground">
            This account is shared. Deactivating it signs them out of every system; to take them out of {system} only,
            remove the {system} role instead.
          </p>
        )}
      </Section>

      {!deleted && (
        <Section title="Signed in devices">
          <Sessions personId={person.id} system={system} version={version} />
        </Section>
      )}

      <Section title="Recent activity">
        <ActivityList
          system={system}
          reloadKey={`${person.id}:${system}:${version}`}
          load={(cursor) => personActivity(person.id, system, cursor)}
          emptyMessage="Nothing recorded for this person yet."
        />
      </Section>

      <EditDialog
        open={editing}
        onOpenChange={setEditing}
        person={person}
        system={system}
        self={self}
        onSaved={(next) => {
          setEditing(false);
          onChanged(next);
        }}
      />

      <ConfirmAction
        open={confirm === 'deactivate'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Deactivate ${person.name}?`}
        body={
          person.otherSystems.length > 0
            ? `They are signed out at once and can't sign in to any system (${[system, ...person.otherSystems].join(', ')}) until someone reactivates them.`
            : 'They’re signed out now and can’t sign in until reactivated. Their open work gets flagged for reassignment.'
        }
        action="Deactivate"
        onConfirm={() =>
          act(
            async () => onChanged(await setPersonActive(person.id, system, false)),
            `${person.name} is deactivated.`,
            "We couldn't deactivate this account.",
            () => undefined,
          )
        }
      />
      <ConfirmAction
        open={confirm === 'sessions'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`End every session of ${person.name}?`}
        body="They’re signed out on every device and sign in again."
        action="End all sessions"
        onConfirm={() =>
          act(() => endPersonSessions(person.id, system), `${person.name} is signed out everywhere.`, "We couldn't end the sessions.")
        }
      />
      <ConfirmAction
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete ${person.name}'s account?`}
        body="They are signed out and can't sign in. You can restore the account during the grace period; after that their name and email are erased for good."
        action="Delete account"
        destructive
        onConfirm={() =>
          act(
            () => deletePerson(person.id, system),
            `${person.name}'s account is deleted.`,
            "We couldn't delete this account.",
            () => navigate(`/admin/people?system=${system}`),
          )
        }
      />
    </>
  );
}

function EditDialog({
  open,
  onOpenChange,
  person,
  system,
  self,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: ManagedPerson;
  system: SystemCode;
  self: boolean;
  onSaved: (person: ManagedPerson) => void;
}) {
  const catalog = useSystemsCatalog();
  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const current = person.roles[0]?.role ?? '';

  const save = async (values: PersonFormValues) => {
    const input: UpdatePersonInput = {};
    if (values.name !== person.name) input.name = values.name;
    if (values.email.toLowerCase() !== person.email.toLowerCase()) input.email = values.email;
    if (values.role !== current) input.roleAssignments = [{ role: values.role, system }];
    if (Object.keys(input).length === 0) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const next = await updatePerson(person.id, system, input);
      notifySuccess(`${next.name} is saved.`);
      onSaved({ ...person, ...next });
    } catch (error) {
      if (!(error instanceof ReauthCancelled)) setServerError(errorMessage(error, "We couldn't save the changes."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        setServerError('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {person.name}</DialogTitle>
          <DialogDescription>
            A new email is confirmed at their next sign in. Changing someone's role in {system} leaves their other systems
            as they are.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PersonForm
            id="edit-person"
            system={system}
            roles={roles}
            initial={{ name: person.name, email: person.email, role: current }}
            submitting={submitting}
            serverError={serverError}
            emailHint={self ? 'Change your own email from your profile, with a code.' : undefined}
            emailLocked={self}
            onSubmit={(values) => void save(self ? { ...values, email: person.email, role: current } : values)}
            footer={
              <DialogFooter>
                <Button variant="outline" type="button" disabled={submitting} onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-person" loading={submitting}>
                  {submitting ? 'Saving' : 'Save'}
                </Button>
              </DialogFooter>
            }
          />
        )}
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

function Sessions({ personId, system, version }: { personId: string; system: SystemCode; version: number }) {
  const [attempt, setAttempt] = useState(0);
  const { state } = useAsync(`${personId}|${system}|${version}|${attempt}`, () =>
    listPersonSessions(personId, system),
  );

  if (state.kind === 'error') {
    return <ViewError message="We couldn't load their sessions." onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (state.kind === 'loading') return <Skeleton className="h-12" />;
  const sessions: SessionView[] = state.value;
  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">Not signed in anywhere right now.</p>;
  return (
    <ul className="divide-y divide-border">
      {sessions.map((s) => (
        <li key={s.sid} className="flex items-start gap-3 py-3">
          <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm break-words text-foreground">{s.device}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {s.kind === 'mobile' ? 'Mobile app' : 'Web'}
              {s.systems.length > 0 && ` · ${s.systems.join(', ')}`} · last active {formatDateTime(s.lastActiveAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 border-t border-border pt-4 last:mb-0">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-strong uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading this person</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-32" />
    </div>
  );
}
