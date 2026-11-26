import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCw, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { askForCode, errorStatus, fetchAdminMe, isAdmin, needsCode, type AdminMe } from '@/lib/admin';
import { onSessionEnded } from '@/lib/api';
import { signInAgainHref } from '@/lib/auth';
import { useSessionWatch } from '@/lib/sessionWatch/watch';
import { pageTitle, SUITE_MANAGEMENT, useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';
import { LauncherShell } from '../launcher/LauncherShell';
import NotFound from '../NotFound';
import { AdminShell } from './AdminShell';
import { ADMIN_VIEWS, landingView, viewHref, viewsFor, type AdminViewPath } from './adminViews';
import { ActivityView } from './activity/ActivityView';
import { RolesPage } from './roles/RolesPage';
import { DeletionRequestsView } from './deletion/DeletionRequestsView';
import { PeoplePage } from './people/PeoplePage';
import { OverviewView } from './overview/OverviewView';
import { SuiteAdminsView } from './suite/SuiteAdminsView';
import { TemporaryAccessBanner, TemporaryAccessChip } from './temporary/TemporaryAccessBanner';
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
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // AC-14: a session that ends while a view is open sends you to sign in, then back to this page.
  // The page comes from the router, and only the first ended call acts: several admin calls can
  // answer 401 at once, and by the second one the address is already the sign in page.
  const here = useRef(pathname + search);
  useEffect(() => {
    here.current = pathname + search;
  }, [pathname, search]);
  useEffect(() => {
    let left = false;
    onSessionEnded(() => {
      if (left) return;
      left = true;
      navigate(signInAgainHref(here.current, true), { replace: true });
    });
    return () => onSessionEnded(null);
  }, [navigate]);

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

  // Suite spec 0016, AC-12b: the signing out soon watch, once the session is known to be live. A
  // reload or a pasted link starts with no cutoffs, so the watch asks /auth/sso once itself.
  useSessionWatch(load.kind === 'ready');
  // The console names its view; every other admin state is Suite management alone
  useDocumentTitle(load.kind === 'ready' && isAdmin(load.me) && !needsCode(load.me) ? null : pageTitle(SUITE_MANAGEMENT));

  switch (load.kind) {
    case 'loading':
      return <AdminLoading />;
    case 'signed-out':
      return <Navigate to={signInAgainHref(pathname + search, false)} replace />;
    case 'error':
      return <AdminError onRetry={reload} />;
    case 'ready':
      if (!isAdmin(load.me)) return <NotAnAdmin me={load.me} />;
      if (needsCode(load.me)) return <CodeOwed me={load.me} onPassed={reload} />;
      return <AdminConsole me={load.me} onChanged={refresh} />;
  }
}

function AdminConsole({ me, onChanged }: { me: AdminMe; onChanged: () => void }) {
  const params = useParams();
  const { search } = useLocation();
  // /admin/people/:id and /admin/people/new sit under People; /admin/roles/:system/:role under Roles
  const view = params.id ? 'people' : params.system ? 'roles' : params.view;
  const views = viewsFor(me);
  const current = views.find((v) => v.path === view);
  // People names itself (the list, or the open person)
  useDocumentTitle(current && current.path !== 'people' ? pageTitle(current.label, SUITE_MANAGEMENT) : null);
  // Suite spec 0018, AC-1: the old Permissions page, ?system= included, opens Roles (before Wrong turn,
  // since it is no view any more)
  if (view === 'permissions') {
    const system = new URLSearchParams(search).get('system');
    return <Navigate to={system ? `/admin/roles/${system.toUpperCase()}` : '/admin/roles'} replace />;
  }
  // Suite spec 0019, AC-26: an address that is no view at all is Wrong turn; a view you can't
  // open (a suite only one) and `/admin` itself still land on your first view
  if (view !== undefined && !ADMIN_VIEWS.some((v) => v.path === view)) return <NotFound />;
  if (!current) return <Navigate to={viewHref(landingView(me), search)} replace />;

  const grants = me.temporaryGrants?.length ? me.temporaryGrants : undefined;
  // The full band, with Open and End now, where temporary access is the subject; a pill elsewhere
  const fullBand = current.path === 'overview' || current.path === 'temporary-access';
  // Lists sit on the canvas in their own table cards. People and Roles are a list beside one
  // item, edge to edge (suite spec 0017, AC-1; suite spec 0018, AC-1).
  const flush = current.path === 'people' || current.path === 'roles';

  return (
    <AdminShell
      me={me}
      views={views}
      current={current.path}
      banner={grants && fullBand ? <TemporaryAccessBanner grants={grants} /> : undefined}
      status={grants && !fullBand ? <TemporaryAccessChip grants={grants} /> : undefined}
      flush={flush}
    >
      <section
        aria-labelledby="admin-view-title"
        className={cn('min-w-0', flush && 'h-full')}
      >
        <AdminViewBody me={me} view={current.path} onChanged={onChanged} />
      </section>
    </AdminShell>
  );
}

/** The body of one admin view. */
function AdminViewBody({
  me,
  view,
  onChanged,
}: {
  me: AdminMe;
  view: AdminViewPath;
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
      return <PeoplePage me={me} onMeChanged={onChanged} />;
    case 'deletion-requests':
      return <DeletionRequestsView me={me} />;
    case 'activity':
      return <ActivityView me={me} />;
    case 'roles':
      return <RolesPage me={me} />;
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
          <h1 className="text-subheading font-semibold text-foreground">Confirm it's you to open Admin</h1>
          <p className="mt-1 text-body text-muted-foreground">We email a 6 digit code to {me.user.email}.</p>
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
        <h1 role="alert" className="text-subheading font-semibold text-foreground">
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
          <Skeleton className="h-64 flex-1 rounded-2xl" />
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
          <h1 className="text-subheading font-semibold text-foreground">We couldn't load Admin.</h1>
          <p className="mt-1 text-body text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button size="touch" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </LauncherShell>
  );
}
