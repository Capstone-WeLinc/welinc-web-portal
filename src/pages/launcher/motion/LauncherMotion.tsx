import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LazyMotion, domAnimation, m, useAnimationFrame, useMotionValue } from 'motion/react';
import { LiveryL300, LiveryTruck, LiveryVan } from '@/components/brand/LiveryTruck';
import { SCENE_VIEWBOX } from '@/components/brand/DepotScene';
import { cn } from '@/lib/utils';
import type { LauncherSystem } from '@/lib/auth';
import { CARD, EASE_ENTER, GREETING, LAUNCH, LOOP_START, ROAD, STRIP, cardAt, loopX, stripAt } from './constants';

/*
  Suite spec 0019, AC-8 to AC-12: everything that moves on the launcher. This file is its own
  chunk (`load.ts`); nothing outside the sign in and launcher screens imports it, so the Admin
  chunk never carries Motion. `LazyMotion` with `domAnimation` and the small `m` components keep
  it to the animation features the launcher uses.
*/

/** The Motion features each moving part brings along (each part wraps itself, so adding one never remounts the page). */
function Features({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

const SCENE_UNITS = 1440;

/** True while the tab is visible and the element is on screen (AC-9: the loop pauses otherwise). */
function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    const el = ref.current;
    let observer: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
      observer.observe(el);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [ref]);
  return visible && inView;
}

/**
 * The trucks on the band's road (AC-9): the van and the L300 loop at the cruising speed. One clock drives every truck and
 * only moves while the band is on screen in a visible tab, so a pause resumes where it stopped.
 * Decoration only: `aria-hidden`, no focus, no data.
 */
export function RoadTrucks({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const running = useOnScreen(svgRef);
  const runningRef = useRef(running);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  const clock = useRef(LOOP_START);
  // How far the band shows past each side of the drawing, in scene units (wide windows)
  const margin = useRef(0);
  const van = useMotionValue(loopX(LOOP_START, 0));
  const l300 = useMotionValue(loopX(LOOP_START, 1));

  useEffect(() => {
    const measure = () => {
      const svg = svgRef.current;
      const band = svg?.parentElement;
      if (!svg || !band) return;
      const width = svg.getBoundingClientRect().width;
      if (width === 0) return;
      const spare = Math.max(0, (band.getBoundingClientRect().width - width) / 2);
      margin.current = (spare * SCENE_UNITS) / width;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useAnimationFrame((_, delta) => {
    if (!runningRef.current) return;
    // Motion's frame loop already caps a frame's delta, so a long gap never jumps the trucks
    clock.current += delta / 1000;
    const t = clock.current;
    van.set(loopX(t, 0, margin.current));
    l300.set(loopX(t, 1, margin.current));
  });

  return (
    <Features>
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        viewBox={SCENE_VIEWBOX}
        data-paused={running ? undefined : ''}
        // Trucks run past the drawing's box to the band's own edges; the band clips them there
        className={cn('block overflow-visible', className)}
      >
        <m.g style={{ x: van }}>
          <g transform={`translate(0 ${ROAD.lane})`}>
            <g className="scene-bob">
              <LiveryVan />
            </g>
          </g>
        </m.g>
        <m.g style={{ x: l300 }}>
          <g transform={`translate(0 ${ROAD.lane})`}>
            <g className="scene-bob">
              <LiveryL300 />
            </g>
          </g>
        </m.g>
      </svg>
    </Features>
  );
}

export type EnterPart = { kind: 'greeting' } | { kind: 'card'; index: number } | { kind: 'strip'; cards: number };

function enterFor(part: EnterPart, still: boolean) {
  // Arrival 1: the greeting rises, the cards and the strip slide in from the left
  const from = part.kind === 'greeting' ? { y: GREETING.rise } : { x: part.kind === 'card' ? CARD.slide : STRIP.slide };
  const delay = part.kind === 'greeting' ? GREETING.at : part.kind === 'card' ? cardAt(part.index) : stripAt(part.cards);
  const duration = part.kind === 'greeting' ? GREETING.duration : part.kind === 'card' ? CARD.duration : STRIP.duration;
  return {
    // AC-11: under reduced motion and on phones the parts only fade in, with no movement
    initial: still ? { opacity: 0 } : { opacity: 0, ...from },
    animate: still ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 },
    transition: { delay, duration, ease: EASE_ENTER },
  };
}

/**
 * A part of the launcher that comes in with Arrival 1 (AC-8, Round 30): the greeting rises, the
 * cards slide in from the left one after another, then the strip. `still` fades only (AC-11).
 */
export function Enter({
  as = 'div',
  part,
  still,
  className,
  children,
}: {
  as?: 'div' | 'li';
  part: EnterPart;
  still: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as === 'li' ? m.li : m.div;
  return (
    <Features>
      <Tag className={className} {...enterFor(part, still)}>
        {children}
      </Tag>
    </Features>
  );
}

/**
 * Launch 3 (AC-10, board `R31LaunchRoute`): a navy cover with the route bar while the browser
 * fetches the system. The route draws in gold as the truck leaves the garage for the pin; the
 * whole of it ends within 900 ms and the page unloads whenever the system answers. `still` is
 * AC-11's fade: the route already drawn, the truck at the garage, 200 ms in.
 */
export function LaunchCover({ system, still }: { system: LauncherSystem; still: boolean }) {
  const drive = {
    delay: LAUNCH.driveAt,
    duration: LAUNCH.drive,
    ease: LAUNCH.ease,
  };
  return (
    <Features>
      <m.div
        aria-hidden="true"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-sidebar px-6 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: LAUNCH.fade, ease: 'easeOut' }}
      >
        <p className="text-small font-semibold tracking-widest text-highlight uppercase">En route</p>
        <div className="text-center">
          <p className="text-5xl font-extrabold tracking-tight">{system.system}</p>
          <p className="mt-1.5 text-body text-white/70">{system.name}</p>
        </div>
        <svg viewBox="0 0 720 120" className="w-full max-w-180" focusable="false">
          <g transform="translate(18 34)">
            <rect x="0" y="12" width="44" height="30" rx="3" fill="var(--scene-garage)" />
            <path d="M-4 14 22 0l26 14z" fill="var(--scene-garage-roof)" />
            <rect x="8" y="24" width="12" height="18" fill="var(--scene-garage-door)" />
            <rect x="24" y="24" width="12" height="18" fill="var(--scene-garage-door)" />
          </g>
          <line
            x1="70"
            y1="76"
            x2="660"
            y2="76"
            stroke="var(--white)"
            strokeOpacity="0.14"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <m.line
            x1="70"
            y1="76"
            x2="660"
            y2="76"
            stroke="var(--highlight)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: still ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={drive}
          />
          <m.g initial={{ x: 0 }} animate={{ x: still ? 0 : LAUNCH.distance }} transition={drive}>
            <g transform="translate(82 52) scale(.42)">
              <LiveryTruck />
            </g>
          </m.g>
          <g transform="translate(674 28)">
            <path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 34 12 34s12-13.7 12-22.4C24 5.2 18.6 0 12 0z" fill="var(--highlight)" />
            <circle cx="12" cy="11.5" r="4.5" fill="var(--sidebar)" />
          </g>
          <text x="686" y="104" textAnchor="middle" fontSize="12" fill="var(--white)" fillOpacity="0.6">
            {system.system}
          </text>
        </svg>
        <p className="text-body text-white/85">Opening {system.system}…</p>
      </m.div>
    </Features>
  );
}
