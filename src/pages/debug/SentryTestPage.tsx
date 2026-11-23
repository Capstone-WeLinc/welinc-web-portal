import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LauncherShell } from '../launcher/LauncherShell';
import { useAdminMe } from '../admin/useAdminMe';

function Crash(): never {
  throw new Error('Sentry test crash from welinc-web-portal (spec 0025)');
}

/**
 * VRMS spec 0025, AC-16: `/debug/sentry`, only in builds made with VITE_SENTRY_TEST_ROUTES=true
 * (staging), only for suite admins, and with no menu link. The button crashes the page so the crash
 * screen and the Sentry issue can be checked together. Anyone else goes back to the launcher.
 */
export default function SentryTestPage() {
  const me = useAdminMe();
  const [crash, setCrash] = useState(false);

  if (me && !me.suiteAdmin) return <Navigate to="/" replace />;
  return (
    <LauncherShell user={me?.user} adminEntry={false} homeLink overlap={false}>
      {me ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-strong">
            <Bug className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-subheading font-semibold text-foreground">Error monitoring test</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Crashes this page on purpose to check the crash screen and the Sentry report.
            </p>
          </div>
          <Button size="touch" variant="destructive" onClick={() => setCrash(true)}>
            Crash this page
          </Button>
          {crash && <Crash />}
        </div>
      ) : (
        <Skeleton className="mx-auto mt-16 h-40 max-w-md rounded-2xl" />
      )}
    </LauncherShell>
  );
}
