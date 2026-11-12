import { useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SystemCode } from '@/lib/admin';
import type { CatalogRole } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { validatePerson, type PersonFormValues } from './personValues';

/**
 * Suite spec 0013, AC-16, AC-23: name, email and the one role a person holds in this system
 * (every catalog allows one role per person). Used by Add person and the Edit dialog. Giving the
 * admin role asks for the actor's password; that happens in `withReauth`, not here.
 */
export function PersonForm({
  id,
  system,
  roles,
  initial,
  submitting,
  serverError,
  emailHint,
  onSubmit,
  footer,
}: {
  id: string;
  system: SystemCode;
  roles: CatalogRole[];
  initial: PersonFormValues;
  submitting: boolean;
  serverError: string;
  emailHint?: string;
  onSubmit: (values: PersonFormValues) => void;
  footer: React.ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormValues, string>>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validatePerson(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit({ ...values, name: values.name.trim(), email: values.email.trim() });
  };

  const field = (key: keyof PersonFormValues) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined,
  });

  return (
    <form id={id} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>
          Name <span aria-hidden="true">*</span>
        </Label>
        <Input
          id={`${id}-name`}
          autoComplete="off"
          value={values.name}
          maxLength={100}
          disabled={submitting}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          {...field('name')}
        />
        <FieldError id={`${id}-name-error`} message={errors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-email`}>
          Email <span aria-hidden="true">*</span>
        </Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="off"
          value={values.email}
          maxLength={255}
          disabled={submitting}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          {...field('email')}
        />
        {emailHint && !errors.email && <p className="text-xs text-muted-foreground">{emailHint}</p>}
        <FieldError id={`${id}-email-error`} message={errors.email} />
      </div>

      <fieldset className="flex flex-col gap-2" {...field('role')}>
        <legend className="mb-2 text-sm font-medium text-foreground">
          {system} role <span aria-hidden="true">*</span>
        </legend>
        <div role="radiogroup" aria-label={`${system} role`} className="flex flex-col gap-2">
          {roles.map((role) => {
            const selected = values.role === role.code;
            return (
              <label
                key={role.code}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-role`}
                  value={role.code}
                  checked={selected}
                  disabled={submitting}
                  onChange={() => setValues({ ...values, role: role.code })}
                  className="sr-only"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{role.name}</span>
                  <span className={cn('text-xs', selected ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {role.description}
                    {role.isSystemAdmin && ' Giving this role asks for your password.'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <FieldError id={`${id}-role-error`} message={errors.role} />
      </fieldset>

      {serverError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {serverError}
        </p>
      )}
      {footer}
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** The submit row of the Add page. */
export function SubmitRow({ form, label, busyLabel, submitting }: { form: string; label: string; busyLabel: string; submitting: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button type="submit" form={form} size="touch" className="md:h-10" loading={submitting}>
        {submitting ? busyLabel : label}
      </Button>
    </div>
  );
}
