import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorCode, errorStatus, type AdminMe, type SystemCode } from '@/lib/admin';
import {
  createPerson,
  errorMessage,
  listPeople,
  lookupPeople,
  ReauthCancelled,
  type CatalogSystem,
  type LookupPerson,
} from '@/lib/adminApi';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { SystemChip } from './peopleParts';
import { viewerSystems } from './peopleRules';

/** Who the dialog adds: a new account, or one that exists (with the systems it is already in). */
export type AddWho =
  | { kind: 'new'; name: string; email: string }
  | { kind: 'existing'; id: string; name: string; email: string; systems: SystemCode[] };

/** The dialog's start: Add person (step 1), or Give access on a person (step 2, person and system set). */
export type AddStart = { who?: AddWho & { kind: 'existing' }; system?: SystemCode } | null;

const STEPS = ['Who', 'Access', 'Check and send'] as const;
const LOOKUP_DELAY_MS = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Suite spec 0017, AC-14 (board `AddPerson6`, dialog AA): "Add a person" in three steps. Step 1
 * finds an existing account (`GET /auth/admin/users/lookup`) or takes a new name and email,
 * step 2 picks one of the viewer's systems and a role, step 3 reads it back and sends
 * `POST /auth/admin/users` (with `attachExisting` for an existing account). No end date step.
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
      {start && <AddPersonSteps key={start.who?.id ?? 'new'} start={start} me={me} catalog={catalog} onClose={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

function AddPersonSteps({
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
  const [step, setStep] = useState<1 | 2 | 3>(start.who ? 2 : 1);
  const [who, setWho] = useState<AddWho>(start.who ?? { kind: 'new', name: '', email: '' });
  const [system, setSystem] = useState<SystemCode | null>(
    start.system ?? systems.find((s) => !(start.who?.systems ?? []).includes(s)) ?? null,
  );
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; system?: string; role?: string }>({});
  const [problem, setProblem] = useState('');
  const [already, setAlready] = useState<{ id: string | null; system: SystemCode } | null>(null);
  const [sending, setSending] = useState(false);
  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];
  const roleLabel = roles.find((r) => r.code === role)?.name ?? role;
  const giveOnly = Boolean(start.who);

  const next = () => {
    if (step === 1) {
      if (who.kind === 'new') {
        const found: typeof errors = {};
        if (!who.name.trim()) found.name = 'Enter their full name.';
        if (!EMAIL_RE.test(who.email.trim())) found.email = 'Enter an email like name@example.com.';
        setErrors(found);
        if (Object.keys(found).length > 0) return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const found: typeof errors = {};
      if (!system) found.system = 'Pick a system.';
      else if (!role) found.role = 'Pick a role.';
      setErrors(found);
      if (Object.keys(found).length === 0) setStep(3);
    }
  };

  const send = async () => {
    if (!system || !role) return;
    setSending(true);
    setProblem('');
    setAlready(null);
    const name = who.name.trim();
    const email = who.email.trim();
    try {
      const person = await createPerson({
        system,
        name,
        email,
        roleAssignments: [{ role, system }],
        ...(who.kind === 'existing' ? { attachExisting: true } : {}),
      });
      notifySuccess(
        who.kind === 'existing'
          ? `${person.name} now has ${roleLabel} in ${system}.`
          : person.setupEmailSent === false
            ? `${person.name} was added, but the setup email didn't go out. Send a setup code from their page.`
            : `${person.name} was added. They got an email to set their password.`,
      );
      onAdded(person.id);
    } catch (error) {
      if (error instanceof ReauthCancelled) return;
      if (errorCode(error) === 'ACCOUNT_EXISTS') {
        // The email has an account outside this system: give that account access instead
        const data = (error as { response?: { data?: { id?: string; name?: string; systems?: SystemCode[] } } }).response?.data;
        if (data?.id) {
          setWho({ kind: 'existing', id: data.id, name: data.name ?? name, email, systems: data.systems ?? [] });
          setProblem(`${email} already has a WeLinc account${data.name ? ` (${data.name})` : ''}. Send again to give that account access.`);
          return;
        }
      }
      if (errorStatus(error) === 409 && !errorCode(error)) {
        setAlready({ id: await findInSystem(email, system), system });
        return;
      }
      setProblem(errorMessage(error, "We couldn't add this person. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Add a person</DialogTitle>
        <DialogDescription className="sr-only">Who they are, where they sign in, then check and send.</DialogDescription>
      </DialogHeader>
      <ol className="grid grid-cols-3 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i + 1 === step ? 'step' : undefined} className="flex flex-col gap-1.5">
            <span className={cn('h-1 rounded-full', i < step ? 'bg-primary' : 'bg-border')} />
            <span
              className={cn(
                'text-caption',
                i < step ? 'text-foreground' : 'text-muted-foreground',
                i + 1 === step ? 'font-semibold' : 'font-medium',
              )}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 1 && <WhoStep who={who} errors={errors} system={system ?? systems[0]} onChange={setWho} />}
      {step === 2 && (
        <AccessStep
          systems={systems}
          blocked={who.kind === 'existing' ? who.systems : []}
          system={system}
          role={role}
          catalog={catalog}
          errors={errors}
          onSystem={(next) => {
            setSystem(next);
            setRole('');
          }}
          onRole={setRole}
        />
      )}
      {step === 3 && system && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-divider bg-background p-4">
            <UserRound className="mt-0.5 size-5 shrink-0 text-muted-strong" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body font-semibold text-foreground">
                {who.name.trim()} gets {roleLabel} in {system}.
              </p>
              <p className="text-small break-all text-muted-foreground">{who.email.trim()}</p>
            </div>
          </div>
          <p className="text-small text-muted-foreground">
            {who.kind === 'existing'
              ? 'Their name and password stay as they are.'
              : 'We email them a setup code so they set their own password.'}
          </p>
          {already && (
            <p role="alert" className="flex flex-wrap items-center gap-2 text-body text-foreground">
              Already in {already.system}.
              {already.id && (
                <Button variant="link" size="sm" className="px-0" onClick={() => onAdded(already.id!)}>
                  Open person
                </Button>
              )}
            </p>
          )}
          {problem && (
            <p role="alert" className="text-body text-destructive">
              {problem}
            </p>
          )}
        </div>
      )}

      <DialogFooter className="sm:justify-between">
        <Button
          variant="ghost"
          className={cn(step === 1 || (giveOnly && step === 2) ? 'invisible' : undefined)}
          disabled={sending}
          onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
        >
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={sending} onClick={onClose}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button loading={sending} onClick={() => void send()}>
              {who.kind === 'existing' ? 'Give access' : 'Send invite'}
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

/** A 409 with no code: the email is already in this system; find them so "Open person" works. */
async function findInSystem(email: string, system: SystemCode): Promise<string | null> {
  try {
    const page = await listPeople({ system, q: email, limit: 5 });
    return page.items.find((p) => p.email.toLowerCase() === email.toLowerCase())?.id ?? null;
  } catch {
    return null;
  }
}

function WhoStep({
  who,
  errors,
  system,
  onChange,
}: {
  who: AddWho;
  errors: { name?: string; email?: string };
  system: SystemCode | undefined;
  onChange: (who: AddWho) => void;
}) {
  const [matches, setMatches] = useState<LookupPerson[]>([]);
  const query = who.kind === 'new' ? (who.email.trim() || who.name.trim()) : '';

  // Existing accounts outside the system, as you type (30 a minute per admin, server side)
  useEffect(() => {
    if (!system || query.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      lookupPeople(system, query)
        .then((found) => !cancelled && setMatches(found.slice(0, 4)))
        .catch(() => !cancelled && setMatches([]));
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, system]);

  if (who.kind === 'existing') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-divider bg-background p-4">
        <div className="min-w-0">
          <p className="text-body font-semibold text-foreground">{who.name}</p>
          <p className="text-small break-all text-muted-foreground">{who.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange({ kind: 'new', name: '', email: '' })}>
          Someone else
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="add-name">Full name</Label>
        <Input
          id="add-name"
          value={who.name}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'add-name-error' : undefined}
          onChange={(e) => onChange({ ...who, name: e.target.value })}
        />
        {errors.name && (
          <p id="add-name-error" className="text-small text-destructive">
            {errors.name}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="add-email">Work email</Label>
        <Input
          id="add-email"
          type="email"
          value={who.email}
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'add-email-error add-email-hint' : 'add-email-hint'}
          onChange={(e) => onChange({ ...who, email: e.target.value })}
        />
        <p id="add-email-hint" className="text-small text-muted-foreground">
          Their sign in name. We check it isn't taken.
        </p>
        {errors.email && (
          <p id="add-email-error" className="text-small text-destructive">
            {errors.email}
          </p>
        )}
      </div>
      {query.length >= 3 && matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-label text-muted-strong">Already has a WeLinc account</p>
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onChange({ kind: 'existing', id: m.id, name: m.name, email: m.email, systems: m.systems })}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-foreground">{m.name}</span>
                    <span className="block truncate text-caption font-normal text-muted-foreground">{m.email}</span>
                  </span>
                  <span className="flex gap-1">
                    {m.systems.map((s) => (
                      <SystemChip key={s} system={s} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AccessStep({
  systems,
  blocked,
  system,
  role,
  catalog,
  errors,
  onSystem,
  onRole,
}: {
  systems: SystemCode[];
  /** Systems the existing account is already in. */
  blocked: SystemCode[];
  system: SystemCode | null;
  role: string;
  catalog: CatalogSystem[] | null;
  errors: { system?: string; role?: string };
  onSystem: (system: SystemCode) => void;
  onRole: (role: string) => void;
}) {
  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2" aria-describedby={errors.system ? 'add-system-error' : undefined}>
        <legend className="mb-2 text-body font-semibold text-foreground">Where can they sign in?</legend>
        {systems.map((code) => {
          const inIt = blocked.includes(code);
          return (
            <label
              key={code}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-info-bg has-focus-visible:ring-2 has-focus-visible:ring-ring',
                inIt ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name="add-system"
                value={code}
                checked={system === code}
                disabled={inIt}
                onChange={() => onSystem(code)}
                className="size-4 accent-primary outline-none"
              />
              <SystemChip system={code} className="w-12" />
              <span className="flex-1 text-body text-foreground">{catalog?.find((s) => s.code === code)?.name ?? code}</span>
              {inIt && <span className="text-caption font-normal text-muted-foreground">Already in {code}</span>}
            </label>
          );
        })}
        {errors.system && (
          <p id="add-system-error" className="text-small text-destructive">
            {errors.system}
          </p>
        )}
      </fieldset>
      {system && (
        <fieldset className="flex flex-col gap-2" aria-describedby={errors.role ? 'add-role-error' : undefined}>
          <legend className="mb-2 text-body font-semibold text-foreground">Role in {system}</legend>
          {roles.map((r) => (
            <label
              key={r.code}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-info-bg has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="add-role"
                value={r.code}
                checked={role === r.code}
                onChange={() => onRole(r.code)}
                className="mt-0.5 size-4 accent-primary outline-none"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold text-foreground">{r.name}</span>
                {r.description && <span className="text-caption font-normal text-muted-foreground">{r.description}</span>}
              </span>
            </label>
          ))}
          {errors.role && (
            <p id="add-role-error" className="text-small text-destructive">
              {errors.role}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
