import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCw, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { askForCode, errorStatus, fetchAdminMe, isAdmin, needsCode, type AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { LauncherShell } from '../launcher/LauncherShell';
import { landingView, viewHref, viewsFor, type AdminViewPath } from './adminViews';
import { ActivityView } from './activity/ActivityView';
import { PermissionsView } from './permissions/PermissionsView';
import { DeletionRequestsView } from './deletion/DeletionRequestsView';
import { AddPersonPage } from './people/AddPersonPage';
import { PeopleView } from './people/PeopleView';
import { PersonPage } from './people/PersonPage';
import { OverviewView } from './overview/OverviewView';
import { SuiteAdminsView } from './suite/SuiteAdminsView';
import { TemporaryAccessBanner } from './temporary/TemporaryAccessBanner';
import { TemporaryAccessView } from './temporary/TemporaryAccessView';

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

  // After a change to the caller's own standing (temporary access): no loading screen
  const refresh = useCallback(() => {
    fetchAdminMe()
      .then((me) => setLoad({ kind: 'ready', me }))
      .catch(() => undefined);
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
      return <AdminShell me={load.me} onChanged={refresh} />;
  }
}

function AdminShell({ me, onChanged }: { me: AdminMe; onChanged: () => void }) {
  const params = useParams();
  const { search } = useLocation();
  // /admin/people/:id and /admin/people/new sit under People
  const view = params.id ? 'people' : params.view;
  const views = viewsFor(me);
  const current = views.find((v) => v.path === view);
  if (!current) return <Navigate to={viewHref(landingView(me), search)} replace />;

  return (
    <LauncherShell
      user={me.user}
      adminEntry={false}
      homeLink
      overlap={false}
      hero={
        <>
          <Link
            to="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden sm:min-h-9"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Admin</h1>
          <p className="mt-1 text-sm text-white/70">
            {me.suiteAdmin
              ? 'Suite admin: every account and every system.'
              : `Admin of ${me.adminOf.join(' and ')}: your system's people only.`}
          </p>
        </>
      }
    >
      <TemporaryAccessBanner grants={me.temporaryGrants} />
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <nav aria-label="Admin sections" className="md:w-56 md:shrink-0">
          {/* Phones: one scrolling strip of tabs; from md: the sidebar column */}
          <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {views.map((v) => {
              const active = v.path === view;
              const Icon = v.icon;
              return (
                <li key={v.path} className="shrink-0">
                  <NavLink
                    to={viewHref(v.path, search)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:border-l-2',
                      active
                        ? 'bg-card font-medium text-foreground shadow-xs md:border-highlight'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground md:border-transparent',
                    )}
                  >
                    <Icon
                      className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
                    {v.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <section aria-labelledby="admin-view-title" className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4 sm:p-5">
          <AdminViewBody me={me} view={current.path} id={params.id} onChanged={onChanged} />
        </section>
      </div>
    </LauncherShell>
  );
}

/** The body of one admin view. */
function AdminViewBody({
  me,
  view,
  id,
  onChanged,
}: {
  me: AdminMe;
  view: AdminViewPath;
  id?: string;
  onChanged: () => void;
}) {
  switch (view) {
    case 'overview':
      return <OverviewView />;
    case 'suite-admins':
      return <SuiteAdminsView me={me} />;
    case 'temporary-access':
      return <TemporaryAccessView me={me} onChanged={onChanged} />;
    case 'people':
      if (id === 'new') return <AddPersonPage me={me} />;
      if (id) return <PersonPage me={me} />;
      return <PeopleView me={me} />;
    case 'deletion-requests':
      return <DeletionRequestsView me={me} />;
    case 'activity':
      return <ActivityView me={me} />;
    case 'permissions':
      return <PermissionsView me={me} />;
    default: {
      // Unknown paths already redirected above; a view added without a case fails the build here
      const missing: never = view;
      return missing;
    }
  }
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
    <LauncherShell user={me.user} adminEntry={false} homeLink>
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
    <LauncherShell user={me.user} adminEntry={false} homeLink>
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
      Back to home
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
