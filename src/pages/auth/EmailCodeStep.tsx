import { useEffect, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { api } from '../../lib/api';
import { CODE_EXPIRED_MESSAGE, codeFailure, type EmailStep, type LauncherAnswer } from '../../lib/auth';
import { HeroLabel, HeroNotice, heroButton } from './AuthHero';

type EmailCodeStepProps = {
  step: EmailStep;
  /** A right code signs in: the portal goes on exactly as after a password login. */
  onSignedIn: (answer: LauncherAnswer) => void;
  /** Back to the password step, with a message when the code expired. */
  onBack: (message?: string) => void;
};

const CODE_LENGTH = 6;

/** Six dark boxes on the hero, each 44px or more so a thumb can hit them. */
const slotClass =
  'size-11 border-white/15 bg-white/6 text-lg font-bold text-white sm:size-12 data-[active=true]:border-highlight/60 data-[active=true]:ring-highlight/40';

/**
 * Suite spec 0009, AC-25 and AC-26: the sign in step for an unverified email. One real input
 * underneath (`input-otp`): digits only, `one-time-code` autofill, a paste of 6 digits fills every
 * box, focus moves in when the step opens, and the 6th digit submits.
 */
export default function EmailCodeStep({ step, onSignedIn, onBack }: EmailCodeStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(step.resendAfter);
  const codeRef = useRef<HTMLInputElement>(null);
  // Suite spec 0013, AC-22: the same step, worded for an admin's sign in
  const adminStep = step.status === 'SIGN_IN_CODE_REQUIRED';

  // The field is disabled while a code is checked; put focus back once it is usable again
  useEffect(() => {
    if (!verifying && error) codeRef.current?.focus();
  }, [verifying, error]);

  // The Resend countdown, from the last answer's resendAfter
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const verify = async (value: string) => {
    if (verifying || value.length !== CODE_LENGTH) return;
    setError('');
    setSent('');
    setVerifying(true);
    try {
      const { data } = await api.post<LauncherAnswer>('/auth/login/verify-email', {
        challengeId: step.challengeId,
        code: value,
      });
      onSignedIn(data);
    } catch (err) {
      const failure = codeFailure(err);
      if (failure.kind === 'expired') {
        onBack(CODE_EXPIRED_MESSAGE);
        return;
      }
      setError(failure.message);
      if (failure.clearCode) setCode('');
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resending || wait > 0) return;
    setError('');
    setSent('');
    setResending(true);
    try {
      const { data } = await api.post<{ resendAfter: number }>('/auth/login/verify-email/resend', {
        challengeId: step.challengeId,
      });
      setCode('');
      setWait(data.resendAfter);
      setSent('We sent a new code. The old one no longer works.');
    } catch (err) {
      const failure = codeFailure(err);
      if (failure.kind === 'expired') {
        onBack(CODE_EXPIRED_MESSAGE);
        return;
      }
      setError(failure.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-highlight shadow-lg shadow-highlight/20">
          <MailCheck size={22} className="text-primary" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h2 className="mb-1 text-2xl font-black text-white">
          {adminStep ? "Confirm it's you" : 'Check your email'}
        </h2>
        <p className="text-sm break-words text-white/50">
          {adminStep ? 'Admin accounts confirm each sign in. ' : ''}
          We sent a 6 digit code to <span className="font-semibold text-white/80">{step.email}</span>
        </p>
      </div>

      {error && (
        <HeroNotice tone="error">
          <p>{error}</p>
        </HeroNotice>
      )}
      {sent && !error && (
        <HeroNotice tone="success">
          <p>{sent}</p>
        </HeroNotice>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <HeroLabel htmlFor="login-code">Code</HeroLabel>
          <InputOTP
            ref={codeRef}
            id="login-code"
            maxLength={CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={setCode}
            onComplete={(value: string) => void verify(value)}
            disabled={verifying}
            aria-invalid={error ? true : undefined}
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <InputOTPSlot key={i} index={i} className={slotClass} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button type="submit" loading={verifying} disabled={code.length !== CODE_LENGTH} className={heroButton}>
          {verifying ? 'Verifying' : 'Verify'}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={wait > 0 || resending}
          className="min-h-11 cursor-pointer rounded-md font-semibold text-highlight tabular-nums hover:text-highlight-hover focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden disabled:cursor-not-allowed disabled:text-white/40"
        >
          {wait > 0 ? `Resend code in ${wait} s` : resending ? 'Sending' : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={() => onBack()}
          className="min-h-11 cursor-pointer rounded-md text-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
        >
          Use a different account
        </button>
      </div>
    </>
  );
}
