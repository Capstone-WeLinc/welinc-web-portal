import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignInToaster } from '@/components/ui/sonner';
import { notifySignIn } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { api } from '../../lib/api';
import {
  isEmailStep,
  loginFailure,
  loginRequest,
  noticeFor,
  type EmailStep,
  type LauncherAnswer,
  type Notice,
} from '../../lib/auth';
import EmailCodeStep from './EmailCodeStep';
import {
  HeroBackdrop,
  HeroCard,
  HeroLabel,
  HeroLogo,
  HeroNotice,
  HeroPane,
  heroButton,
  heroInput,
} from './AuthHero';

type LoginProps = {
  /** Called with the login answer; the portal decides where to go next (spec 0007, AC-14). */
  onSignedIn: (answer: LauncherAnswer) => void;
  /** A message that wins over the address's, such as "Your session ended" (AC-18). */
  notice?: Notice | null;
};

/**
 * The portal login form (spec 0003, AC-36). Signing in sets welinc-auth's SSO cookie; the portal
 * keeps nothing itself. Whether the form shows at all is the portal's choice (`Portal.tsx`).
 */
export default function Login({ onSignedIn, notice: noticeOverride }: LoginProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const request = loginRequest(searchParams);
  const notice = noticeOverride ?? noticeFor(searchParams);
  // Suite spec 0019, AC-15: a sign out or an ended session is a toast over the form; errors that
  // stop a sign in stay inline
  const toastTone = notice && notice.tone !== 'error' ? notice.tone : null;
  const toastMessage = toastTone ? notice!.message : null;
  useEffect(() => {
    if (toastTone && toastMessage) notifySignIn(toastMessage, toastTone);
  }, [toastTone, toastMessage]);
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Suite spec 0009, AC-25: the code step's ticket lives here only, never in the URL or storage
  const [step, setStep] = useState<EmailStep | null>(null);

  const backToPassword = (message?: string) => {
    setStep(null);
    setPassword('');
    setError(message ?? '');
    setLoading(false);
  };

  const signInAgain = () => {
    // Drops the message; with a live session the portal's check goes straight on
    navigate(request ? `/login?request=${request}` : '/login', { replace: true });
    emailRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      let formattedEmail = email.trim();
      if (!formattedEmail.includes('@')) {
        formattedEmail = `${formattedEmail}@welinc.com`;
      }

      // Spec 0003, AC-11: sets the SSO cookie and answers the systems, never a token
      const { data } = await api.post<LauncherAnswer | EmailStep>('/auth/login', {
        email: formattedEmail,
        password,
      });
      if (isEmailStep(data)) {
        setStep(data);
        return;
      }
      onSignedIn(data);
    } catch (err) {
      setError(loginFailure(err));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-hero">
      <HeroPane />

      {/* transform-gpu makes this column the box sonner's fixed list sits in (AC-15) */}
      <div className="relative flex min-w-0 flex-1 transform-gpu items-center justify-center p-6 lg:p-12">
        <SignInToaster />
        <HeroBackdrop />

        <main className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <HeroLogo size="sm" />
            <span className="text-subheading font-black text-white">WeLinc Logistics</span>
          </div>

          <HeroCard>
            {step ? (
              <EmailCodeStep step={step} onSignedIn={onSignedIn} onBack={backToPassword} />
            ) : (
              <>
                <div className="mb-8">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-highlight shadow-lg shadow-highlight/20">
                    <Truck size={22} className="text-primary" strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <h2 className="mb-1 text-title font-black text-white">Sign in</h2>
                  <p className="text-body text-white/50">Enter your credentials to access your workspace</p>
                </div>

                {notice?.tone === 'error' && !error && (
                  <HeroNotice tone={notice.tone}>
                    <p>{notice.message}</p>
                    {notice.tone === 'error' && (
                      <button
                        type="button"
                        onClick={signInAgain}
                        className="mt-2 min-h-11 cursor-pointer rounded-md text-body font-semibold text-highlight hover:text-commit-hover focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
                      >
                        Sign in again
                      </button>
                    )}
                  </HeroNotice>
                )}

                {error && (
                  <HeroNotice tone="error">
                    <p>{error}</p>
                  </HeroNotice>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate={false}>
                  <div>
                    <HeroLabel htmlFor="login-email">Email or username</HeroLabel>
                    <Input
                      ref={emailRef}
                      id="login-email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@welinc.com or username"
                      required
                      autoComplete="username"
                      className={heroInput}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <HeroLabel htmlFor="login-password">Password</HeroLabel>
                      <Link
                        to="/forgot-password"
                        className="mb-2 rounded-md text-caption font-normal text-highlight/80 transition-colors hover:text-highlight focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                        autoComplete="current-password"
                        className={cn(heroInput, 'pr-12')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-xl text-white/40 transition-colors hover:text-white/70 focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
                      >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </div>

                  <Button id="login-submit" type="submit" loading={loading} className={heroButton}>
                    {loading ? 'Signing in' : 'Sign in'}
                  </Button>
                </form>
              </>
            )}
          </HeroCard>
        </main>
      </div>
    </div>
  );
}
