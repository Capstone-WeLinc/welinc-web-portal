import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CircleAlert, Minus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { InitialsTile } from '@/components/ui/initials-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorStatus, type AdminMe, type SystemCode } from '@/lib/admin';
import { errorMessage, getPerson, personActivity, type CatalogSystem, type PersonDetail } from '@/lib/adminApi';
import { formatDate, formatDateTime } from '@/lib/format';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { describeEvent } from '../activity/describeEvent';
import { ViewError } from '../AdminStates';
import { useAsync } from '../useAsync';
import { pageTitle, SUITE_MANAGEMENT, useDocumentTitle } from '@/lib/title';
import { useEventCatalog, useSystemsCatalog } from '../useCatalogs';
import { AccessTab } from './AccessTab';
import { CardAction, PaneCard, StatusPill, SystemChip } from './peopleParts';
import { accessSummary, isPending, orList, personPill, roleLine, signInFacts } from './peopleRules';
import type { PersonActions } from './personActions';
import { PersonHeaderActions } from './PersonHeaderActions';
import { ActivityTab, DevicesTab } from './PersonTabs';
import { TemporaryTag } from './TemporaryTag';

export type PersonTab = 'overview' | 'access' | 'devices' | 'activity';

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; person: PersonDetail };

/**
 * Suite spec 0017, AC-2, AC-7 to AC-18 (board `People8`): the whole person, never "inside one
 * system". The person call sends no `system`, so welinc-auth answers with every role across the
 * viewer's systems (AC-19); a 404 means the account is gone or outside the viewer's systems.
 */
export function PersonPane({
  me,
  id,
  reloadKey,
  onListChanged,
  onMeChanged,
  onGiveAccess,
}: {
  me: AdminMe;
  id: string;
  /** Bumped when something outside the pane changed this person (the Add person dialog). */
  reloadKey: number;
  /** Called once after an action settles, so the list loads again (AC-18). */
  onListChanged: () => void;
  /** Fetches `me` again after a role change (AC-18). */
  onMeChanged: () => void;
  /** Opens the Add person dialog on step 2 for this person and system (AC-14). */
  onGiveAccess: (person: PersonDetail, system: SystemCode) => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Bumped after each action, so the tabs' own reads (sessions, activity) load again
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<PersonTab>('overview');
  const catalog = useSystemsCatalog();
  const navigate = useNavigate();
  const { search } = useLocation();
  const name = load.kind === 'ready' ? load.person.name : 'This person';
  // Suite spec 0019, AC-28: "Maria Santos · People", the list's title while the person loads
  useDocumentTitle(
    load.kind === 'loading'
      ? pageTitle('People', SUITE_MANAGEMENT)
      : pageTitle(load.kind === 'ready' && load.person.name.trim() ? load.person.name : 'Person', 'People'),
  );

  useEffect(() => {
    let cancelled = false;
    getPerson(id)
      .then((person) => !cancelled && setLoad({ kind: 'ready', person }))
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = errorStatus(error);
        setLoad(
          status === 404 || status === 400
            ? { kind: 'missing' }
            : { kind: 'error', message: errorMessage(error, "We couldn't load this person.") },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt, reloadKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /**
   * AC-18: read the person again once an action settles. After this page's own action a 404 means
   * they left the viewer's systems: back to the list. After someone else's change, show the latest.
   */
  const reload = useCallback(
    async (who: string, own: boolean, quietGone = false) => {
      onListChanged();
      setVersion((n) => n + 1);
      try {
        const person = await getPerson(id);
        setLoad({ kind: 'ready', person });
      } catch (error) {
        if (errorStatus(error) !== 404) return;
        if (own) {
          if (!quietGone) notify(`${who} is no longer in your systems.`, 'info');
          navigate(`/admin/people${search}`, { replace: true });
        } else {
          setLoad({ kind: 'missing' });
        }
      }
    },
    [id, navigate, onListChanged, search],
  );

  const actions: PersonActions = {
    settled: ({ roleChanged = false, quietGone = false } = {}) => {
      if (roleChanged) onMeChanged();
      void reload(name, true, quietGone);
    },
    conflict: (error) => {
      if (errorStatus(error) !== 404) return false;
      notify(`${name} changed while you were here. Showing the latest.`, 'info');
      void reload(name, false);
      return true;
    },
  };

  return (
    <div className="flex min-h-full flex-col">
      <PhoneBack />
      {load.kind === 'loading' && <PersonSkeleton />}
      {load.kind === 'missing' && <Missing />}
      {load.kind === 'error' && (
        <div className="p-6">
          <ViewError kind="tile" subject="people" message={load.message} onRetry={retry} />
        </div>
      )}
      {load.kind === 'ready' && (
        <Tabs value={tab} onValueChange={(next) => setTab(next as PersonTab)} className="flex-1 gap-0">
          <PersonHeader
            person={load.person}
            catalog={catalog}
            actions={<PersonHeaderActions person={load.person} me={me} actions={actions} />}
          >
            <TabsList aria-label="Person sections" className="-mb-px h-11 gap-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="devices">Signed in devices</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </PersonHeader>
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-9">
            <TabsContent value="overview">
              <OverviewTab person={load.person} me={me} catalog={catalog} version={version} onTab={setTab} />
            </TabsContent>
            <TabsContent value="access">
              <AccessTab
                person={load.person}
                me={me}
                catalog={catalog}
                actions={actions}
                onGiveAccess={(system) => onGiveAccess(load.person, system)}
              />
            </TabsContent>
            <TabsContent value="devices">
              <DevicesTab person={load.person} me={me} version={version} actions={actions} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab person={load.person} me={me} version={version} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}

/** On phones and tablets the person is its own screen with a way back (AC-1). */
function PhoneBack() {
  const { search } = useLocation();
  return (
    <div className="border-b border-border bg-card px-2 py-1 lg:hidden">
      <Link to={`/admin/people${search}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft aria-hidden="true" />
        People
      </Link>
    </div>
  );
}

function Missing() {
  const { search } = useLocation();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-6 lg:p-9">
      <p className="text-body text-foreground">This account no longer exists, or isn't in your systems.</p>
      <Link to={`/admin/people${search}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <ArrowLeft aria-hidden="true" />
        Back to People
      </Link>
    </div>
  );
}

/** AC-7, AC-9: the tile, name, pill and role line, the facts strip, then the section tabs. */
function PersonHeader({
  person,
  catalog,
  actions,
  children,
}: {
  person: PersonDetail;
  catalog: CatalogSystem[] | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pill = personPill(person);
  return (
    <div className="flex flex-col gap-5 border-b border-border bg-card px-4 pt-6 sm:px-6 lg:px-9 lg:pt-7">
      <div className="flex flex-wrap items-center gap-4.5">
        <InitialsTile
          name={person.name}
          size="header"
          className={cn('size-16 text-heading', isPending(person) && 'border-2 border-border bg-card')}
        />
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-title break-words text-foreground">{person.name}</h2>
            <StatusPill label={pill.label} tone={pill.tone} />
          </div>
          <p className="text-group font-normal text-muted-strong">{roleLine(person, catalog)}</p>
        </div>
        {actions}
      </div>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-divider bg-divider sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Email">
          <span className="block truncate" title={person.email}>
            {person.email}
          </span>
        </Fact>
        <Fact label="Last signed in">{person.lastSignedInAt ? formatDateTime(person.lastSignedInAt) : 'Never'}</Fact>
        <Fact label="Account made">{formatDate(person.createdAt)}</Fact>
        <Fact label="Added by">{person.addedBy?.name ?? '—'}</Fact>
      </dl>
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-background px-4 py-3">
      <dt className="text-caption font-normal text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

/** AC-10: the Access card, the Sign in card and the five newest events. */
function OverviewTab({
  person,
  me,
  catalog,
  version,
  onTab,
}: {
  person: PersonDetail;
  me: AdminMe;
  catalog: CatalogSystem[] | null;
  version: number;
  onTab: (tab: PersonTab) => void;
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        <AccessCard person={person} catalog={catalog} onChange={() => onTab('access')} />
        <SignInCard person={person} onDevices={() => onTab('devices')} />
      </div>
      <RecentActivity person={person} me={me} version={version} onAll={() => onTab('activity')} />
    </div>
  );
}

function AccessCard({
  person,
  catalog,
  onChange,
}: {
  person: PersonDetail;
  catalog: CatalogSystem[] | null;
  onChange: () => void;
}) {
  const { rows, noAccess } = accessSummary(person, catalog);
  return (
    <PaneCard title="Access" action={<CardAction onClick={onChange}>Change</CardAction>}>
      {rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <li key={row.system} className="flex flex-wrap items-center gap-3.5 border-b border-divider px-5 py-3 last:border-b-0">
              <SystemChip system={row.system} className="w-12" />
              <span className="min-w-0 flex-1 text-body font-semibold text-foreground">{row.roles.join(', ') || 'A role'}</span>
              {row.temporaryUntil && <TemporaryTag until={row.temporaryUntil} />}
            </li>
          ))}
        </ul>
      )}
      {noAccess.length > 0 && (
        <p className={cn('px-5 py-3 text-small text-muted-foreground', rows.length > 0 && 'border-t border-divider')}>
          No access to {orList(noAccess)}.
        </p>
      )}
    </PaneCard>
  );
}

const FACT_LOOK = {
  ok: { icon: Check, circle: 'bg-success-bg text-success', value: 'text-foreground' },
  bad: { icon: CircleAlert, circle: 'bg-error-bg text-error', value: 'text-error' },
  note: { icon: Minus, circle: 'bg-warning-bg text-warning', value: 'text-warning' },
} as const;

/** AC-11: how the person signs in. */
function SignInCard({ person, onDevices }: { person: PersonDetail; onDevices: () => void }) {
  const pending = isPending(person);
  return (
    <PaneCard
      title="Sign in"
      action={!pending && <CardAction onClick={onDevices}>See devices</CardAction>}
    >
      <ul>
        {signInFacts(person).map((fact) => {
          const look = FACT_LOOK[fact.tone];
          const Icon = look.icon;
          return (
            <li key={fact.label} className="flex items-center gap-3 border-b border-divider px-5 py-2.75 last:border-b-0">
              <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', look.circle)}>
                <Icon className="size-3.5" />
              </span>
              <span className="flex-1 text-body text-muted-strong">{fact.label}</span>
              <span className={cn('text-body font-semibold tabular-nums', look.value)}>{fact.value}</span>
            </li>
          );
        })}
      </ul>
    </PaneCard>
  );
}

/** AC-10: the five newest events across the viewer's systems, "See all" opens Activity. */
function RecentActivity({
  person,
  me,
  version,
  onAll,
}: {
  person: PersonDetail;
  me: AdminMe;
  version: number;
  onAll: () => void;
}) {
  const catalog = useEventCatalog();
  const [attempt, setAttempt] = useState(0);
  const { state } = useAsync(`${person.id}|${version}|${me.user.id}|${attempt}`, () =>
    personActivity(person.id, null, undefined, 5),
  );
  return (
    <PaneCard title="Recent activity" action={<CardAction onClick={onAll}>See all</CardAction>}>
      <div className="px-5 pt-3.5 pb-1.5">
        {state.kind === 'loading' && (
          <div aria-busy="true" className="flex flex-col gap-3 pb-3">
            <span className="sr-only">Loading activity</span>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        )}
        {state.kind === 'error' && (
          <div className="pb-3">
            <ViewError kind="tile" subject="activity" message="We couldn't load the activity." onRetry={() => setAttempt((n) => n + 1)} />
          </div>
        )}
        {state.kind === 'ready' && state.value.data.length === 0 && (
          <p className="pb-3 text-body text-muted-foreground">Nothing recorded yet.</p>
        )}
        {state.kind === 'ready' && state.value.data.length > 0 && (
          <ol className="flex flex-col">
            {state.value.data.slice(0, 5).map((event) => (
              <li key={event.id} className="flex gap-2.5 pb-3.5">
                <span aria-hidden="true" className="mx-1.25 mt-1.5 size-2 shrink-0 rounded-full bg-card ring-2 ring-primary" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body break-words text-foreground">
                    {event.system && <SystemChip system={event.system} className="mr-1.5 align-text-bottom" />}
                    {describeEvent(event, catalog).label}
                  </span>
                  <time dateTime={event.createdAt} className="text-caption font-normal text-muted-foreground tabular-nums">
                    {formatDateTime(event.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </PaneCard>
  );
}

function PersonSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5 border-b border-border bg-card px-4 py-6 sm:px-6 lg:px-9">
      <span className="sr-only">Loading this person</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
