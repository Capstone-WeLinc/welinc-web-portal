import type { CSSProperties, ReactNode } from 'react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { LogoMark } from '@/components/LogoMark';
import { CrashBoundary } from '@/components/monitoring/CrashBoundary';
import type { LauncherAnswer } from '@/lib/auth';
import { AccountMenu } from './LauncherShell';
import { ARRIVAL, ms } from './launchMotion';

/** AC-8: with the arrival, the bottom fades in last, as `R66A3` does. */
const FOOTER_ARRIVE = { '--arrive-at': ms(ARRIVAL.footerAt), '--arrive-for': ms(ARRIVAL.footerFade) } as CSSProperties;

/** The launcher's column: 1200px of tiles (three of 384px, 24px apart) inside 40px sides. */
export const LAUNCHER_COLUMN = 'mx-auto w-full max-w-320 px-6 md:px-10';

/**
 * K3a (Round 63, as drawn on `R69Corazon`): six line drawn cartons stacked at the bottom right, light navy ink with soft gold
 * tape, no labels. Decoration only.
 */
function Cartons({ className }: { className?: string }) {
  const boxes: [number, number, number, number][] = [
    [0, 250, 170, 128],
    [176, 250, 170, 128],
    [352, 274, 130, 104],
    [70, 136, 150, 112],
    [226, 150, 136, 98],
    [140, 50, 120, 84],
  ];
  return (
    <svg viewBox="-2 48 488 332" fill="none" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" className={className}>
      {boxes.map(([x, y, w, h]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={w} height={h} rx="3" className="stroke-sidebar/12" />
          {/* The picked board draws the tape 88 units long down each carton's face */}
          <rect x={x + w * 0.4} y={y} width={w * 0.2} height={88} className="fill-highlight/16 stroke-highlight/30" />
          <path d={`M${x} ${y + 8}H${x + w}`} className="stroke-sidebar/12" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The launcher's page (suite spec 0019, AC-1, AC-4; boards `R69Victor` to `R69Armando`). Q1: one
 * 88px navy band that is the whole navbar (logo A with "Operations Workspace", the account button),
 * with M1, the mark drawn large and faint at its right. Then the tiles. At the bottom the cartons
 * stand on a still hairline over "WeLinc Logistics" and "EST. 2018". No greeting, no date, no
 * vehicles, no help button. On phones (AC-4) the band is 64px, "Operations Workspace" hides, the
 * cartons shrink and keep their own room, and the page may scroll.
 */
export function LauncherFrame({
  user,
  systems,
  arrive = false,
  children,
}: {
  user?: LauncherAnswer['user'];
  /** The person's own systems, named in the Sign out dialog. */
  systems?: readonly string[];
  /** Suite spec 0019, AC-8: the arrival is playing. */
  arrive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="launcher-band relative h-16 shrink-0 overflow-hidden text-white md:h-22">
        <LogoMark className="launcher-mark h-75 max-md:hidden" />
        <header className={`relative z-10 flex h-full items-center gap-4 ${LAUNCHER_COLUMN}`}>
          {/* You are already Home here, so the logo is not a link */}
          <span className="flex min-w-0 items-center gap-2.5">
            <BrandLockup />
            <span className="ml-0.5 border-l border-white/18 pl-3 text-body font-medium whitespace-nowrap text-white/60 max-sm:hidden">
              Operations Workspace
            </span>
          </span>
          <span className="flex-1" />
          {user && <AccountMenu user={user} systems={systems} showName />}
        </header>
      </div>
      <main className={`relative z-10 flex flex-col gap-5 pt-6 pb-6 md:pt-9 md:short:pt-6 ${LAUNCHER_COLUMN}`}>
        {/* VRMS spec 0025, AC-7: a crash here keeps the band */}
        <CrashBoundary variant="page">{children}</CrashBoundary>
      </main>
      <footer className={arrive ? 'arrive-fade relative mt-auto' : 'relative mt-auto'} style={arrive ? FOOTER_ARRIVE : undefined}>
        <div className={`relative h-24 md:h-0 ${LAUNCHER_COLUMN}`}>
          <Cartons className="absolute right-6 bottom-0 h-20 w-auto md:right-10 md:h-50" />
        </div>
        <div className="border-t border-border">
          <div className={`flex h-14 items-center justify-between text-small ${LAUNCHER_COLUMN}`}>
            <span className="font-bold text-foreground">WeLinc Logistics</span>
            <span className="font-mono text-label tracking-widest text-muted-foreground">EST. 2018</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
