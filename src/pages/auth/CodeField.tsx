import type { Ref } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SplitHint, SplitLabel, splitCodeSlot } from './AuthSplit';

export const CODE_LENGTH = 6;

/**
 * The 6 digit code on the split (board `R32Forgot2`). One real input underneath (`input-otp`):
 * digits only, `one-time-code` autofill, a pasted code fills every box, the 6th digit submits.
 */
export function CodeField({
  id,
  label,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
  inputRef: Ref<HTMLInputElement>;
}) {
  return (
    <div>
      <SplitLabel htmlFor={id}>{label}</SplitLabel>
      <InputOTP
        ref={inputRef}
        id={id}
        maxLength={CODE_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
        aria-invalid={invalid || undefined}
      >
        <InputOTPGroup className="gap-2">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <InputOTPSlot key={i} index={i} className={splitCodeSlot} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

/** "0:42" for the resend wait. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Under the code: the wait before a new code can be sent, then the button that sends it. */
export function ResendHint({ wait, resending, onResend }: { wait: number; resending: boolean; onResend: () => void }) {
  return (
    <SplitHint>
      {wait > 0 ? (
        <p>
          Didn't get it? You can send a new code in <b className="font-semibold text-foreground tabular-nums">{clock(wait)}</b>.
        </p>
      ) : (
        <p>
          Didn't get it?{' '}
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="min-h-11 cursor-pointer rounded-md font-semibold text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {resending ? 'Sending a new code' : 'Send a new code'}
          </button>
        </p>
      )}
    </SplitHint>
  );
}
