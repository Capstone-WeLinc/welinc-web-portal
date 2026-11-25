import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';
import { RATE_LIMITED_MESSAGE } from '../../lib/auth';
import { passwordChecks, passwordStrength } from '../../lib/password';
import { pageTitle, useDocumentTitle } from '../../lib/title';
import {
  AuthSplit,
  BackAction,
  SplitHeading,
  SplitHint,
  SplitLabel,
  SplitNotice,
  SplitResult,
  StepLabel,
  Strong,
  splitButton,
  splitInput,
} from './AuthSplit';
import { CODE_LENGTH, CodeField, ResendHint } from './CodeField';
import { PasswordInput } from './PasswordInput';

type Step = 'email' | 'code' | 'newPassword' | 'done';

/** welinc-auth sends at most one code a minute (spec 0009); a resend inside it sends nothing. */
const RESEND_SECONDS = 60;

const tooMany = (err: unknown) => isAxiosError(err) && err.response?.status === 429;

/**
 * Forgot password: email, code, new password. welinc-auth answers the same whether or not the
 * email has an account (spec 0009, AC-13), so the screen never says which.
 */
export default function ForgotPassword() {
  useDocumentTitle(pageTitle('Forgot password'));
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const cleanEmail = email.trim().toLowerCase();

  // The Resend countdown
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // The code field is disabled while a code is checked; put focus back once it is usable again
  useEffect(() => {
    if (step === 'code' && !loading && error) codeRef.current?.focus();
  }, [step, loading, error]);

  const sendCode = async () => {
    await api.post('/auth/forgot-password', { email: cleanEmail });
    setWait(RESEND_SECONDS);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setSent('');
    setLoading(true);
    try {
      await sendCode();
      setCode('');
      setStep('code');
    } catch (err) {
      setError(tooMany(err) ? RATE_LIMITED_MESSAGE : "We couldn't send the code. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resending || wait > 0) return;
    setError('');
    setSent('');
    setResending(true);
    try {
      await sendCode();
      setCode('');
      setSent('We sent a new code. The old one no longer works.');
    } catch (err) {
      setError(tooMany(err) ? RATE_LIMITED_MESSAGE : "We couldn't send the code. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  const verifyCode = async (value: string) => {
    if (loading || value.length !== CODE_LENGTH) return;
    setError('');
    setSent('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email: cleanEmail, otp: value });
      setStep('newPassword');
    } catch (err) {
      if (tooMany(err)) {
        setError(RATE_LIMITED_MESSAGE);
      } else if (isAxiosError(err) && err.response?.status === 400) {
        setError("That code isn't right or has expired. Check it, or send a new one.");
        setCode('');
      } else {
        setError("We couldn't check the code. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (newPassword !== confirmPassword) {
      setError('The two passwords are different.');
      return;
    }
    const unmet = passwordChecks(newPassword.trim()).find((check) => !check.met);
    if (unmet) {
      setError(unmet.fix);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: cleanEmail, otp: code, newPassword });
      setStep('done');
    } catch (err) {
      if (tooMany(err)) {
        setError(RATE_LIMITED_MESSAGE);
      } else if (isAxiosError(err) && err.response?.status === 400) {
        // The code ran out while the new password was typed: ask for a new one
        setCode('');
        setStep('code');
        setError('That code expired. Send a new one, then set your password.');
      } else {
        setError("We couldn't change your password. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const notices = (
    <>
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
    </>
  );

  const differentEmail = () => {
    setStep('email');
    setError('');
    setSent('');
    setCode('');
  };

  return (
    <AuthSplit>
      {step === 'done' ? (
        <div role="status">
          <SplitResult
            tone="success"
            icon={<Check className="size-7.5" strokeWidth={2.6} />}
            title="Password changed"
            actions={
              <Button asChild className={splitButton}>
                <Link to="/login">
                  Sign in
                  <ArrowRight className="size-4.5" aria-hidden="true" />
                </Link>
              </Button>
            }
          >
            You can sign in with your new password now. We also signed you out on your other devices.
          </SplitResult>
        </div>
      ) : step === 'email' ? (
        <>
          <BackAction to="/login">Back to sign in</BackAction>
          <StepLabel step={1} />
          <SplitHeading title="Reset your password">Enter your work email. We'll send you a 6 digit code.</SplitHeading>
          {notices}
          <form onSubmit={handleRequestCode} className="flex flex-col gap-4.5">
            <div>
              <SplitLabel htmlFor="forgot-email">Work email</SplitLabel>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@welinc.com"
                required
                autoComplete="email"
                className={splitInput}
              />
            </div>
            <Button id="forgot-submit" type="submit" loading={loading} className={splitButton}>
              {loading ? (
                'Sending code'
              ) : (
                <>
                  Send code
                  <ArrowRight className="size-4.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
          <SplitHint>
            <p>Still nothing after a few minutes? Check your spam folder, or ask your admin for help.</p>
          </SplitHint>
        </>
      ) : step === 'code' ? (
        <>
          <BackAction onClick={differentEmail}>Use a different email</BackAction>
          <StepLabel step={2} />
          {/* Spec 0009, AC-13: the same words whether or not the email has an account */}
          <SplitHeading title="Check your email">
            If <Strong>{cleanEmail}</Strong> has a WeLinc account, we sent it a 6 digit code. It works for 10 minutes.
          </SplitHeading>
          {notices}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode(code);
            }}
            className="flex flex-col gap-4.5"
          >
            <CodeField
              id="forgot-code"
              label="Reset code"
              value={code}
              onChange={setCode}
              onComplete={(value) => void verifyCode(value)}
              disabled={loading}
              invalid={Boolean(error)}
              inputRef={codeRef}
            />
            <Button
              id="forgot-verify-submit"
              type="submit"
              loading={loading}
              disabled={code.length !== CODE_LENGTH}
              className={splitButton}
            >
              {loading ? (
                'Checking'
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
          <ResendHint wait={wait} resending={resending} onResend={() => void resend()} />
        </>
      ) : (
        <>
          <StepLabel step={3} />
          <SplitHeading title="Set a new password">
            For <Strong>{cleanEmail}</Strong>. Use one you don't use anywhere else.
          </SplitHeading>
          {notices}
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div>
              <SplitLabel htmlFor="forgot-new-password">New password</SplitLabel>
              <PasswordInput
                id="forgot-new-password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                describedBy="forgot-password-rules"
              />
            </div>
            <PasswordRules id="forgot-password-rules" password={newPassword.trim()} />
            <div>
              <SplitLabel htmlFor="forgot-confirm-password">Confirm new password</SplitLabel>
              <PasswordInput
                id="forgot-confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                describedBy="forgot-password-match"
              />
              <MatchLine id="forgot-password-match" password={newPassword} confirm={confirmPassword} />
            </div>
            <Button id="forgot-reset-submit" type="submit" loading={loading} className={splitButton}>
              {loading ? 'Saving' : 'Save password'}
            </Button>
          </form>
        </>
      )}
    </AuthSplit>
  );
}

/** Board `R32Forgot3`: the strength, a four part meter, and welinc-auth's four rules ticked as they are met. */
function PasswordRules({ id, password }: { id: string; password: string }) {
  const checks = passwordChecks(password);
  const strength = passwordStrength(password);
  const met = checks.filter((check) => check.met).length;
  return (
    <div id={id} className="flex flex-col gap-3 rounded-xl bg-table-head px-4 py-3.5 inset-ring inset-ring-divider">
      <p className="flex items-center justify-between text-small font-semibold text-foreground">
        Password strength
        <span className={met === checks.length ? 'text-success' : 'text-muted-strong'}>{strength}</span>
      </p>
      <span aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {checks.map((check, i) => (
          <span
            key={check.label}
            className={cn('h-1.5 rounded-full', i < met ? (met === checks.length ? 'bg-success' : 'bg-primary') : 'bg-border')}
          />
        ))}
      </span>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-small text-muted-strong">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4.5 shrink-0 items-center justify-center rounded-full',
                check.met ? 'bg-success-bg text-success' : 'bg-muted text-muted-foreground',
              )}
            >
              {check.met ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1 rounded-full bg-current" />}
            </span>
            {check.label}
            <span className="sr-only">{check.met ? ', done' : ', not yet'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Passwords match" under the confirm field once both are typed, or that they differ. */
function MatchLine({ id, password, confirm }: { id: string; password: string; confirm: string }) {
  if (!confirm) return <span id={id} />;
  const same = password === confirm;
  return (
    <p id={id} className={cn('mt-1.5 flex items-center gap-1.5 text-small font-semibold', same ? 'text-success' : 'text-muted-strong')}>
      {same && <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />}
      {same ? 'Passwords match' : "Passwords don't match yet"}
    </p>
  );
}
