import { cn } from '@/lib/utils';
import { LiveryL300, LiveryVan } from './LiveryTruck';

/*
  Suite spec 0019, AC-1, AC-11 (board `R37LineArt`): the launcher band's line drawing. A warehouse,
  an office with one window lit gold, power lines, a workshop and a water tower with the ///L mark,
  in thin white lines at 34% opacity, over a road. This is the parked scene: two livery trucks
  standing on the road (reduced motion, phones, and the launcher until the motion milestone).
  Decoration only: no data, `aria-hidden`. The coordinates are the board's (1440 by 380 units).
*/

const LINE = { fill: 'none', stroke: 'var(--white)', strokeOpacity: 0.34, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const FAINT = { stroke: 'var(--white)', strokeOpacity: 0.18, strokeWidth: 1 } as const;

/** The warehouse's three roller doors, each with its slats. */
const DOORS = [92, 168, 244];
const SLATS = [98, 105, 112, 119, 126, 133];
/** The office's two rows of four windows; the third on top is lit. */
const WINDOW_X = [392, 419, 446, 473];
const POLES = [560, 760, 1340];

/** Where the two parked trucks stand, on the near lane. */
const PARKED = { van: 600, l300: 1000, top: 112 };
/** How far the road runs past each side of the drawing (a multiple of the 60 unit dash, so the dashes stay in step). */
const ROAD_RUN = 1200;

export function DepotScene({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 -180 1440 380" className={cn('block overflow-visible', className)}>
      {/* Warehouse */}
      <path d="M70 140 V70 L200 44 L330 70 V140" {...LINE} />
      <path d="M70 70 H330" {...LINE} />
      {DOORS.map((x) => (
        <g key={x}>
          <rect x={x} y="92" width="58" height="48" {...LINE} />
          {SLATS.map((y) => (
            <line key={y} x1={x} y1={y} x2={x + 58} y2={y} {...FAINT} />
          ))}
        </g>
      ))}

      {/* Office */}
      <rect x="380" y="62" width="120" height="78" {...LINE} />
      <path d="M372 62 H508" {...LINE} />
      {[74, 104].map((y) =>
        WINDOW_X.map((x) =>
          y === 74 && x === 446 ? (
            <rect key={`${x}${y}`} x={x} y={y} width="17" height="18" fill="var(--highlight)" fillOpacity="0.75" />
          ) : (
            <rect key={`${x}${y}`} x={x} y={y} width="17" height="18" {...LINE} />
          ),
        ),
      )}

      {/* Power lines */}
      {POLES.map((x) => (
        <path key={x} d={`M${x} 140 V38 M${x - 14} 46 H${x + 14} M${x - 10} 56 H${x + 10}`} {...LINE} />
      ))}
      <path d="M546 46 Q660 70 746 46 M574 46 Q660 64 774 46 M774 46 Q1060 92 1354 46 M746 46 Q1040 88 1326 46" fill="none" {...FAINT} />

      {/* Workshop with its saw tooth roof */}
      <path
        d="M880 140 V80 L920 56 L920 80 L960 56 L960 80 L1000 56 L1000 80 L1040 56 L1040 80 L1080 56 L1080 80 L1120 56 L1120 80 L1160 56 L1160 80 V140"
        {...LINE}
      />
      <rect x="910" y="96" width="70" height="44" {...LINE} />
      <rect x="1010" y="96" width="70" height="44" {...LINE} />
      <rect x="1110" y="104" width="40" height="22" {...LINE} />

      {/* Water tower with the mark */}
      <path d="M1210 140 L1222 40 M1262 140 L1250 40 M1214 104 H1258 M1217 76 H1255" {...LINE} />
      <path d="M1206 40 H1266 V12 Q1236 -2 1206 12 Z" {...LINE} />
      <g transform="translate(1226 18) scale(0.06)" fill="var(--highlight)" fillOpacity="0.85">
        <polygon points="82,0 144,0 66,183 4,183" />
        <polygon points="177,0 240,0 162,183 100,183" />
        <polygon points="265,0 328,0 268,140 328,140 328,183 187,183" />
      </g>

      {/* Road */}
      {/* The road runs far past both sides, so it meets the window's edges at any scale; the band clips it */}
      <rect x={-ROAD_RUN} y="140" width={1440 + 2 * ROAD_RUN} height="60" fill="var(--scene-road)" />
      <line x1={-ROAD_RUN} y1="142" x2={1440 + ROAD_RUN} y2="142" stroke="var(--white)" strokeOpacity="0.22" strokeWidth="2" />
      <line
        x1={-ROAD_RUN}
        y1="176"
        x2={1440 + ROAD_RUN}
        y2="176"
        stroke="var(--white)"
        strokeOpacity="0.25"
        strokeWidth="3"
        strokeDasharray="34 26"
      />

      <g transform={`translate(${PARKED.van} ${PARKED.top})`}>
        <LiveryVan />
      </g>
      <g transform={`translate(${PARKED.l300} ${PARKED.top})`}>
        <LiveryL300 />
      </g>
    </svg>
  );
}
