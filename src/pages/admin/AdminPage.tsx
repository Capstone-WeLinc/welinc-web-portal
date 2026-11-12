import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { ArrowLeft, Inbox, RotateCw, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { askForCode, errorStatus, fetchAdminMe, isAdmin, needsCode, type AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { LauncherShell } from '../launcher/LauncherShell';
import { landingView, viewsFor } from './adminViews';

type Load = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error' } | { kind: 'ready'; me: AdminMe };

/**
 * Suite spec 0013, AC-22, AC-23: the portal admin section at `/admin/:view`. Who may see what
 * comes from `GET /auth/admin/me`; welinc-auth checks every call again, so this only shapes the
 * page. A session that owes the emailed code asks for it before anything else.
 */
export default function AdminPage() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAdminMe()
      .then((me) => !cancelled && setLoad({ kind: 'ready', me }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad(errorStatus(error) === 401 ? { kind: 'signed-out' } : { kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  switch (load.kind) {
    case 'loading':
      return <AdminLoading />;
    case 'signed-out':
      return <Navigate to="/" replace />;
    case 'error':
      return <AdminError onRetry={reload} />;
    case 'ready':
      if (!isAdmin(load.me)) return <NotAnAdmin me={load.me} />;
      if (needsCode(load.me)) return <CodeOwed me={load.me} onPassed={reload} />;
      return <AdminShell me={load.me} />;
  }
}

function AdminShell({ me }: { me: AdminMe }) {
  const { view } = useParams();
  const views = viewsFor(me);
  const current = views.find((v) => v.path === view);
  if (!current) return <Navigate to={`/admin/${landingView(me)}`} replace />;

  return (
    <LauncherShell user={me.user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.suiteAdmin
            ? 'Suite admin: every account and every system.'
            : `Admin of ${me.adminOf.join(' and ')}: your system's people only.`}
        </p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Admin sections" className="md:w-56 md:shrink-0">
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {views.map((v) => (
              <li key={v.path}>
                <NavLink
                  to={`/admin/${v.path}`}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center rounded-lg border-l-2 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                      isActive
                        ? 'border-highlight bg-card font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  {v.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="admin-view-title" className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 id="admin-view-title" className="text-lg font-semibold text-foreground">
            {current.label}
          </h2>
          <div className="flex flex-col items-start gap-3 py-8">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
              <Inbox className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">Nothing to show here yet.</p>
          </div>
        </section>
      </div>
    </LauncherShell>
  );
}

/** AC-22: the session owes the code. The dialog opens at once; the button opens it again. */
function CodeOwed({ me, onPassed }: { me: AdminMe; onPassed: () => void }) {
  const ask = useCallback(() => {
    void askForCode().then((passed) => passed && onPassed());
  }, [onPassed]);

  useEffect(() => {
    ask();
  }, [ask]);

  return (
    <LauncherShell user={me.user}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-strong">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Confirm it's you to open Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">We email a 6 digit code to {me.user.email}.</p>
        </div>
        <Button size="touch" onClick={ask}>
          Send the code
        </Button>
        <BackToLauncher />
      </div>
    </LauncherShell>
  );
}

function NotAnAdmin({ me }: { me: AdminMe }) {
  return (
    <LauncherShell user={me.user}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-strong">
          <ShieldOff className="size-6" aria-hidden="true" />
        </div>
        <h1 role="alert" className="text-lg font-semibold text-foreground">
          Admin is for admin accounts only.
        </h1>
        <BackToLauncher />
      </div>
    </LauncherShell>
  );
}

function BackToLauncher() {
  return (
    <Link to="/" className={cn(buttonVariants({ variant: 'ghost', size: 'touch' }))}>
      <ArrowLeft aria-hidden="true" />
      Back to your systems
    </Link>
  );
}

function AdminLoading() {
  return (
    <LauncherShell>
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading Admin</span>
        <div className="mb-6 flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex flex-wrap gap-2 md:w-56 md:flex-col">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-36 md:w-full" />
            ))}
          </div>
          <Skeleton className="h-64 flex-1 rounded-lg" />
        </div>
      </div>
    </LauncherShell>
  );
}

function AdminError({ onRetry }: { onRetry: () => void }) {
  return (
    <LauncherShell>
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">We couldn't load Admin.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button size="touch" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </LauncherShell>
  );
}
