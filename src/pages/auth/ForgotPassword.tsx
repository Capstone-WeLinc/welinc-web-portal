import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Truck, Eye, EyeOff } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';
import { HeroCard, HeroLabel, HeroNotice, heroButton, heroInput } from './AuthHero';

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

type Step = 'email' | 'otp' | 'newPassword' | 'done';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setStep('otp');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setError('No account found with that email address.');
      } else {
        setError('Unable to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      setStep('newPassword');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        setError('Invalid or expired OTP. Please check the code and try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const trimmed = newPassword.trim();
    if (trimmed.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(trimmed)) {
      setError('Password must include at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(trimmed)) {
      setError('Password must include at least one lowercase letter.');
      return;
    }
    if (!/\d/.test(trimmed)) {
      setError('Password must include at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(trimmed)) {
      setError('Password must include at least one special character.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      setStep('done');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        setError('Invalid or expired OTP. Please request a new one.');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const errorNotice = error ? (
    <HeroNotice tone="error">
      <p>{error}</p>
    </HeroNotice>
  ) : null;

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
            Back to Sign In
          </Link>
        </div>

        <HeroCard>
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-highlight shadow-lg shadow-highlight/20">
            <Truck size={22} className="text-primary" strokeWidth={2.5} aria-hidden="true" />
          </div>

          {step === 'done' ? (
            <div className="text-center" role="status">
              <CheckCircle className="mx-auto mb-4 size-12 text-hero-success" aria-hidden="true" />
              <h2 className="mb-2 text-2xl font-black text-white">Password Reset!</h2>
              <p className="mb-6 text-white/60">Your password has been successfully updated.</p>
              <Button asChild className={heroButton}>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          ) : step === 'email' ? (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Forgot Password</h2>
              <p className="mb-8 text-sm text-white/50">Enter your email and we'll send you a reset code.</p>
              {errorNotice}
              <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
                <div>
                  <HeroLabel htmlFor="forgot-email">Email Address</HeroLabel>
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
                  {loading ? 'Sending code' : 'Send Reset Code'}
                </Button>
              </form>
            </>
          ) : step === 'otp' ? (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Enter Reset Code</h2>
              <p className="mb-2 text-sm text-white/50">
                A 6-digit code was sent to <span className="text-highlight">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError('');
                  setOtp('');
                }}
                className="mb-6 min-h-11 rounded-md text-xs text-white/50 transition-colors hover:text-white/70 focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
              >
                Wrong email? Go back
              </button>
              {errorNotice}
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
                <div>
                  <HeroLabel htmlFor="forgot-otp">OTP Code</HeroLabel>
                  <Input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className={cn(heroInput, 'text-center tracking-widest')}
                  />
                </div>
                <Button id="forgot-verify-submit" type="submit" loading={loading} className={heroButton}>
                  {loading ? 'Verifying' : 'Verify Code'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-2xl font-black text-white">Set New Password</h2>
              <p className="mb-6 text-sm text-white/50">
                Choose a new secure password for <span className="text-highlight">{email}</span>.
              </p>
              {errorNotice}
              <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-5">
                <div>
                  <HeroLabel htmlFor="forgot-new-password">New Password</HeroLabel>
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
                    Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.
                  </p>
                </div>
                <div>
                  <HeroLabel htmlFor="forgot-confirm-password">Confirm Password</HeroLabel>
                  <div className="relative">
                    <Input
                      id="forgot-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      autoComplete="new-password"
                      className={cn(heroInput, 'pr-12')}
                    />
                    <RevealButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
                  </div>
                </div>
                <Button id="forgot-reset-submit" type="submit" loading={loading} className={heroButton}>
                  {loading ? 'Resetting' : 'Reset Password'}
                </Button>
              </form>
            </>
          )}
        </HeroCard>
      </main>
    </div>
  );
}
