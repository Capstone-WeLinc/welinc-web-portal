import { useState } from 'react';
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
import type { SystemCode } from '@/lib/admin';
import { errorCode } from '@/lib/admin';
import { errorMessage, startGrant, verifyPassword } from '@/lib/adminApi';
import { reauthFailure } from '@/lib/adminErrors';
import { cn } from '@/lib/utils';
import { PasswordField, ReasonField } from '../ConfirmFields';
import { reasonProblem } from '../reason';
import { useSystemsCatalog } from '../useCatalogs';
import { SYSTEMS } from '../useAdminSystem';

/** AC-9: whole hours, 1 to 8, 4 picked. */
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const DEFAULT_HOURS = 4;

/** One row of pill choices, the suite's selected style (design.md). */
function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body font-medium text-foreground">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-11 rounded-lg border px-3 text-body transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:opacity-50 md:min-h-9',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Suite spec 0013, AC-9, AC-24: a suite admin gives themselves one system's role for 1 to 8
 * hours, with a reason and their password in the same dialog. That system's admins get an email.
 */
export function TemporaryAccessDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}) {
  const catalog = useSystemsCatalog();
  const [system, setSystem] = useState<SystemCode>('VRMS');
  const [role, setRole] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const roles = catalog?.find((s) => s.code === system)?.roles ?? [];

  const reset = () => {
    setRole(null);
    setHours(DEFAULT_HOURS);
    setReason('');
    setPassword('');
    setReasonError('');
    setPasswordError('');
    setFormError('');
  };

  const submit = async () => {
    const problem = reasonProblem(reason);
    setReasonError(problem ?? '');
    setFormError(role ? '' : 'Pick the role you need.');
    if (problem || !role || !password) {
      if (!password) setPasswordError('Type your password.');
      return;
    }
    setBusy(true);
    setPasswordError('');
    let token: string;
    try {
      token = await verifyPassword(password, 'TEMPORARY_ACCESS');
    } catch (error) {
      setPasswordError(reauthFailure(error));
      if (errorCode(error) === 'ACCOUNT_LOCKED') setPassword('');
      setBusy(false);
      return;
    }
    try {
      const grant = await startGrant({ system, role, hours, reason: reason.trim(), reauthToken: token });
      notifySuccess(`You have ${grant.system} ${grant.roleName} access for ${hours} ${hours === 1 ? 'hour' : 'hours'}.`);
      reset();
      onOpenChange(false);
      onStarted();
    } catch (error) {
      setPassword('');
      setFormError(
        errorCode(error) === 'GRANT_ACTIVE'
          ? `You already have temporary ${system} access. End it first.`
          : errorMessage(error, "We couldn't start temporary access."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Temporary access</DialogTitle>
          <DialogDescription>
            Give yourself a role in one system for a few hours, to look into a problem. It ends on its own, and that
            system's admins get an email right away.
          </DialogDescription>
        </DialogHeader>
        <form
          id="temporary-access-form"
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Choices
            label="System"
            value={system}
            disabled={busy}
            options={SYSTEMS.map((s) => ({ value: s, label: s }))}
            onChange={(next) => {
              setSystem(next);
              setRole(null);
            }}
          />
          <Choices
            label="Role"
            value={role}
            disabled={busy || roles.length === 0}
            options={roles.map((r) => ({ value: r.code, label: r.name }))}
            onChange={setRole}
          />
          <Choices
            label="For how long"
            value={hours}
            disabled={busy}
            options={HOURS.map((h) => ({ value: h, label: `${h} h` }))}
            onChange={setHours}
          />
          <ReasonField
            id="temporary-reason"
            value={reason}
            onChange={setReason}
            disabled={busy}
            error={reasonError}
            hint="What is broken, and what you need to check"
          />
          <PasswordField
            id="temporary-password"
            value={password}
            onChange={setPassword}
            disabled={busy}
            error={passwordError}
          />
          {formError && (
            <p role="alert" className="text-body text-destructive">
              {formError}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="temporary-access-form" loading={busy}>
            {busy ? 'Starting' : 'Start access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
