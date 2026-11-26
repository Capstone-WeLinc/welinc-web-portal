import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { CODE_EXPIRED_MESSAGE, codeFailure, type EmailStep, type LauncherAnswer } from '../../lib/auth';
import { BackAction, SplitHeading, SplitNotice, Strong, splitButton } from './AuthSplit';
import { CODE_LENGTH, CodeField, ResendHint } from './CodeField';

type EmailCodeStepProps = {
  step: EmailStep;
  /** A right code signs in: the portal goes on exactly as after a password login. */
  onSignedIn: (answer: LauncherAnswer) => void;
  /** Back to the password step, with a message when the code expired. */
  onBack: (message?: string) => void;
};

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
      <BackAction onClick={() => onBack()}>Use a different account</BackAction>
      <SplitHeading title={adminStep ? "Confirm it's you" : 'Check your email'}>
        {adminStep ? 'Admin accounts confirm each sign in. ' : ''}
        We sent a 6 digit code to <Strong>{step.email}</Strong>.
      </SplitHeading>

      {error && (
        <SplitNotice tone="error">
          <p>{error}</p>
        </SplitNotice>
      )}
      {sent && !error && (
        <SplitNotice tone="success">
          <p>{sent}</p>
        </SplitNotice>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="flex flex-col gap-4.5"
      >
        <CodeField
          id="login-code"
          label="Code"
          value={code}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          disabled={verifying}
          invalid={Boolean(error)}
          inputRef={codeRef}
        />
        <Button type="submit" loading={verifying} disabled={code.length !== CODE_LENGTH} className={splitButton}>
          {verifying ? 'Verifying' : 'Verify'}
        </Button>
      </form>

      <ResendHint wait={wait} resending={resending} onResend={() => void resend()} />
    </>
  );
}
