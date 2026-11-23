import { useCallback, useEffect, useRef, useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { codeAlreadyPassed, registerStepUpHost, type AdminCodeAnswer } from '@/lib/admin';
import { api } from '@/lib/api';
import { codeFailure } from '@/lib/auth';

const CODE_LENGTH = 6;

type Stage =
  | { kind: 'closed' }
  | { kind: 'sending' }
  | { kind: 'code'; challengeId: string; email: string }
  | { kind: 'failed'; message: string };

/**
 * Suite spec 0013, AC-22: "Confirm it's you". Opens whenever an admin call answers
 * `ADMIN_CODE_REQUIRED` (through `askForCode`), emails a code to the signed in admin, and
 * resolves once `POST /auth/admin/code/verify` passes. The ticket lives in this component only.
 */
export function StepUpDialog() {
  const [stage, setStage] = useState<Stage>({ kind: 'closed' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(0);
  const settle = useRef<((passed: boolean) => void) | null>(null);

  const finish = useCallback((passed: boolean) => {
    settle.current?.(passed);
    settle.current = null;
    setStage({ kind: 'closed' });
    setCode('');
    setError('');
    setVerifying(false);
  }, []);

  const send = useCallback(async () => {
    setStage({ kind: 'sending' });
    setError('');
    setCode('');
    try {
      const { data } = await api.post<AdminCodeAnswer>('/auth/admin/code', {});
      if (codeAlreadyPassed(data)) {
        finish(true);
        return;
      }
      setWait(data.resendAfter);
      setStage({ kind: 'code', challengeId: data.challengeId, email: data.email });
    } catch (err) {
      const failure = codeFailure(err);
      setStage({
        kind: 'failed',
        message: failure.kind === 'message' ? failure.message : "We couldn't send a code. Try again.",
      });
    }
  }, [finish]);

  useEffect(() => {
    registerStepUpHost(
      () =>
        new Promise<boolean>((resolve) => {
          settle.current = resolve;
          void send();
        }),
    );
    return () => registerStepUpHost(null);
  }, [send]);

  // The Resend countdown, from the last answer's resendAfter
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const verify = async (value: string) => {
    if (stage.kind !== 'code' || verifying || value.length !== CODE_LENGTH) return;
    setError('');
    setVerifying(true);
    try {
      await api.post('/auth/admin/code/verify', { challengeId: stage.challengeId, code: value });
      finish(true);
    } catch (err) {
      const failure = codeFailure(err);
      if (failure.kind === 'expired') {
        setVerifying(false);
        setError('That code expired. Send a new one.');
        setCode('');
        setWait(0);
        return;
      }
      setError(failure.message);
      if (failure.clearCode) setCode('');
      setVerifying(false);
    }
  };

  const open = stage.kind !== 'closed';
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !verifying && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldCheck aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Confirm it's you</AlertDialogTitle>
          <AlertDialogDescription>
            {stage.kind === 'code' ? (
              <>
                Admin powers need a confirmed sign in. We sent a 6 digit code to{' '}
                <span className="font-medium break-words text-foreground">{stage.email}</span>.
              </>
            ) : (
              'Admin powers need a confirmed sign in. We email you a 6 digit code.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {(error || stage.kind === 'failed') && (
          <p role="alert" className="flex items-start gap-2 text-body text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {stage.kind === 'failed' ? stage.message : error}
          </p>
        )}

        {stage.kind === 'code' && (
          <form
            id="step-up-form"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(code);
            }}
            className="flex flex-col items-center gap-2"
          >
            <Label htmlFor="step-up-code" className="self-start">
              Code
            </Label>
            <InputOTP
              id="step-up-code"
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
            >
              <InputOTPGroup>
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-base-input" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </form>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
          {stage.kind === 'code' ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={wait > 0 || verifying}
                onClick={() => void send()}
                className="tabular-nums"
              >
                {wait > 0 ? `Resend in ${wait} s` : 'Send a new code'}
              </Button>
              <Button
                type="submit"
                form="step-up-form"
                loading={verifying}
                disabled={code.length !== CODE_LENGTH}
              >
                {verifying ? 'Confirming' : 'Confirm'}
              </Button>
            </>
          ) : (
            <Button type="button" loading={stage.kind === 'sending'} onClick={() => void send()}>
              {stage.kind === 'sending' ? 'Sending code' : 'Try again'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
