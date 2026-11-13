import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, fetchReport, type AdminReport } from '@/lib/adminApi';
import { formatDate, formatDateTime } from '@/lib/format';
import { ViewError, ViewHeader } from '../AdminStates';
import { OrphanBadge } from '../people/Badges';
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
      <ViewHeader title="Overview" context="Who can do what across the suite, and what needs a look." />
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
const DIVIDED_GRID = 'grid gap-px overflow-hidden rounded-lg border border-border bg-border';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `overview-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-base font-semibold text-foreground">
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
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No active admin in {report.systemsWithoutAdmin.join(', ')}. Make someone admin there.
        </p>
      )}
      {/* One container split by 1px dividers, not a bordered box per system (design.md: no card in a card) */}
      <div className={DIVIDED_GRID + ' lg:grid-cols-3'}>
        {report.systems.map((system) => (
          <div key={system.system} className="flex min-w-0 flex-col gap-3 bg-card p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{system.system}</p>
              <p className="text-xs text-muted-foreground">
                {system.admins.length} {system.adminRole?.name ?? 'admin'}
                {system.admins.length === 1 ? '' : 's'}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {system.admins.map((admin) => (
                <li key={admin.id} className="min-w-0">
                  <Link
                    to={`/admin/people/${admin.id}?system=${system.system}`}
                    className="text-sm break-words text-primary underline-offset-4 hover:underline"
                  >
                    {admin.name}
                  </Link>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Since {formatDate(admin.since)}
                    {admin.grantedBy ? ` · by ${admin.grantedBy.name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            {system.temporaryGrants.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {system.temporaryGrants.map((grant) => (
                  <li key={grant.id} className="flex items-start gap-2 text-xs text-foreground">
                    <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {grant.holder.name}, temporary {grant.roleName} until{' '}
                      <span className="tabular-nums">{formatDateTime(grant.expiresAt)}</span>: "{grant.reason}"
                    </span>
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
        <p className="text-sm text-muted-foreground">Nothing needs a look right now.</p>
      ) : (
        <div className={DIVIDED_GRID + ' md:grid-cols-2'}>
          {open.map((group) => (
            <div key={group.title} className="flex min-w-0 flex-col gap-2 bg-card p-4 md:last:odd:col-span-2">
              <p className="text-sm font-semibold text-foreground">
                {group.title} <span className="font-normal text-muted-foreground tabular-nums">({group.count})</span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {group.rows.map((row) => (
                  <li key={row.key} className="text-sm">
                    {row.label} <span className="text-xs text-muted-foreground tabular-nums">{row.detail}</span>
                  </li>
                ))}
              </ul>
              {group.count > group.rows.length && (
                <Link to={group.more} className="text-xs text-primary underline-offset-4 hover:underline">
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
        <p className="text-sm text-muted-foreground">No admin changes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {report.recentAdminChanges.slice(0, RECENT_SHOWN).map((change) => (
            <li key={change.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
              <time dateTime={change.at} className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-32">
                {formatDateTime(change.at)}
              </time>
              <div className="min-w-0 text-sm text-foreground">
                <p className="break-words">
                  <Link
                    to={`/admin/people/${change.user.id}${change.system ? `?system=${change.system}` : ''}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {change.user.name}
                  </Link>
                  {': '}
                  {label(change.type)}
                  {change.system ? ` (${change.system})` : ''}
                  {change.newValue && change.type === 'ROLE_CHANGED' ? `, now ${change.newValue}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {change.actor ? `By ${change.actor.name}` : 'By WeLinc (automatic)'}
                  {change.reason ? ` · "${change.reason}"` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {report.recentAdminChanges.length > RECENT_SHOWN && (
        <Link
          to="/admin/activity?system=all"
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
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
