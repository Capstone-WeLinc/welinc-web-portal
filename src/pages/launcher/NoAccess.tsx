import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyError } from '@/lib/notify';
import { signOutEverywhere } from '@/lib/session';
import { AuthSplit, SplitResult, Strong, splitButton } from '../auth/AuthSplit';

/**
 * Signed in, but no role in any system (spec 0007, AC-19), on the sign in split with the words
 * centred (suite spec 0019, AC-16, board `R34NoAccess`). It names no systems. Try again asks
 * `/auth/sso` once more; Use another account signs out and shows the form.
 */
export default function NoAccess({ email, onRetry }: { email: string | null; onRetry: () => void }) {
  const [signingOut, setSigningOut] = useState(false);

  const switchAccount = async () => {
    setSigningOut(true);
    try {
      await signOutEverywhere();
    } catch {
      setSigningOut(false);
      notifyError("We couldn't sign you out. Try again.");
    }
  };

  return (
    <AuthSplit>
      <div role="alert">
        <SplitResult
          tone="info"
          icon={<ShieldOff className="size-6.5" strokeWidth={1.9} />}
          title="No access yet"
          actions={
            <>
              <Button className={splitButton} onClick={onRetry}>
                Try again
              </Button>
              <Button
                variant="outline"
                loading={signingOut}
                onClick={() => void switchAccount()}
                className="h-12 w-full rounded-xl text-group font-bold max-sm:h-12"
              >
                Use another account
              </Button>
            </>
          }
        >
          {email ? <Strong>{email}</Strong> : 'Your account'} doesn't have a role yet. Ask your admin to add you, then try
          again.
        </SplitResult>
      </div>
    </AuthSplit>
  );
}
