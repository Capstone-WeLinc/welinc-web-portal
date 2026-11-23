import { useState } from 'react';
import { signedInSystems } from '@/lib/launcher';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useKnownSystem } from '@/hooks/useKnownSystem';
import type { LauncherAnswer } from '@/lib/auth';
import { LauncherShell } from './LauncherShell';
import { SignOutDialog } from './SignOutDialog';

/** `?error=APP_NOT_ALLOWED&system=<SYS>`: a system's web app refused a phone app role (AC-7). */
export default function AppNotAllowed({
  answer,
  system,
}: {
  answer: LauncherAnswer;
  system: string | null;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const known = useKnownSystem(system);
  return (
    <LauncherShell user={answer.user} systems={signedInSystems(answer)}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-strong">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>
        <h1 role="alert" className="text-subheading font-semibold text-foreground">
          Your role in {known ?? 'this system'} uses the WeLinc mobile app, not the web
        </h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link to="/" className={buttonVariants({ size: 'touch' })}>
            Back to your systems
          </Link>
          <Button size="touch" variant="outline" onClick={() => setSigningOut(true)}>
            Sign out
          </Button>
        </div>
      </div>
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} systems={signedInSystems(answer)} />
    </LauncherShell>
  );
}
