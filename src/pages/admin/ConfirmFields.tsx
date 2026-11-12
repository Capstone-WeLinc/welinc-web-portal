import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { REASON_MAX, REASON_MIN } from './reason';

/** The reason box with its live character count (AC-24). */
export function ReasonField({
  id,
  value,
  onChange,
  disabled,
  error,
  hint,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: string;
  hint: string;
}) {
  const length = value.trim().length;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        Reason <span aria-hidden="true">*</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        maxLength={REASON_MAX}
        disabled={disabled}
        placeholder={hint}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className={cn('text-xs tabular-nums', error ? 'text-destructive' : 'text-muted-foreground')}>
        {error || `${length} of ${REASON_MAX} characters, at least ${REASON_MIN}`}
      </p>
    </div>
  );
}

/** The actor's own password, asked in the same dialog as the change (AC-24). */
export function PasswordField({
  id,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Your password</Label>
      <Input
        id={id}
        type="password"
        autoComplete="current-password"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
