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
 * Suite spec 0019, AC-3: the three tiles. People opens with the Needs attention group first. The
 * third is the Audit log link for every admin (your call, 2026-11-25: a count of live temporary
 * grants was 0 almost always, so it said little).
 */
const TILES: Tile[] = [
  { path: 'people', label: 'Users need a look', icon: adminView('people').icon, count: (s) => s.needsAttention },
  {
    path: 'deletion-requests',
    label: 'Deletion requests',
    icon: adminView('deletion-requests').icon,
    count: (s) => s.deletionRequests,
  },
  { path: 'activity', label: 'Audit log', icon: adminView('activity').icon, line: 'Sign ins and changes' },
];

const TILE_DARK =
  'flex rounded-xl bg-white/6 text-white inset-ring inset-ring-white/8 transition-colors duration-150 hover:bg-white/11 focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-hidden motion-reduce:transition-none';
/** The large white card's tiles: a soft panel like the page, lifting to the accent tint on hover. */
const TILE_LIGHT =
  'flex rounded-2xl bg-card text-foreground inset-ring inset-ring-border transition duration-200 ease-enter hover:-translate-y-0.5 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

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
  /** The suite admin with no system: a row on the white card (icon, count over label, arrow). */
  large: boolean;
}) {
  const href = viewHref(tile.path, system ? `?system=${system}` : '');
  const Icon = tile.icon;
  const value = tile.count ? (summary ? (tile.count(summary) ?? null) : null) : undefined;
  const spoken = value === undefined ? tile.label : `${tile.label}: ${value ?? 'not available'}`;

  if (large) {
    return (
      <Link to={href} aria-label={spoken} className={cn(TILE_LIGHT, 'group items-center gap-4 p-4 pr-5')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-info-bg text-primary" aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          {value !== undefined ? (
            <>
              <Odometer value={value} delay={delay} tone="light" />
              <span className="min-w-0 text-body leading-snug text-muted-strong">{tile.label}</span>
            </>
          ) : (
            // A link tile (Audit log): its name, then its line
            <>
              <span className="text-group font-semibold text-foreground">{tile.label}</span>
              <span className="text-small text-muted-foreground">{tile.line}</span>
            </>
          )}
        </span>
        <ArrowRight
          className="size-4.5 shrink-0 text-muted-foreground transition duration-150 group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </Link>
    );
  }

  return (
    <Link to={href} aria-label={spoken} className={cn(TILE_DARK, 'h-16 min-w-0 flex-1 items-center gap-3 px-3.5')}>
      <Icon className="size-4.5 shrink-0 text-white/55" aria-hidden="true" />
      {value !== undefined && <Odometer value={value} delay={delay} />}
      <span className="min-w-0 flex-1 text-small leading-snug text-white/75">
        {value === undefined && <b className="block text-group text-white">{tile.label}</b>}
        {value === undefined ? tile.line : tile.label}
      </span>
    </Link>
  );
}

const STRIP = 'rounded-3xl bg-sidebar text-white shadow-pop inset-ring inset-ring-white/12';

/**
 * Suite spec 0019, AC-3 (boards `R30Launcher`, `R37LineArt`): Suite management on the launcher.
 * Beside systems it is one navy strip under the cards; for a suite admin with no system it is a
 * large white card, full width, with the same tiles as rows (your call, 2026-11-25: the band stays
 * the one navy block). The counts come from `/auth/admin/summary`.
 */
export function SuiteEntry({ entry }: { entry: Exclude<Entry, { kind: 'none' }> }) {
  const state = useAdminSummary(true);
  const summary = state.kind === 'ready' ? state.summary : null;
  const tiles = TILES;
  const open = '/admin';

  if (entry.kind === 'card') {
    // A suite admin with no system: a white card like a system card, so the band stays the one navy block
    return (
      <section
        aria-labelledby="suite-management"
        className="flex flex-col gap-5 rounded-3xl bg-card p-6 text-foreground shadow-card sm:px-7 sm:pt-6.5 sm:pb-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-info-bg text-primary" aria-hidden="true">
            <ShieldCheck className="size-6" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="suite-management" className="text-heading font-extrabold tracking-tight">
              Suite management
            </h2>
            <p className="text-body text-muted-strong">{entry.line}</p>
          </div>
          <Link
            to={open}
            className="group/open inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-card px-4 text-body font-semibold text-primary inset-ring inset-ring-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11"
          >
            Open Suite management
            <ArrowRight
              className="size-4 transition-transform duration-150 group-hover/open:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
      className={cn(STRIP, 'flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:pl-5.5')}
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
