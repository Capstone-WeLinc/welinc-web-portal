import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { currentSystem, mobileSystemsOf, type LauncherAnswer, type LauncherSystem, type Notice } from '@/lib/auth';
import { useMediaQuery, useReducedMotion } from '@/hooks/useMediaQuery';
import { firstName, greetingFor, orderedSystems, signedInSystems, suiteEntryFor, todayLabel } from '@/lib/launcher';
import { cn } from '@/lib/utils';
import { BAND_SCENE, Greeting, LauncherFrame, SCENE_PLACE } from './LauncherFrame';
import { LAUNCH_GIVE_UP_MS } from './motion/constants';
import { useLauncherMotion } from './motion/load';
import type { EnterPart } from './motion/LauncherMotion';
import { SuiteEntry } from './SuiteEntry';
import { SystemCard } from './SystemCard';

type LauncherProps = {
  answer: LauncherAnswer;
  params: URLSearchParams;
  /** The `error` notice from the address, shown above the cards (AC-13). */
  banner: Notice | null;
  /** Suite spec 0019, AC-8: this tab just signed in through the portal's own form. */
  arrive?: boolean;
};

/** One column on phones, two from 640px, three from 1024px (the phone only and loading states use it too). */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/** Suite spec 0019, AC-2: three or two systems sit in one row; one system is one wide card. */
const ROW: Record<number, string> = {
  2: 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6',
  3: 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3',
};

/**
 * The launcher (spec 0007, AC-15, AC-16; suite spec 0019, AC-1 to AC-4): the navy band with the
 * greeting, a card per system in BMS, VMMS, VRMS order, then Suite management for anyone who
 * administers something. Every address comes from welinc-auth's answer; nothing in the query
 * string decides where a card goes.
 */
export default function Launcher({ answer, params, banner, arrive = false }: LauncherProps) {
  const here = currentSystem(params, answer);
  const name = firstName(answer.user.name);
  const systems = orderedSystems(answer.systems);
  const phoneOnly = mobileSystemsOf(answer);
  const entry = suiteEntryFor(answer);
  const now = new Date();

  // Suite spec 0019, AC-11: reduced motion and phones get the parked scene and fades only
  const reduced = useReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const moving = wide && !reduced;
  const motion = useLauncherMotion(moving || arrive);
  // AC-8: the arrival is decided once, as the launcher shows, and only when the motion is already
  // here (the sign in form fetched it); otherwise the cards are simply in place
  const [arriving] = useState(() => arrive && motion !== null);
  const still = !moving;
  const [launching, setLaunching] = useState<LauncherSystem | null>(null);

  // AC-10: Back from the system can restore this page from the browser's cache with the cover up;
  // a load someone stopped gives the launcher back after a while
  useEffect(() => {
    if (!launching) return;
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLaunching(null);
    };
    window.addEventListener('pageshow', reset);
    const timer = window.setTimeout(() => setLaunching(null), LAUNCH_GIVE_UP_MS);
    return () => {
      window.removeEventListener('pageshow', reset);
      window.clearTimeout(timer);
    };
  }, [launching]);

  const enter = (part: EnterPart, node: ReactNode, as: 'div' | 'li' = 'div', className?: string) => {
    if (!arriving || !motion)
      return as === 'li' ? <li className={className}>{node}</li> : <div className={className}>{node}</div>;
    return (
      <motion.Enter as={as} part={part} still={still} className={className}>
        {node}
      </motion.Enter>
    );
  };

  return (
    <LauncherFrame
      user={answer.user}
      systems={signedInSystems(answer)}
      parked={!(moving && motion)}
      trucks={BAND_SCENE === 'road' && moving && motion ? <motion.RoadTrucks className={SCENE_PLACE} /> : null}
      arrive={arriving && moving}
      greeting={enter(
        { kind: 'greeting' },
        <Greeting
          date={todayLabel(now)}
          title={`${greetingFor(now.getHours())}${name ? `, ${name}` : ''}`}
          line={systems.length === 0 ? 'You manage people and access across the suite.' : 'Pick where you want to work today.'}
        />,
      )}
    >
      {banner && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-card p-4 text-body text-foreground shadow-card">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{banner.message}</p>
        </div>
      )}
      {systems.length > 0 && (
        <section aria-labelledby="launcher-systems">
          <h2 id="launcher-systems" className="sr-only">
            Your systems
          </h2>
          <ul className={cn(ROW[systems.length] ?? 'grid')}>
            {systems.map((system, index) => (
              <Fragment key={system.system}>
                {enter(
                  { kind: 'card', index },
                  <SystemCard
                    system={system}
                    here={here === system.system}
                    wide={systems.length === 1}
                    onLaunch={motion ? setLaunching : undefined}
                  />,
                  'li',
                  'flex',
                )}
              </Fragment>
            ))}
          </ul>
        </section>
      )}
      {phoneOnly.length > 0 && (
        // Suite spec 0014, AC-7: the systems held only on a phone, named quietly
        <p className="text-body text-muted-foreground">On the mobile app: {phoneOnly.map((s) => s.system).join(', ')}</p>
      )}
      {entry.kind !== 'none' && enter({ kind: 'strip', cards: systems.length }, <SuiteEntry entry={entry} />)}
      {launching && motion && <motion.LaunchCover system={launching} still={still} />}
    </LauncherFrame>
  );
}
