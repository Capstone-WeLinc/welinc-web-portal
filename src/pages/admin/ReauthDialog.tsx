import { useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorCode } from '@/lib/admin';
import { registerReauthHost, verifyPassword } from '@/lib/adminApi';
import { reauthFailure } from '@/lib/adminErrors';

/**
 * Suite spec 0013, AC-14a, AC-14b, AC-24: the actor types their own password again before a
 * change that gives the admin role or acts on an admin account. Mounted once; `withReauth`
 * opens it when welinc-auth answers 403 `REAUTH_REQUIRED`.
 */
export function ReauthDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const settle = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    registerReauthHost(
      () =>
        new Promise<string | null>((resolve) => {
          settle.current = resolve;
          setPassword('');
          setError('');
          setOpen(true);
        }),
    );
    return () => registerReauthHost(null);
  }, []);

  const finish = (token: string | null) => {
    setOpen(false);
    setPassword('');
    setChecking(false);
    settle.current?.(token);
    settle.current = null;
  };

  const submit = async () => {
    if (!password || checking) return;
    setChecking(true);
    setError('');
    try {
      finish(await verifyPassword(password));
    } catch (err) {
      setError(reauthFailure(err));
      setChecking(false);
      if (errorCode(err) === 'ACCOUNT_LOCKED') setPassword('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !checking && finish(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <KeyRound aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Confirm with your password</AlertDialogTitle>
          <AlertDialogDescription>
            This change touches admin access, so type your own password again. The admins of that system get an
            email about it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id="reauth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-2"
        >
          <Label htmlFor="reauth-password">Your password</Label>
          <Input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={checking}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reauth-error' : undefined}
          />
          {error && (
            <p id="reauth-error" role="alert" className="flex items-start gap-2 text-caption text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={checking}>Cancel</AlertDialogCancel>
          <Button type="submit" form="reauth-form" loading={checking} disabled={!password}>
            {checking ? 'Checking' : 'Confirm'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
