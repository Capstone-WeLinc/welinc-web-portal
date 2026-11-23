import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, fetchReport, type AdminReport } from '@/lib/adminApi';
import { formatDate, formatDateTime } from '@/lib/format';
import { ViewError, ViewHeader } from '../AdminStates';
import { OrphanBadge } from '../people/Badges';
import { Cell, DataTable, Muted, Row } from '../AdminTable';
import { useEventCatalog } from '../useCatalogs';
import { useAsync } from '../useAsync';
import { useState } from 'react';

type Report = AdminReport;

/**
 * Suite spec 0013, AC-19, AC-23: a suite admin's landing page. Who holds admin where and since
 * when, live temporary access, what needs attention, then the latest admin changes.
 */
export function OverviewView() {
  const [attempt, setAttempt] = useState(0);
  const { state } = useAsync(String(attempt), fetchReport);
  return (
    <>
      <ViewHeader title="Overview" context="Admins per system, what needs a look, and recent changes." />
      {state.kind === 'loading' && <OverviewSkeleton />}
      {state.kind === 'error' && (
        <ViewError
          message={errorMessage(state.error, "We couldn't load the overview.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {state.kind === 'ready' && (
        <div className="flex flex-col gap-8">
          <AdminsPerSystem report={state.value} />
          <Attention report={state.value} />
          <RecentChanges report={state.value} />
        </div>
      )}
    </>
  );
}

/** The overview shows the latest few admin changes; the full history lives in Activity. */
const RECENT_SHOWN = 8;

/** Columns inside one bordered container; the 1px gaps over the border color draw the dividers. */
const DIVIDED_GRID = 'grid gap-px overflow-hidden rounded-2xl border border-transparent bg-border shadow-card';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `overview-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-group font-semibold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function AdminsPerSystem({ report }: { report: Report }) {
  return (
    <Section title="Admins per system">
      {report.systemsWithoutAdmin.length > 0 && (
        <p role="alert" className="flex items-start gap-2 text-body text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No active admin in {report.systemsWithoutAdmin.join(', ')}. Make someone admin there.
        </p>
      )}
      {/* One container split by 1px dividers, not a bordered box per system (design.md: no card in a card) */}
      <div className={DIVIDED_GRID + ' lg:grid-cols-3'}>
        {report.systems.map((system) => (
          <div key={system.system} className="flex min-w-0 flex-col gap-3 bg-card p-4">
            <div>
              <p className="text-body font-semibold text-foreground">{system.system}</p>
              <p className="text-caption text-muted-foreground">
                {system.admins.length} {system.adminRole?.name ?? 'admin'}
                {system.admins.length === 1 ? '' : 's'}
              </p>
            </div>
            {/* One line per admin: name, then the date it started; who granted it is on their page */}
            <ul className="flex flex-col gap-1.5">
              {system.admins.map((admin) => (
                <li key={admin.id} className="flex min-w-0 items-baseline justify-between gap-3">
                  <Link
                    to={`/admin/people/${admin.id}?system=${system.system}`}
                    className="min-w-0 truncate text-body text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    {admin.name}
                  </Link>
                  <time
                    dateTime={admin.since}
                    className="shrink-0 text-caption text-muted-foreground tabular-nums"
                    aria-label={`admin since ${formatDate(admin.since)}`}
                  >
                    {formatDate(admin.since)}
                  </time>
                </li>
              ))}
            </ul>
            {system.temporaryGrants.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {system.temporaryGrants.map((grant) => (
                  <li key={grant.id} className="flex items-start gap-2 text-caption text-foreground">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <Link
                      to="/admin/temporary-access"
                      className="min-w-0 break-words underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      {grant.holder.name}, temporary {grant.roleName} until{' '}
                      <span className="whitespace-nowrap tabular-nums">{formatDateTime(grant.expiresAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

type Row = { key: string; label: ReactNode; detail: string };

function Attention({ report }: { report: Report }) {
  const { attention } = report;
  const person = (id: string, name: string) => (
    <Link to={`/admin/people/${id}`} className="break-words text-primary underline-offset-4 hover:underline">
      {name}
    </Link>
  );
  const groups: { title: string; count: number; rows: Row[]; more: string }[] = [
    {
      title: 'Locked',
      count: attention.locked.count,
      more: '/admin/people?system=all&status=LOCKED',
      rows: attention.locked.first.map((p) => ({
        key: p.id,
        label: person(p.id, p.name),
        detail: `since ${formatDateTime(p.lockedAt)}`,
      })),
    },
    {
      title: 'Setup pending',
      count: attention.setupPending.count,
      more: '/admin/people?system=all&status=SETUP_PENDING',
      rows: attention.setupPending.first.map((p) => ({
        key: p.id,
        label: person(p.id, p.name),
        detail: `added ${formatDate(p.createdAt)}`,
      })),
    },
    {
      title: 'Email not verified',
      count: attention.emailNotVerified.count,
      more: '/admin/people?system=all&status=EMAIL_NOT_VERIFIED',
      rows: attention.emailNotVerified.first.map((p) => ({
        key: p.id,
        label: person(p.id, p.name),
        detail: `added ${formatDate(p.createdAt)}`,
      })),
    },
    {
      title: 'Deletion requests',
      count: attention.deletionRequests.count,
      more: '/admin/deletion-requests?system=all',
      rows: attention.deletionRequests.first.map((r) => ({
        key: r.id,
        label: (
          <span className="inline-flex flex-wrap items-center gap-2">
            {person(r.user.id, r.user.name)}
            {r.orphan && <OrphanBadge />}
          </span>
        ),
        detail: `asked ${formatDate(r.requestedAt)}`,
      })),
    },
    {
      title: 'In the grace period',
      count: attention.inGrace.count,
      more: '/admin/deletion-requests?system=all',
      rows: attention.inGrace.first.map((p) => ({
        key: p.id,
        label: (
          <span className="inline-flex flex-wrap items-center gap-2">
            {person(p.id, p.name)}
            {p.orphan && <OrphanBadge />}
          </span>
        ),
        detail: `erased ${formatDate(p.eraseAfter)}`,
      })),
    },
  ];
  const open = groups.filter((g) => g.count > 0);
  return (
    <Section title="Needs attention">
      {open.length === 0 ? (
        <p className="text-body text-muted-foreground">Nothing needs a look right now.</p>
      ) : (
        <div className={DIVIDED_GRID + ' md:grid-cols-2'}>
          {open.map((group) => (
            <div key={group.title} className="flex min-w-0 flex-col gap-2 bg-card p-4 md:last:odd:col-span-2">
              <p className="text-body font-semibold text-foreground">
                {group.title} <span className="font-normal text-muted-foreground tabular-nums">({group.count})</span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {group.rows.map((row) => (
                  <li key={row.key} className="text-body">
                    {row.label} <span className="text-caption text-muted-foreground tabular-nums">{row.detail}</span>
                  </li>
                ))}
              </ul>
              {group.count > group.rows.length && (
                <Link to={group.more} className="text-caption text-primary underline-offset-4 hover:underline">
                  See all {group.count}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function RecentChanges({ report }: { report: Report }) {
  const catalog = useEventCatalog();
  const label = (type: string) => catalog?.types.find((t) => t.code === type)?.label ?? type;
  return (
    <Section title="Recent admin changes">
      {report.recentAdminChanges.length === 0 ? (
        <p className="text-body text-muted-foreground">No admin changes yet.</p>
      ) : (
        <DataTable columns={[{ label: 'When' }, { label: 'Person' }, { label: 'Change' }, { label: 'By' }]}>
          {report.recentAdminChanges.slice(0, RECENT_SHOWN).map((change) => (
            <Row key={change.id}>
              <Cell className="whitespace-nowrap">
                <time dateTime={change.at}>
                  <Muted>{formatDateTime(change.at)}</Muted>
                </time>
              </Cell>
              <Cell>
                <Link
                  to={`/admin/people/${change.user.id}${change.system ? `?system=${change.system}` : ''}`}
                  className="font-medium break-words text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  {change.user.name}
                </Link>
              </Cell>
              <Cell>
                <p className="break-words text-foreground">
                  {label(change.type)}
                  {change.system ? ` (${change.system})` : ''}
                  {change.newValue && change.type === 'ROLE_CHANGED' ? `, now ${change.newValue}` : ''}
                </p>
                {change.reason && <p className="text-caption break-words text-muted-foreground">"{change.reason}"</p>}
              </Cell>
              <Cell>
                <Muted>{change.actor ? change.actor.name : 'WeLinc (automatic)'}</Muted>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
      {report.recentAdminChanges.length > RECENT_SHOWN && (
        <Link
          to="/admin/activity?system=all"
          className="self-start text-body font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          See all activity
        </Link>
      )}
    </Section>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the overview</span>
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
