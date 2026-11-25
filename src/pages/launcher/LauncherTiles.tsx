import { forwardRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SuiteMark, SystemMark } from '@/components/brand/SystemMarks';
import type { LauncherSystem } from '@/lib/auth';
import { coversLine, roleTag } from '@/lib/launcher';
import { cn } from '@/lib/utils';

/*
  Suite spec 0019, AC-2 and AC-3 (boards `R69Victor` to `R69Armando`): L1 tiles with N3 text, three
  to a row from 768px up, one per row below it (the phone layout, AC-4). On a phone a tile is a
  row: the icon at the left, the code, the full name and the role beside it, no key cap.
*/
const TILE =
  'group relative flex gap-4 rounded-3xl bg-card p-4 text-left ring-1 ring-border transition duration-200 ease-enter hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring md:h-53 md:short:h-48 md:flex-col md:gap-0 md:p-5.5 md:hover:-translate-y-0.75 motion-reduce:transition-none motion-reduce:md:hover:translate-y-0';

/** The tile's text: the code (or "Suite management"), the mono label, and the bottom line. */
function TileText({ code, label, bottom }: { code: string; label: string; bottom: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col md:contents">
      <span className="text-heading font-extrabold tracking-tight text-sidebar md:mt-4.5 md:text-tile-code">{code}</span>
      <span className="mt-1.5 font-mono text-tile-name text-muted-foreground uppercase md:mt-2.5 xl:truncate">{label}</span>
      <span className="mt-2 text-small md:mt-auto md:pt-2">{bottom}</span>
    </span>
  );
}

/** P5: the tile's number key, top right; hidden on phones, which have no keyboard to press it with. */
function KeyCap({ n }: { n: number }) {
  return (
    <kbd
      aria-hidden="true"
      className="absolute top-5 right-5 hidden h-6.5 min-w-6.5 place-items-center rounded-md bg-background px-1.75 font-mono text-caption font-semibold text-muted-foreground shadow-key md:grid"
    >
      {n}
    </kbd>
  );
}

/**
 * One system: a real link to the system's url (spec 0007, AC-15, AC-16). A plain left click calls
 * `onLaunch` (AC-10); the link still navigates on its own, so the handler never calls
 * `preventDefault`. A click someone already handled, a modifier (new tab or window) or another
 * button keeps the launcher still.
 */
export const SystemTile = forwardRef<
  HTMLAnchorElement,
  {
    system: LauncherSystem;
    n: number;
    here: boolean;
    onLaunch?: (system: LauncherSystem) => void;
    className?: string;
    style?: CSSProperties;
  }
>(function SystemTile({ system, n, here, onLaunch, className, style }, ref) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onLaunch?.(system);
  };
  return (
    <a ref={ref} href={system.url} onClick={onClick} aria-keyshortcuts={String(n)} className={cn(TILE, className)} style={style}>
      <KeyCap n={n} />
      <SystemMark system={system.system} className="max-md:size-11" />
      <TileText
        code={system.system}
        label={system.name}
        bottom={
          <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {roleTag(system)}
            {here && (
              <span className="rounded-full bg-highlight px-2 py-0.5 text-caption font-medium text-highlight-foreground">
                You're here
              </span>
            )}
          </span>
        }
      />
    </a>
  );
});

/** AC-3: Suite management, a white tile like the rest, a route inside the portal (no launch). */
export const SuiteTile = forwardRef<
  HTMLAnchorElement,
  { covers: readonly string[]; n: number; className?: string; style?: CSSProperties }
>(function SuiteTile({ covers, n, className, style }, ref) {
  return (
    <Link ref={ref} to="/admin" aria-keyshortcuts={String(n)} className={cn(TILE, className)} style={style}>
      <KeyCap n={n} />
      <SuiteMark className="max-md:size-11" />
      <TileText
        code="Suite management"
        label="People, roles and access"
        bottom={<span className="font-medium text-muted-foreground">{coversLine(covers)}</span>}
      />
    </Link>
  );
});

/** The small mono "Systems" and "Admin" labels over the tiles. */
export function TileLabel({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <p className={cn('-mb-1 font-mono text-label tracking-widest text-muted-foreground md:-mb-2', className)} style={style}>
      {children}
    </p>
  );
}
