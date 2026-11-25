import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignInToaster } from '@/components/ui/sonner';
import { notifySignIn } from '@/lib/notify';
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
import { AuthSplit, SplitHeading, SplitHint, SplitLabel, SplitNotice, splitButton, splitInput } from './AuthSplit';
import { PasswordInput } from './PasswordInput';

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
    <AuthSplit toaster={<SignInToaster />}>
      {step ? (
        <EmailCodeStep step={step} onSignedIn={onSignedIn} onBack={backToPassword} />
      ) : (
        <>
          <SplitHeading title="Sign in">Use your WeLinc work email.</SplitHeading>

          {notice?.tone === 'error' && !error && (
            <SplitNotice tone="error">
              <p>{notice.message}</p>
              <button
                type="button"
                onClick={signInAgain}
                className="mt-1 min-h-11 cursor-pointer rounded-md font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                Sign in again
              </button>
            </SplitNotice>
          )}

          {error && (
            <SplitNotice tone="error">
              <p>{error}</p>
            </SplitNotice>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
            <div>
              <SplitLabel htmlFor="login-email">Work email</SplitLabel>
              <Input
                ref={emailRef}
                id="login-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@welinc.com"
                required
                autoComplete="username"
                className={splitInput}
              />
            </div>

            <div>
              <div className="flex items-start justify-between gap-3">
                <SplitLabel htmlFor="login-password">Password</SplitLabel>
                <Link
                  to="/forgot-password"
                  className="rounded-md text-body font-semibold text-primary underline underline-offset-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={setPassword}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            <Button id="login-submit" type="submit" loading={loading} className={splitButton}>
              {loading ? (
                'Signing in'
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>

          <SplitHint>
            <p>No account yet? Ask your admin to add you. You'll get an email to set your password.</p>
          </SplitHint>
        </>
      )}
    </AuthSplit>
  );
}
