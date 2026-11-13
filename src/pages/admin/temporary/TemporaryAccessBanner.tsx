import { useEffect, useState } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import type { AdminMe } from '@/lib/admin';
import { endGrant, errorMessage } from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import { checkSso, goToSignedOut } from '@/lib/session';
import { cn } from '@/lib/utils';

type Grant = NonNullable<AdminMe['temporaryGrants']>[number];

/**
 * Suite spec 0013, AC-24: while a suite admin holds temporary access, a band under the top bar
 * names the system, role and end time, with End now and Open <system>. Ending signs the person
 * out everywhere (AC-10 ends the web session), so it warns first and then shows the login.
 */
export function TemporaryAccessBanner({ grants }: { grants: AdminMe['temporaryGrants'] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const live = grants ?? [];

  useEffect(() => {
    if (live.length === 0) return;
    let cancelled = false;
    void checkSso().then((result) => {
      if (cancelled || result.kind !== 'live') return;
      setUrls(Object.fromEntries(result.answer.systems.map((s) => [s.system, s.url])));
    });
    return () => {
      cancelled = true;
    };
  }, [live.length]);

  if (live.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-2">
      {live.map((grant) => (
        <GrantBand key={grant.id} grant={grant} url={urls[grant.system]} />
      ))}
    </div>
  );
}

function GrantBand({ grant, url }: { grant: Grant; url?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const end = async () => {
    setBusy(true);
    try {
      await endGrant(grant.id);
      // AC-10 ended this web session too: back to the login screen
      goToSignedOut();
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't end temporary access."));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-highlight bg-highlight/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-sm text-foreground">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          You have temporary <strong>{grant.system} {grant.roleName}</strong> access until{' '}
          <time dateTime={grant.expiresAt} className="tabular-nums">
            {formatDateTime(grant.expiresAt)}
          </time>
          .
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        {url && (
          <a href={url} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 sm:flex-none')}>
            <ExternalLink aria-hidden="true" />
            Open {grant.system}
          </a>
        )}
        <Button variant="destructive" className="flex-1 sm:flex-none" onClick={() => setConfirming(true)}>
          End now
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End your {grant.system} access now?</AlertDialogTitle>
            <AlertDialogDescription>
              This signs you out everywhere, the portal included, so you will sign in again. {grant.system}'s admins
              get an email that you ended it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep access</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void end();
              }}
            >
              {busy ? 'Ending' : 'End and sign out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
