import { useEffect, useState } from 'react';
import { Check, Mail, UserRound, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InitialsTile } from '@/components/ui/initials-tile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SteeringWheel } from '@/components/ui/steering-wheel';
import { errorCode, errorStatus, type AdminMe, type SystemCode } from '@/lib/admin';
import {
  checkEmail,
  createPerson,
  errorMessage,
  listPeople,
  ReauthCancelled,
  type CatalogSystem,
  type EmailCheck,
} from '@/lib/adminApi';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { SYSTEM_ICONS } from '../../launcher/systemIcons';
import { viewerSystems } from './peopleRules';

/** A person the dialog gives access to (Give access on their page). */
export type AddWho = { kind: 'existing'; id: string; name: string; email: string; systems: SystemCode[] };

/** The dialog's start: Add user (maybe with a system), or Give access for a known person. */
export type AddStart = { who?: AddWho; system?: SystemCode } | null;

/** The email check waits this long after typing stops (AC-22). */
const CHECK_DELAY_MS = 400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_MAX = 100;
const SYSTEM_SUBS: Record<SystemCode, string> = { VRMS: 'Vehicle repair', VMMS: 'Maintenance', BMS: 'Bookings' };

/**
 * Suite spec 0019, AC-22 (board `AddUser15`): Add a user on one screen. Email first, its own icon
 * is the check (`GET /auth/admin/users/email-check`): a red ! while it isn't an email, the wheel
 * while checking, a navy tick when free, a person icon and a card when it has an account, which
 * turns the dialog into Give access. One Full name, an optional contact number, system cards when
 * the viewer admins more than one system, role cards with a one line meaning, one system per add.
 */
export function AddPersonDialog({
  start,
  me,
  catalog,
  onClose,
  onAdded,
}: {
  start: AddStart;
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  onClose: () => void;
  /** The person was added or given access: open them. */
  onAdded: (id: string) => void;
}) {
  return (
    <Dialog open={start !== null} onOpenChange={(open) => !open && onClose()}>
      {start && <AddUserForm key={start.who?.id ?? 'new'} start={start} me={me} catalog={catalog} onClose={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

type Check = { key: string; result: EmailCheck | null };
type Errors = { email?: string; name?: string; contact?: string; role?: string };

function AddUserForm({
  start,
  me,
  catalog,
  onClose,
  onAdded,
}: {
  start: NonNullable<AddStart>;
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const systems = viewerSystems(me);
  const [email, setEmail] = useState(start.who?.email ?? '');
  const [settledEmail, setSettledEmail] = useState(email.trim().toLowerCase());
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [system, setSystem] = useState<SystemCode>(
    start.system ?? systems.find((s) => !(start.who?.systems ?? []).includes(s)) ?? systems[0],
  );
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [sending, setSending] = useState(false);

  const typed = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(typed);
  const checkKey = `${settledEmail}|${system}`;
  const result = check?.key === checkKey ? check.result : null;
  const checking = valid && typed === settledEmail && check?.key !== checkKey;
  const typing = typed !== settledEmail;
  const status = typing ? null : result?.status ?? null;
  const giving = status === 'existing';
  const blocked = status === 'in-system' || status === 'suite-admin' || status === 'inactive';
  const known = giving || blocked;
  const takenSystems = known ? (result?.systems ?? []) : [];
  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];
  const roleLabel = roles.find((r) => r.code === role)?.name;
  const personName = known ? (result?.name ?? 'This person') : name.trim();

  // Typing settles 400 ms after the last key
  useEffect(() => {
    if (typed === settledEmail) return;
    const timer = window.setTimeout(() => setSettledEmail(typed), CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [typed, settledEmail]);

  // Only a settled email that passes the format check is asked about; an older check is cancelled
  useEffect(() => {
    if (!EMAIL_RE.test(settledEmail)) return;
    const controller = new AbortController();
    const key = `${settledEmail}|${system}`;
    checkEmail(settledEmail, system, controller.signal)
      .then((answer) => setCheck({ key, result: answer }))
      // A failed check shows no icon; the server still refuses a duplicate on send
      .catch(() => !controller.signal.aborted && setCheck({ key, result: null }));
    return () => controller.abort();
  }, [settledEmail, system]);

  const validate = (): Errors => {
    const found: Errors = {};
    if (!valid) found.email = 'Enter the whole email, like name@example.com.';
    if (!known && !name.trim()) found.name = 'Enter their full name.';
    if (!known && contact.trim().length > CONTACT_MAX) found.contact = `Keep it to ${CONTACT_MAX} characters.`;
    if (!role) found.role = 'Pick a role.';
    return found;
  };

  const send = async () => {
    const found = validate();
    setErrors(found);
    setSettledEmail(typed);
    if (Object.keys(found).length > 0 || blocked) return;
    setSending(true);
    setProblem('');
    try {
      const person = await createPerson({
        system,
        name: giving ? (result?.name ?? typed) : name.trim(),
        email: typed,
        roleAssignments: [{ role, system }],
        ...(giving ? { attachExisting: true } : contact.trim() ? { contact: contact.trim() } : {}),
      });
      notifySuccess(
        giving
          ? `${person.name} now has ${roleLabel ?? role} in ${system}.`
          : person.setupEmailSent === false
            ? `${person.name} was added, but the setup email didn't go out. Send a setup code from their page.`
            : `${person.name} was added. They got an email to set their password.`,
      );
      onAdded(person.id);
    } catch (error) {
      if (error instanceof ReauthCancelled) return;
      if (errorCode(error) === 'ACCOUNT_EXISTS') {
        // Someone made the account since the check: give that account access instead
        const data = (error as { response?: { data?: { name?: string; systems?: SystemCode[] } } }).response?.data;
        setCheck({ key: checkKey, result: { status: 'existing', name: data?.name ?? typed, systems: data?.systems ?? [] } });
        setProblem('This email already has a WeLinc account. Send again to give that account access.');
        return;
      }
      if (errorStatus(error) === 409 && !errorCode(error)) {
        setCheck({ key: checkKey, result: { status: 'in-system', name: result?.name ?? typed, systems: [system] } });
        return;
      }
      setProblem(errorMessage(error, "We couldn't add this person. Try again."));
    } finally {
      setSending(false);
    }
  };

  const openExisting = async () => {
    const id = await findInSystem(typed, system);
    if (id) onAdded(id);
    else setProblem("We couldn't open this person. Search for them in the list.");
  };

  return (
    <DialogContent className="gap-0 p-0 sm:max-w-160">
      <DialogHeader className="flex-row items-start gap-3.5 px-6 pt-5.5 pb-4.5 text-left">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-primary">
          <UserRoundPlus className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle>{giving ? 'Give access' : 'Add a user'}</DialogTitle>
          <DialogDescription>
            {giving ? 'This email already has a WeLinc account.' : 'They get an email to set their password.'}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form
        id="add-user"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex flex-col gap-4.5 px-6 pt-1 pb-5.5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-email">Email</Label>
          <div className="relative">
            <Input
              id="add-email"
              type="email"
              value={email}
              autoComplete="off"
              readOnly={Boolean(start.who)}
              aria-invalid={errors.email || (!typing && typed && !valid) ? true : undefined}
              aria-describedby="add-email-state"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((x) => ({ ...x, email: undefined }));
                setProblem('');
              }}
              className="pr-10"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              <EmailIcon state={typing || !typed ? 'none' : !valid ? 'invalid' : checking ? 'checking' : status} />
            </span>
          </div>
          <p id="add-email-state" className="text-small text-error" aria-live="polite">
            {errors.email ?? (!typing && typed && !valid ? 'Enter the whole email, like name@example.com.' : '')}
          </p>
          {known && result && (
            <KnownCard result={result} system={system} onOpen={status === 'in-system' ? () => void openExisting() : undefined} />
          )}
        </div>

        {!known && (
          <div className="grid gap-3.5 sm:grid-cols-5">
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor="add-name">Full name</Label>
              <Input
                id="add-name"
                value={name}
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'add-name-error add-name-hint' : 'add-name-hint'}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name ? (
                <p id="add-name-error" className="text-small text-error">
                  {errors.name}
                </p>
              ) : (
                <p id="add-name-hint" className="text-caption font-normal text-muted-foreground">
                  As it appears on their ID, in one field.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="add-contact">
                Contact number <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <Input
                id="add-contact"
                type="tel"
                value={contact}
                autoComplete="off"
                placeholder="+63 917 555 0142"
                aria-invalid={errors.contact ? true : undefined}
                aria-describedby={errors.contact ? 'add-contact-error' : undefined}
                onChange={(e) => setContact(e.target.value)}
              />
              {errors.contact && (
                <p id="add-contact-error" className="text-small text-error">
                  {errors.contact}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="h-px bg-divider" />

        {systems.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label text-muted-strong">System</legend>
            <div role="radiogroup" aria-label="System" className="grid gap-2 sm:grid-cols-3">
              {systems.map((code) => {
                const taken = takenSystems.includes(code) && code !== system;
                const on = code === system;
                const Icon = SYSTEM_ICONS[code];
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={taken}
                    onClick={() => {
                      setSystem(code);
                      setRole('');
                    }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45',
                      on ? 'border-primary bg-info-bg ring-1 ring-primary' : 'border-input bg-card hover:border-muted-foreground',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-8.5 shrink-0 items-center justify-center rounded-lg',
                        on ? 'bg-primary text-highlight' : 'bg-info-bg text-primary',
                      )}
                    >
                      {Icon && <Icon className="size-4.25" />}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body font-semibold text-foreground">{code}</span>
                      <span className="text-caption font-normal text-muted-foreground">
                        {taken ? 'Already has it' : SYSTEM_SUBS[code]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2" aria-describedby={errors.role ? 'add-role-error' : undefined}>
          <legend className="mb-2 text-label text-muted-strong">{systems.length > 1 ? 'Role' : `Role in ${system}`}</legend>
          <div role="radiogroup" aria-label="Role" className="grid gap-2 sm:grid-cols-2">
            {roles.map((r) => {
              const on = r.code === role;
              return (
                <button
                  key={r.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setRole(r.code);
                    setErrors((x) => ({ ...x, role: undefined }));
                  }}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'border-primary bg-info-bg ring-1 ring-primary' : 'border-input bg-card hover:border-muted-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 size-4 shrink-0 rounded-full bg-card',
                      on ? 'border-5 border-primary' : 'border-2 border-input',
                    )}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body font-semibold text-foreground">{r.name}</span>
                    {r.description && <span className="text-caption font-normal text-muted-foreground">{r.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.role && (
            <p id="add-role-error" className="text-small text-error">
              {errors.role}
            </p>
          )}
        </fieldset>
      </form>

      <div className="mx-6 flex items-start gap-2.5 rounded-xl bg-background px-3.5 py-3">
        {giving ? (
          <Check aria-hidden="true" className="mt-0.5 size-4.25 shrink-0 text-primary" />
        ) : (
          <Mail aria-hidden="true" className="mt-0.5 size-4.25 shrink-0 text-primary" />
        )}
        <p className="text-small text-muted-strong" aria-live="polite">
          {summary({ giving, blocked, name: personName, role: roleLabel, system })}
        </p>
      </div>
      {problem && (
        <p role="alert" className="mx-6 mt-3 text-body text-error">
          {problem}
        </p>
      )}

      <DialogFooter className="px-6 pt-4 pb-5">
        <Button variant="ghost" disabled={sending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="add-user" loading={sending} disabled={blocked || checking}>
          {giving ? 'Give access' : 'Add and send invite'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** The grey box: one sentence on what happens next (board `AddUser15`). */
function summary({
  giving,
  blocked,
  name,
  role,
  system,
}: {
  giving: boolean;
  blocked: boolean;
  name: string;
  role: string | undefined;
  system: SystemCode;
}): string {
  if (blocked) return 'This email can’t be added here. Check the address, or pick another system.';
  if (!role) return giving ? `Pick their role in ${system}.` : `Pick a role in ${system}. We email them a code to set a password.`;
  const who = name || 'They';
  if (giving) return `${who} gets ${role} in ${system} straight away and signs in with their current password.`;
  return `${who} gets ${role} in ${system}. We email them a code to set a password; it works for one hour, and they show as Pending until then.`;
}

type IconState = 'none' | 'invalid' | 'checking' | EmailCheck['status'] | null;

/** The field's own icon is the whole check (AC-22). */
function EmailIcon({ state }: { state: IconState }) {
  if (state === 'invalid') {
    return (
      <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-error-bg text-small font-bold text-error">
        !
      </span>
    );
  }
  if (state === 'checking') {
    return (
      <span role="status" aria-label="Checking the email" className="flex">
        <SteeringWheel className="text-primary" />
      </span>
    );
  }
  if (state === 'free') {
    return (
      <span role="img" aria-label="Email is free" className="flex size-5 items-center justify-center rounded-full bg-info-bg text-primary">
        <Check aria-hidden="true" className="size-3" strokeWidth={3.2} />
      </span>
    );
  }
  if (state === 'existing' || state === 'in-system' || state === 'suite-admin' || state === 'inactive') {
    return (
      <span role="img" aria-label="Has an account" className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <UserRound aria-hidden="true" className="size-3" strokeWidth={2.6} />
      </span>
    );
  }
  return null;
}

/** The card under the email when it has an account. */
function KnownCard({ result, system, onOpen }: { result: EmailCheck; system: SystemCode; onOpen?: () => void }) {
  const name = result.name ?? 'This person';
  const others = (result.systems ?? []).filter((s) => s !== system);
  const line =
    result.status === 'existing'
      ? others.length > 0
        ? `In ${others.join(', ')}. Pick their ${system} role below to give them more access.`
        : `Pick their ${system} role below.`
      : result.status === 'in-system'
        ? `Already in ${system}. Pick another system, or open them to change their role.`
        : result.status === 'suite-admin'
          ? 'This is a suite admin. Suite admins can’t take a system role.'
          : 'This account is turned off or deleted, so it can’t be added here.';
  const title =
    result.status === 'existing' || result.status === 'in-system'
      ? `${name} already has an account`
      : result.status === 'suite-admin'
        ? 'A suite admin'
        : 'Account not active';
  return (
    <div className="mt-1 flex items-center gap-3 rounded-xl bg-info-bg px-3.5 py-3">
      {result.name ? <InitialsTile name={result.name} className="size-9 bg-card text-small ring-1 ring-border" /> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold text-foreground">{title}</span>
        <span className="text-caption font-normal text-muted-strong">{line}</span>
      </span>
      {onOpen && (
        <Button type="button" variant="link" size="sm" onClick={onOpen}>
          Open user
        </Button>
      )}
    </div>
  );
}

/** The email is already in this system: find them so Open user works. */
async function findInSystem(email: string, system: SystemCode): Promise<string | null> {
  try {
    const page = await listPeople({ system, q: email, limit: 5 });
    return page.items.find((p) => p.email.toLowerCase() === email.toLowerCase())?.id ?? null;
  } catch {
    return null;
  }
}
