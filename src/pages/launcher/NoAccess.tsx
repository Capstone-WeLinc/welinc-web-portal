import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LauncherShell } from './LauncherShell';
import { SignOutDialog } from './SignOutDialog';

/** Signed in, but no role in any system (spec 0007, AC-19). */
export default function NoAccess({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <LauncherShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-strong">
          <ShieldOff className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 role="alert" className="text-lg font-semibold text-foreground">
            Your account has no access to any WeLinc system. Ask your admin for a role.
          </h1>
          {email && (
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{email}</span>
            </p>
          )}
        </div>
        <Button size="touch" variant="outline" onClick={() => setSigningOut(true)}>
          Sign out
        </Button>
      </div>
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} />
    </LauncherShell>
  );
}
