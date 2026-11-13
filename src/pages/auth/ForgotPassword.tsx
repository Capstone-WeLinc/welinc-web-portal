import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Truck, Eye, EyeOff } from 'lucide-react';
import { isAxiosError } from 'axios';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';
import { RATE_LIMITED_MESSAGE } from '../../lib/auth';
import { HeroCard, HeroLabel, HeroNotice, heroButton, heroCodeGroup, heroCodeSlot, heroInput } from './AuthHero';

/** A show or hide password button inside a hero input, 44px square. */
function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-xl text-white/40 transition-colors hover:text-white/70 focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
    >
      {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );
}

type Step = 'email' | 'code' | 'newPassword' | 'done';

const CODE_LENGTH = 6;
/** welinc-auth sends at most one code a minute (spec 0009); a resend inside it sends nothing. */
const RESEND_SECONDS = 60;

const tooMany = (err: unknown) => isAxiosError(err) && err.response?.status === 429;

/**
 * Forgot password: email, code, new password. welinc-auth answers the same whether or not the
 * email has an account (spec 0009, AC-13), so the screen never says which.
 */
export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    const trimmed = newPassword.trim();
    if (trimmed.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(trimmed)) {
      setError('Add at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(trimmed)) {
      setError('Add at least one lowercase letter.');
      return;
    }
    if (!/\d/.test(trimmed)) {
      setError('Add at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(trimmed)) {
      setError('Add at least one special character.');
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
        <HeroNotice tone="error">
          <p>{error}</p>
        </HeroNotice>
      )}
      {sent && !error && (
        <HeroNotice tone="success">
          <p>{sent}</p>
        </HeroNotice>
      )}
    </>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero-deep p-6">
      <div className="absolute top-0 right-0 size-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 size-96 rounded-full bg-highlight/10 blur-3xl" />

      <main className="relative z-10 w-full max-w-md">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-white/50 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>

        <HeroCard>
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-highlight shadow-lg shadow-highlight/20">
            <Truck size={22} className="text-primary" strokeWidth={2.5} aria-hidden="true" />
          </div>

          {step === 'done' ? (
            <div className="text-center" role="status">
              <CheckCircle className="mx-auto mb-4 size-12 text-hero-success" aria-hidden="true" />
              <h2 className="mb-2 text-2xl font-black text-white">Password changed</h2>
              <p className="mb-6 text-white/60">Sign in with your new password.</p>
              <Button asChild className={heroButton}>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          ) : step === 'email' ? (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Reset your password</h2>
              <p className="mb-8 text-sm text-white/50">Enter your email and we'll send you a 6 digit code.</p>
              {notices}
              <form onSubmit={handleRequestCode} className="flex flex-col gap-5">
                <div>
                  <HeroLabel htmlFor="forgot-email">Email</HeroLabel>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@welinc.com"
                      required
                      autoComplete="email"
                      className={cn(heroInput, 'pl-11')}
                    />
                  </div>
                </div>
                <Button id="forgot-submit" type="submit" loading={loading} className={heroButton}>
                  {loading ? 'Sending code' : 'Send code'}
                </Button>
              </form>
            </>
          ) : step === 'code' ? (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Check your email</h2>
              <p className="mb-6 text-sm break-words text-white/50">
                If <span className="font-semibold text-white/80">{cleanEmail}</span> has a WeLinc account, we sent
                it a 6 digit code.
              </p>
              {notices}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyCode(code);
                }}
                className="flex flex-col gap-5"
              >
                <div>
                  <HeroLabel htmlFor="forgot-code">Code</HeroLabel>
                  <InputOTP
                    ref={codeRef}
                    id="forgot-code"
                    maxLength={CODE_LENGTH}
                    pattern={REGEXP_ONLY_DIGITS}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={setCode}
                    onComplete={(value: string) => void verifyCode(value)}
                    disabled={loading}
                    aria-invalid={error ? true : undefined}
                    containerClassName="justify-center"
                  >
                    <InputOTPGroup className={heroCodeGroup}>
                      {Array.from({ length: CODE_LENGTH }, (_, i) => (
                        <InputOTPSlot key={i} index={i} className={heroCodeSlot} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  id="forgot-verify-submit"
                  type="submit"
                  loading={loading}
                  disabled={code.length !== CODE_LENGTH}
                  className={heroButton}
                >
                  {loading ? 'Verifying' : 'Verify'}
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
                  onClick={() => {
                    setStep('email');
                    setError('');
                    setSent('');
                    setCode('');
                  }}
                  className="min-h-11 cursor-pointer rounded-md text-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Set a new password</h2>
              <p className="mb-6 text-sm break-words text-white/50">
                For <span className="text-highlight">{cleanEmail}</span>.
              </p>
              {notices}
              <form onSubmit={handleReset} className="flex flex-col gap-5">
                <div>
                  <HeroLabel htmlFor="forgot-new-password">New password</HeroLabel>
                  <div className="relative">
                    <Input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      aria-describedby="forgot-password-rules"
                      className={cn(heroInput, 'pr-12')}
                    />
                    <RevealButton shown={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} />
                  </div>
                  <p id="forgot-password-rules" className="mt-1.5 text-xs leading-normal text-white/50">
                    At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special
                    character.
                  </p>
                </div>
                <div>
                  <HeroLabel htmlFor="forgot-confirm-password">Confirm password</HeroLabel>
                  <div className="relative">
                    <Input
                      id="forgot-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Type it again"
                      required
                      autoComplete="new-password"
                      className={cn(heroInput, 'pr-12')}
                    />
                    <RevealButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
                  </div>
                </div>
                <Button id="forgot-reset-submit" type="submit" loading={loading} className={heroButton}>
                  {loading ? 'Saving' : 'Set password'}
                </Button>
              </form>
            </>
          )}
        </HeroCard>
      </main>
    </div>
  );
}
