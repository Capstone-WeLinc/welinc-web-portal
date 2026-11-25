import type { CSSProperties } from 'react';
import { LiveryTruck } from '@/components/brand/LiveryTruck';
import type { LauncherSystem } from '@/lib/auth';
import { LAUNCH, ms, type LaunchScene } from './launchMotion';

/*
  Suite spec 0019, AC-10 to AC-12: the navy cover a system tile raises while the browser fetches
  the system. Three scenes, one picked at random per launch; the keyframes are in `src/index.css`
  (`launch-*`), run over `--launch-time` (`LAUNCH.total`, set here). Decoration only: `aria-hidden`, no live data, nothing to focus.
*/

/** Launch 2, the dock door (`R29LaunchDock`): the shutter rolls up and the truck pulls away. */
function DockScene() {
  return (
    <div className="flex flex-col items-center">
      <div className="launch-dock relative h-50 w-65 overflow-hidden rounded-t-xl">
        <div className="absolute inset-1.75 overflow-hidden">
          <svg viewBox="0 0 208 158" preserveAspectRatio="xMidYMax slice" className="block size-full" focusable="false">
            <rect width="208" height="158" fill="var(--scene-dock)" />
            <rect width="208" height="104" fill="var(--scene-dock-wall)" />
            <line x1="104" y1="0" x2="104" y2="18" stroke="var(--livery-handle)" strokeWidth="1.5" />
            <path d="M90 18 H118 L124 26 H84 Z" fill="var(--highlight)" />
            <polygon points="84,26 124,26 160,104 48,104" fill="var(--highlight)" fillOpacity="0.1" />
            <polygon points="0,104 208,104 208,158 0,158" fill="var(--scene-road)" />
            <line x1="20" y1="158" x2="58" y2="104" stroke="var(--highlight)" strokeWidth="3" opacity="0.7" />
            <line x1="188" y1="158" x2="150" y2="104" stroke="var(--highlight)" strokeWidth="3" opacity="0.7" />
            {/* The truck's back, seen from the dock */}
            <g className="launch-dock-truck">
              <rect x="56" y="36" width="96" height="88" rx="4" fill="var(--livery-body)" />
              <rect x="56" y="36" width="96" height="10" rx="3" fill="var(--livery-roof)" />
              <line x1="104" y1="46" x2="104" y2="118" stroke="var(--livery-seam)" strokeWidth="2" />
              <rect x="96" y="76" width="4" height="16" rx="1" fill="var(--livery-handle)" />
              <rect x="108" y="76" width="4" height="16" rx="1" fill="var(--livery-handle)" />
              <rect x="52" y="120" width="104" height="8" rx="2" fill="var(--scene-garage)" />
              <rect x="52" y="120" width="104" height="2.5" fill="var(--highlight)" />
              <rect x="58" y="110" width="8" height="6" rx="1" fill="var(--livery-tail)" />
              <rect x="142" y="110" width="8" height="6" rx="1" fill="var(--livery-tail)" />
              <rect x="62" y="128" width="16" height="12" rx="3" fill="var(--scene-garage-door)" />
              <rect x="130" y="128" width="16" height="12" rx="3" fill="var(--scene-garage-door)" />
            </g>
          </svg>
        </div>
        <div className="launch-shutter absolute inset-x-1.75 top-1.75 bottom-0" />
      </div>
      <div className="launch-dock-sill h-3 w-70 rounded-b" />
    </div>
  );
}

/** Launch 3, the route bar (`R31LaunchRoute`): the route draws as the truck leaves the garage for the pin. */
function RouteScene({ code }: { code: string }) {
  return (
    <svg viewBox="0 0 720 120" className="w-full max-w-180" focusable="false">
      <g transform="translate(18 34)">
        <rect x="0" y="12" width="44" height="30" rx="3" fill="var(--scene-garage)" />
        <path d="M-4 14 22 0l26 14z" fill="var(--scene-garage-roof)" />
        <rect x="8" y="24" width="12" height="18" fill="var(--scene-garage-door)" />
        <rect x="24" y="24" width="12" height="18" fill="var(--scene-garage-door)" />
      </g>
      <line x1="70" y1="76" x2="660" y2="76" stroke="var(--white)" strokeOpacity="0.14" strokeWidth="4" strokeLinecap="round" />
      <line className="launch-route-line" x1="70" y1="76" x2="660" y2="76" stroke="var(--highlight)" strokeWidth="4" strokeLinecap="round" />
      <g className="launch-route-truck">
        <g transform="translate(82 52) scale(.42)">
          <LiveryTruck />
        </g>
      </g>
      <g transform="translate(674 28)">
        <path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 34 12 34s12-13.7 12-22.4C24 5.2 18.6 0 12 0z" fill="var(--highlight)" />
        <circle cx="12" cy="11.5" r="4.5" fill="var(--sidebar)" />
      </g>
      <text x="686" y="104" textAnchor="middle" fontSize="12" fill="var(--white)" fillOpacity="0.6">
        {code}
      </text>
    </svg>
  );
}

/** Launch 4, loading (`L28MLoad`): three cartons go in, the doors close and the van pulls away. */
function LoadScene() {
  const cartons = [46, 84, 122];
  return (
    <svg viewBox="0 0 260 95" className="w-full max-w-130 overflow-hidden" focusable="false">
      <line x1="0" y1="84" x2="260" y2="84" stroke="var(--white)" strokeOpacity="0.25" strokeWidth="1.5" />
      <g className="launch-load-truck">
        <rect x="40" y="16" width="120" height="58" rx="3" fill="none" stroke="var(--livery-body)" strokeWidth="2" />
        {cartons.map((x, i) => (
          <rect
            key={x}
            className="launch-carton"
            style={{ '--carton-at': ms(i * LAUNCH.cartonStep) } as CSSProperties}
            x={x}
            y="46"
            width="34"
            height="24"
            rx="2"
            fill="var(--scene-carton)"
            stroke="var(--scene-carton-edge)"
          />
        ))}
        {/* The two side doors swing shut from their hinges once the cartons are in */}
        <rect className="launch-door origin-left" x="41" y="17" width="59" height="56" fill="var(--scene-garage)" stroke="var(--livery-body)" strokeWidth="1" />
        <rect className="launch-door origin-right" x="100" y="17" width="59" height="56" fill="var(--scene-garage)" stroke="var(--livery-body)" strokeWidth="1" />
        <path d="M163 30h22l14 16v28h-36z" fill="var(--highlight)" />
        <path d="M168 35h14l9 11h-23z" fill="var(--sidebar)" />
        <rect x="36" y="72" width="166" height="5" fill="var(--scene-garage)" />
        {[62, 82, 182].map((cx) => (
          <circle key={cx} cx={cx} cy="79" r="7" fill="var(--scene-garage-door)" stroke="var(--scene-post)" strokeWidth="2" />
        ))}
      </g>
    </svg>
  );
}

const COPY: Record<LaunchScene, { eyebrow: string; line: (code: string) => string }> = {
  2: { eyebrow: 'Opening', line: (code) => `Opening ${code}…` },
  3: { eyebrow: 'En route', line: (code) => `Opening ${code}…` },
  4: { eyebrow: 'Opening', line: (code) => `Loading ${code}…` },
};

export function LaunchCover({ system, scene }: { system: LauncherSystem; scene: LaunchScene }) {
  const copy = COPY[scene];
  return (
    <div
      aria-hidden="true"
      data-launch={scene}
      style={{ '--launch-time': ms(LAUNCH.total) } as CSSProperties}
      className="launch-cover fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-sidebar px-6 text-white"
    >
      <p className="text-small font-semibold tracking-widest text-highlight uppercase">{copy.eyebrow}</p>
      <div className="text-center">
        <p className="text-5xl font-extrabold tracking-tight">{system.system}</p>
        <p className="mt-1.5 text-body text-white/70">{system.name}</p>
      </div>
      {scene === 2 && <DockScene />}
      {scene === 3 && <RouteScene code={system.system} />}
      {scene === 4 && <LoadScene />}
      <p className="text-body text-white/85">{copy.line(system.system)}</p>
    </div>
  );
}
