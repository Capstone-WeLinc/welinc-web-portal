import { useEffect, useState } from 'react';
import { Search, ShieldPlus, UserMinus } from 'lucide-react';
import { notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { errorCode, type AdminMe } from '@/lib/admin';
import {
  addSuiteAdmin,
  errorMessage,
  listPeople,
  listSuiteAdmins,
  removeSuiteAdmin,
  verifyPassword,
  type ManagedPerson,
  type SuiteAdmin,
} from '@/lib/adminApi';
import { reauthFailure } from '@/lib/adminErrors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ViewError, ViewHeader } from '../AdminStates';
import { PasswordField, ReasonField } from '../ConfirmFields';
import { reasonProblem } from '../reason';
import { useAsync } from '../useAsync';
import { Cell, DataTable, Muted, PersonCell, Row } from '../AdminTable';

/** AC-1: at most three suite admins, never fewer than one. */
const MAX_SUITE_ADMINS = 3;
const SEARCH_DELAY_MS = 300;

/** The answers of AC-1 and AC-2, in the dialog's words. */
function suiteAdminFailure(error: unknown, fallback: string): string {
  switch (errorCode(error)) {
    case 'SUITE_ADMIN_LIMIT':
      return 'There are 3 suite admins already. Remove one first.';
    case 'ALREADY_SUITE_ADMIN':
      return 'This person is a suite admin already.';
    case 'HOLDS_SYSTEM_ROLES':
      return 'This account holds a system role. A suite admin needs an account with none.';
    case 'NOT_ELIGIBLE':
      return 'Only an active, unlocked account with a verified email can be a suite admin.';
    case 'LAST_SUITE_ADMIN':
      return 'The suite needs at least one suite admin. Add another one first.';
    default:
      return errorMessage(error, fallback);
  }
}

/**
 * Suite spec 0013, AC-1, AC-2, AC-23: the suite admins, who added each one and why. Adding or
 * removing one needs a reason and your password; every admin in the suite gets an email.
 */
export function SuiteAdminsView({ me }: { me: AdminMe }) {
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SuiteAdmin | null>(null);
  const { state } = useAsync(String(attempt), listSuiteAdmins);
  const full = state.kind === 'ready' && state.value.length >= MAX_SUITE_ADMINS;
  const reload = () => setAttempt((n) => n + 1);

  return (
    <>
      <ViewHeader
        title="Suite admins"
        context={`Up to ${MAX_SUITE_ADMINS} people who manage every account. They hold no system role.`}
        action={
          <Button
            size="touch"
            className="w-full sm:w-auto md:h-10"
            disabled={state.kind !== 'ready' || full}
            onClick={() => setAdding(true)}
          >
            <ShieldPlus aria-hidden="true" />
            Add suite admin
          </Button>
        }
      />
      {full && <p className="mb-4 text-sm text-muted-foreground">{MAX_SUITE_ADMINS} suite admins, the most allowed.</p>}
      {state.kind === 'loading' && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}
      {state.kind === 'error' && (
        <ViewError message={errorMessage(state.error, "We couldn't load the suite admins.")} onRetry={reload} />
      )}
      {state.kind === 'ready' && (
        <DataTable
          columns={[
            { label: 'Suite admin' },
            { label: 'Since' },
            { label: 'Added by' },
            { label: 'Reason' },
            { label: <span className="sr-only">Actions</span>, align: 'end' },
          ]}
        >
          {state.value.map((admin) => (
            <Row key={admin.id}>
              <Cell>
                <PersonCell
                  name={admin.name}
                  email={admin.email}
                  extra={admin.id === me.user.id && <span className="font-normal text-muted-foreground">(you)</span>}
                />
              </Cell>
              <Cell className="whitespace-nowrap">
                <Muted>
                  <span className="md:hidden">Since </span>
                  {formatDate(admin.grantedAt)}
                </Muted>
              </Cell>
              <Cell>
                <Muted>{admin.grantedBy ? admin.grantedBy.name : 'WeLinc setup'}</Muted>
              </Cell>
              <Cell className="max-w-sm">
                {admin.reason ? (
                  <p className="break-words text-foreground">"{admin.reason}"</p>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Cell>
              <Cell align="end">
                {admin.id !== me.user.id && (
                  <Button variant="outline" disabled={state.value.length <= 1} onClick={() => setRemoving(admin)}>
                    <UserMinus aria-hidden="true" />
                    Remove
                  </Button>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
      <AddSuiteAdminDialog open={adding} onOpenChange={setAdding} onDone={reload} />
      <RemoveSuiteAdminDialog admin={removing} onClose={() => setRemoving(null)} onDone={reload} />
    </>
  );
}

function AddSuiteAdminDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<ManagedPerson | null>(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(typed.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [typed]);

  // Only people with no role can be a suite admin (AC-1); the server checks again
  const { state: found } = useAsync(`${open}|${q}`, async () =>
    open && q.length >= 2 ? (await listPeople({ system: null, q, status: 'ACTIVE' })).items : [],
  );
  const candidates = found.kind === 'ready' ? found.value.filter((p) => p.roles.length === 0 && !p.suiteAdmin) : [];

  const reset = () => {
    setTyped('');
    setQ('');
    setPicked(null);
    setReason('');
    setPassword('');
    setReasonError('');
    setPasswordError('');
    setFormError('');
  };

  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const submit = async () => {
    const problem = reasonProblem(reason);
    setReasonError(problem ?? '');
    setFormError(picked ? '' : 'Pick the person to add.');
    setPasswordError(password ? '' : 'Type your password.');
    if (problem || !picked || !password) return;
    setBusy(true);
    let token: string;
    try {
      token = await verifyPassword(password);
    } catch (error) {
      setPasswordError(reauthFailure(error));
      setBusy(false);
      return;
    }
    try {
      await addSuiteAdmin({ userId: picked.id, reason: reason.trim(), reauthToken: token });
      notifySuccess(`${picked.name} is a suite admin. Every admin got an email.`);
      setBusy(false);
      reset();
      onOpenChange(false);
      onDone();
    } catch (error) {
      setPassword('');
      setFormError(suiteAdminFailure(error, "We couldn't add this suite admin."));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a suite admin</DialogTitle>
          <DialogDescription>
            Pick an active account with no system role. People who also do system work keep a separate account for it.
          </DialogDescription>
        </DialogHeader>
        <form
          id="add-suite-admin-form"
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="suite-admin-search">Person</Label>
            {picked ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-foreground">{picked.name}</p>
                  <p className="text-xs break-all text-muted-foreground">{picked.email}</p>
                </div>
                <Button variant="ghost" disabled={busy} onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="suite-admin-search"
                    type="search"
                    placeholder="Search by name or email"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {q.length >= 2 && found.kind === 'ready' && (
                  <ul aria-label="Matching accounts" className="divide-y divide-border rounded-lg border border-border">
                    {candidates.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        No active account without a system role matches.
                      </li>
                    )}
                    {candidates.slice(0, 8).map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(person)}
                          className={cn(
                            'flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset',
                          )}
                        >
                          <span className="text-sm font-medium break-words text-foreground">{person.name}</span>
                          <span className="text-xs break-all text-muted-foreground">{person.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <ReasonField
            id="add-suite-admin-reason"
            value={reason}
            onChange={setReason}
            disabled={busy}
            error={reasonError}
            hint="Why this person needs to manage every account"
          />
          <PasswordField
            id="add-suite-admin-password"
            value={password}
            onChange={setPassword}
            disabled={busy}
            error={passwordError}
          />
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="add-suite-admin-form" loading={busy}>
            {busy ? 'Adding' : 'Add suite admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveSuiteAdminDialog({
  admin,
  onClose,
  onDone,
}: {
  admin: SuiteAdmin | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setReason('');
    setPassword('');
    setReasonError('');
    setPasswordError('');
    setFormError('');
    onClose();
  };

  const submit = async () => {
    if (!admin) return;
    const problem = reasonProblem(reason);
    setReasonError(problem ?? '');
    setPasswordError(password ? '' : 'Type your password.');
    if (problem || !password) return;
    setBusy(true);
    let token: string;
    try {
      token = await verifyPassword(password);
    } catch (error) {
      setPasswordError(reauthFailure(error));
      setBusy(false);
      return;
    }
    try {
      await removeSuiteAdmin(admin.id, { reason: reason.trim(), reauthToken: token });
      notifySuccess(`${admin.name} is no longer a suite admin. Their temporary access ended too.`);
      setBusy(false);
      close();
      onDone();
    } catch (error) {
      setPassword('');
      setFormError(suiteAdminFailure(error, "We couldn't remove this suite admin."));
      setBusy(false);
    }
  };

  return (
    <Dialog open={admin !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remove {admin?.name} as a suite admin?</DialogTitle>
          <DialogDescription>
            Their account stays, with no role anywhere. Any temporary access they hold ends now, and every admin gets an
            email, them included.
          </DialogDescription>
        </DialogHeader>
        <form
          id="remove-suite-admin-form"
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <ReasonField
            id="remove-suite-admin-reason"
            value={reason}
            onChange={setReason}
            disabled={busy}
            error={reasonError}
            hint="Why they no longer manage every account"
          />
          <PasswordField
            id="remove-suite-admin-password"
            value={password}
            onChange={setPassword}
            disabled={busy}
            error={passwordError}
          />
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="remove-suite-admin-form" variant="destructive" loading={busy}>
            {busy ? 'Removing' : 'Remove suite admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
