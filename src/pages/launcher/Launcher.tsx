import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { currentSystem, mobileSystemsOf, type LauncherAnswer, type LauncherSystem, type Notice } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { keyTarget, openRequest, orderedSystems, signedInSystems, suiteTileFor, withoutLaunchParams } from '@/lib/launcher';
import { notifyError } from '@/lib/notify';
import { LauncherFrame } from './LauncherFrame';
import { SuiteTile, SystemTile, TileLabel } from './LauncherTiles';
import { LaunchCover } from './LaunchCover';
import { ARRIVAL, arrivalDone, arrivalSettled, launchHold, ms, nextLaunch, openSystem, tileAt, type LaunchScene } from './launchMotion';

type LauncherProps = {
  answer: LauncherAnswer;
  params: URLSearchParams;
  /** The `error` notice from the address, shown above the tiles (AC-13). */
  banner: Notice | null;
  /** Suite spec 0019, AC-8: this tab just signed in through the portal's own form. */
  arrive?: boolean;
  /** AC-10: a system tile was opened by a plain click or its key (the launcher plays the launch itself). */
  onLaunch?: (system: LauncherSystem) => void;
};

/** One column on phones, two from 640px, three from 1024px (the phone only state uses it). */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/*
  Suite spec 0019, AC-2, AC-3: where each part sits from 768px up, by how many systems there are.
  "Systems" spans the system tiles and "Admin" sits over the next column; with three systems the
  "Admin" label and its tile wrap to their own rows. Phones take the parts in page order.
*/
const PLACE = {
  systemsLabel: { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3' },
  adminLabel: { 1: 'md:col-start-2 md:row-start-1', 2: 'md:col-start-3 md:row-start-1', 3: 'md:col-span-3 md:row-start-3 md:mt-3' },
  suite: { 0: '', 1: 'md:row-start-2', 2: 'md:row-start-2', 3: 'md:col-start-1 md:row-start-4' },
} as const;

/** AC-8: an arriving part's timing, as the custom properties its `arrive-*` class reads. */
function arriveAt(at: number, duration: number): CSSProperties {
  return { '--arrive-at': ms(at), '--arrive-for': ms(duration) } as CSSProperties;
}
const HEADING = arriveAt(ARRIVAL.headingAt, ARRIVAL.headingFade);
const tileTiming = (i: number) => arriveAt(tileAt(i), ARRIVAL.tile);

/** The launch cover for a system; with no scene this time the system still opens after the same wait. */
function coverFor(system: LauncherSystem): { system: LauncherSystem; scene: LaunchScene } | null {
  try {
    return { system, scene: nextLaunch() };
  } catch {
    return null;
  }
}

/** A key press is not for the launcher while focus is in a text field or a menu or dialog is open. */
function keyIsBusy(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  return document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"]') !== null;
}

/**
 * The launcher (spec 0007, AC-15, AC-16; suite spec 0019, AC-1 to AC-4): a tile per system in BMS,
 * VMMS, VRMS order, then Suite management for anyone who administers something, each with its
 * number key. Every address comes from welinc-auth's answer; nothing in the query string decides
 * where a tile goes.
 */
export default function Launcher({ answer, params, banner, arrive = false, onLaunch }: LauncherProps) {
  const here = currentSystem(params, answer);
  const systems = orderedSystems(answer.systems);
  const phoneOnly = mobileSystemsOf(answer);
  const suite = suiteTileFor(answer);
  const labelled = suite !== null && systems.length > 0;
  const count = (Math.min(systems.length, 3) || 0) as 0 | 1 | 2 | 3;
  const tiles = useRef<(HTMLAnchorElement | null)[]>([]);
  const total = systems.length + (suite ? 1 : 0);

  // AC-8: the arrival is read once, as the launcher shows; its classes come off once the last tile
  // lands, so the tiles' own hover lift works again (a finished animation would hold `transform`)
  const [arriving, setArriving] = useState(arrive);
  const [keysWait, setKeysWait] = useState(arrive);
  const [timing] = useState(() => ({ keys: arrivalDone(total), settled: arrivalSettled(total) }));
  useEffect(() => {
    if (!arrive) return;
    const keys = window.setTimeout(() => setKeysWait(false), timing.keys);
    const settled = window.setTimeout(() => setArriving(false), timing.settled);
    return () => {
      window.clearTimeout(keys);
      window.clearTimeout(settled);
    };
    // Read once, as the launcher shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AC-10: the launch cover over a system that is opening. The click is held while the scene plays,
  // then the system opens; the cover stays up until the system's page replaces this one. Back from
  // the system resets it.
  // VRMS spec 0027, AC-13: `?open=<SYSTEM>` (a system switcher's link) starts that card's handoff at
  // once, so its cover is up from the first frame; read once, before `from`.
  const [request] = useState(() => openRequest(params, systems));
  const [launching, setLaunching] = useState<{ system: LauncherSystem; scene: LaunchScene } | null>(() =>
    request && 'system' in request ? coverFor(request.system) : null,
  );
  const opening = useRef<number | null>(null);
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (opening.current !== null) window.clearTimeout(opening.current);
      opening.current = null;
      setLaunching(null);
    };
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('pageshow', reset);
      if (opening.current !== null) window.clearTimeout(opening.current);
    };
  }, []);
  const startLaunch = (system: LauncherSystem) => {
    // One launch at a time: a second click or key while one plays does nothing
    if (opening.current !== null) return;
    setLaunching(coverFor(system));
    opening.current = window.setTimeout(() => openSystem(system.url), launchHold());
    onLaunch?.(system);
  };
  const launch = (system: LauncherSystem, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    startLaunch(system);
  };

  // AC-13: the opening itself (the cover is already up), or the toast for a system this person
  // can't open. A ref, so React's double effect in development never opens twice. Then `open` and
  // `from` leave the address; `from` already marked its card for this visit.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (params.has('open') || params.has('from')) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${withoutLaunchParams(window.location.search)}`);
    }
    if (!request) return;
    if ('denied' in request) {
      notifyError(`You can’t open ${request.denied} with this account. Pick a system below.`);
      return;
    }
    opening.current = window.setTimeout(() => openSystem(request.system.url), launchHold());
    onLaunch?.(request.system);
    // Read once, as the launcher shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AC-2 (P5): a digit opens its tile exactly as a click would, by clicking it. Keys wait while the
  // arrival plays (AC-8) and while a launch is up
  const busy = keysWait || launching !== null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = keyTarget(event, total);
      if (index === null || busy || keyIsBusy(event)) return;
      event.preventDefault();
      tiles.current[index]?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, busy]);

  return (
    <LauncherFrame user={answer.user} systems={signedInSystems(answer)} arrive={arriving}>
      {/* The band holds no heading, so the page's one h1 is for screen readers */}
      <h1 className="sr-only">Home</h1>
      {banner && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-card p-4 text-body text-foreground shadow-card">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{banner.message}</p>
        </div>
      )}
      {total > 0 && (
        <section aria-labelledby="launcher-systems">
          <div className={cn('mb-4 flex items-baseline gap-3', arriving && 'arrive-fade')} style={arriving ? HEADING : undefined}>
            <h2 id="launcher-systems" className="text-group font-bold text-foreground">
              Your systems
            </h2>
            <span className="font-mono text-caption font-semibold text-muted-foreground">{systems.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
            {labelled && (
              <TileLabel className={cn(PLACE.systemsLabel[count as 1 | 2 | 3], arriving && 'arrive-fade')} style={arriving ? HEADING : undefined}>
                Systems
              </TileLabel>
            )}
            {systems.map((system, i) => (
              <SystemTile
                key={system.system}
                ref={(node) => {
                  tiles.current[i] = node;
                }}
                system={system}
                n={i + 1}
                here={here === system.system}
                onLaunch={launch}
                className={cn(labelled && 'md:row-start-2', arriving && 'arrive-deal')}
                style={arriving ? tileTiming(i) : undefined}
              />
            ))}
            {labelled && (
              <TileLabel className={cn(PLACE.adminLabel[count as 1 | 2 | 3], arriving && 'arrive-fade')} style={arriving ? HEADING : undefined}>
                Admin
              </TileLabel>
            )}
            {suite && (
              <SuiteTile
                ref={(node) => {
                  tiles.current[systems.length] = node;
                }}
                covers={suite.covers}
                n={systems.length + 1}
                className={cn(labelled && PLACE.suite[count], arriving && 'arrive-deal')}
                style={arriving ? tileTiming(systems.length) : undefined}
              />
            )}
          </div>
        </section>
      )}
      {phoneOnly.length > 0 && (
        // Suite spec 0014, AC-7: the systems held only on a phone, named quietly
        <p className="text-body text-muted-foreground">On the mobile app: {phoneOnly.map((s) => s.system).join(', ')}</p>
      )}
      {launching && <LaunchCover system={launching.system} scene={launching.scene} />}
    </LauncherFrame>
  );
}
