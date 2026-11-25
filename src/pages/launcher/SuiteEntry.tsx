import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useAdminSummary, type AdminSummary } from '@/lib/adminSummary';
import type { SuiteEntry as Entry } from '@/lib/launcher';
import { cn } from '@/lib/utils';
import { adminView, viewHref, type AdminViewPath } from '../admin/adminViews';
import { Odometer } from './Odometer';

type Tile = {
  path: AdminViewPath;
  label: string;
  icon: LucideIcon;
  /** The count from the summary, or a plain link (Audit log) when there is none. */
  count?: (summary: AdminSummary) => number | undefined;
  /** A link tile's line under its name. */
  line?: string;
};

/**
 * Suite spec 0019, AC-3: the three tiles. People opens with the Needs attention group first. A
 * suite admin's third tile counts active temporary grants; a system admin's is the Audit log link.
 */
function tilesFor(suiteAdmin: boolean): Tile[] {
  return [
    { path: 'people', label: 'Users need a look', icon: adminView('people').icon, count: (s) => s.needsAttention },
    {
      path: 'deletion-requests',
      label: 'Deletion requests',
      icon: adminView('deletion-requests').icon,
      count: (s) => s.deletionRequests,
    },
    suiteAdmin
      ? {
          path: 'temporary-access',
          label: 'Temporary access',
          icon: adminView('temporary-access').icon,
          count: (s) => s.temporaryGrants,
        }
      : { path: 'activity', label: 'Audit log', icon: adminView('activity').icon, line: 'Sign ins and changes' },
  ];
}

const TILE_FACE =
  'flex rounded-xl bg-white/6 text-white inset-ring inset-ring-white/8 transition-colors duration-150 hover:bg-white/11 focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-hidden motion-reduce:transition-none';

/** One tile, a link built with `viewHref` so a system admin's carries `system=` (AC-3). */
function SuiteTile({
  tile,
  system,
  summary,
  delay,
  large,
}: {
  tile: Tile;
  system: string | null;
  summary: AdminSummary | null;
  delay: number;
  large: boolean;
}) {
  const href = viewHref(tile.path, system ? `?system=${system}` : '');
  const Icon = tile.icon;
  const value = tile.count ? (summary ? (tile.count(summary) ?? null) : null) : undefined;
  const spoken = value === undefined ? tile.label : `${tile.label}: ${value ?? 'not available'}`;
  const icon = <Icon className="size-4.5 shrink-0 text-white/55" aria-hidden="true" />;
  return (
    <Link
      to={href}
      aria-label={spoken}
      className={cn(TILE_FACE, large ? 'flex-col items-start gap-3 p-5' : 'h-16 min-w-0 flex-1 items-center gap-3 px-3.5')}
    >
      {large ? (
        <span className="flex w-full items-center justify-between">
          {icon}
          <ArrowRight className="size-4 text-white/55" aria-hidden="true" />
        </span>
      ) : (
        icon
      )}
      {value !== undefined && <Odometer value={value} delay={delay} />}
      <span className={cn('min-w-0 leading-snug text-white/75', large ? 'text-body' : 'flex-1 text-small')}>
        {value === undefined && <b className="block text-group text-white">{tile.label}</b>}
        {value === undefined ? tile.line : tile.label}
      </span>
    </Link>
  );
}

const PANEL = 'rounded-3xl bg-sidebar text-white shadow-pop inset-ring inset-ring-white/12';

/**
 * Suite spec 0019, AC-3 (boards `R30Launcher`, `R37LineArt`): Suite management on the launcher.
 * Beside systems it is one navy strip under the cards; for a suite admin with no system it is a
 * large card, full width, with the same tiles. The counts come from `/auth/admin/summary`.
 */
export function SuiteEntry({ entry }: { entry: Exclude<Entry, { kind: 'none' }> }) {
  const state = useAdminSummary(true);
  const summary = state.kind === 'ready' ? state.summary : null;
  const tiles = tilesFor(entry.suiteAdmin);
  const open = '/admin';

  if (entry.kind === 'card') {
    return (
      <section aria-labelledby="suite-management" className={cn(PANEL, 'flex flex-col gap-5.5 p-6 sm:px-7 sm:pt-6.5 sm:pb-7')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-highlight" aria-hidden="true">
            <ShieldCheck className="size-6" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="suite-management" className="text-heading font-extrabold tracking-tight">
              Suite management
            </h2>
            <p className="text-body text-white/65">{entry.line}</p>
          </div>
          <Link
            to={open}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-card px-5.5 text-group font-bold text-sidebar transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-hidden"
          >
            Open Suite management
            <ArrowRight className="size-4.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {tiles.map((tile, i) => (
            <SuiteTile key={tile.path} tile={tile} system={entry.system} summary={summary} delay={0.7 + i * 0.25} large />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="suite-management"
      className={cn(PANEL, 'flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:pl-5.5')}
    >
      <div className="flex items-center gap-3.5 lg:w-75 lg:shrink-0">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-highlight" aria-hidden="true">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="suite-management" className="text-subheading font-bold">
            Suite management
          </h2>
          <p className="text-small text-white/60">{entry.line}</p>
        </div>
        <Link
          to={open}
          aria-label="Open Suite management"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-hidden lg:hidden"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:flex lg:flex-1">
        {tiles.map((tile, i) => (
          <SuiteTile key={tile.path} tile={tile} system={entry.system} summary={summary} delay={0.7 + i * 0.25} large={false} />
        ))}
      </div>
      <Link
        to={open}
        aria-label="Open Suite management"
        className="hidden h-16 w-12 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-hidden lg:flex"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </Link>
    </section>
  );
}
