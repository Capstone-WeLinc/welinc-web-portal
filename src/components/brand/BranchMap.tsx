import type { SVGProps } from 'react';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/*
  Suite spec 0019, AC-13 (board `R37SignIn`): the map on the sign in side. Bulacan, Metro Manila
  and Laguna with the three WeLinc branches; small trucks run trips out from each branch to a
  nearby town and come back, never branch to branch. Decoration only: static labels, no data,
  `aria-hidden`. The coordinates are the board's (a 540 by 420 viewBox).
*/

const WHITE = 'var(--white)';

/** Land, Manila Bay's inlet and Laguna de Bay's island are drawn first, under the roads. */
const LAND = [
  '-77.1,288.1 36.0,283.3 77.1,254.0 87.4,224.7 72.0,190.5 56.6,166.0 51.4,136.7 61.7,112.3 102.9,107.4 144.0,117.2 190.3,112.3 221.1,131.9 241.7,151.4 254.6,175.8 262.3,195.3 270.0,212.4 275.1,234.4 277.7,258.8 270.0,268.6 252.0,275.9 231.4,280.8 216.0,288.1 205.7,297.9 180.0,307.7 159.4,341.9 138.9,356.5 87.4,366.3 -77.1,351.6',
  '313.7,239.3 349.7,236.9 365.1,244.2 380.6,268.6 406.3,258.8 432.0,254.0 447.4,278.4 452.6,322.3 478.3,302.8 504.0,293.0 534.9,312.6 504.0,361.4 468.0,390.7 426.9,410.2 401.1,415.1 370.3,390.7 349.7,361.4 344.6,346.7 329.1,332.1 316.3,317.4 308.6,293.0 313.7,263.7',
];
const ISLAND = '390.9,283.3 411.4,288.1 421.7,317.4 406.3,332.1 390.9,317.4';
const RIVER = 'M316.3 239.3 L321.4 224.7 L308.6 217.3 L293.1 212.4 L277.7 210.0 L264.9 207.6';

/** Roads: [path, white opacity, width]. The two highways are the strong lines. */
const ROADS: [string, number, number][] = [
  ['M324.0 156.3 L324.0 185.6 L318.9 214.9 L308.6 239.3 L303.4 254.0', 0.08, 2],
  ['M329.1 190.5 L365.1 195.3 L396.0 205.1', 0.08, 2],
  ['M257.1 273.5 L252.0 337.0 L262.3 385.8 L267.4 424.9', 0.08, 2],
  ['M108.0 -29.3 L174.9 29.3 L200.6 58.6 L226.3 87.9 L246.9 107.4 L264.9 136.7 L275.1 156.3 L282.9 177.3', 0.2, 4],
  ['M282.9 177.3 L293.1 205.1 L293.1 234.4', 0.14, 3],
  ['M293.1 234.4 L303.4 258.8 L306.0 293.0 L311.1 322.3 L329.1 351.6 L349.7 376.0 L365.1 410.2 L385.7 449.3', 0.2, 4],
];

type Label = { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' };

const HIGHWAYS: Label[] = [
  { x: 211, y: 22, text: 'NLEX' },
  { x: 298, y: 308, text: 'SLEX', anchor: 'end' },
];
const SEAS: Label[] = [
  { x: 491, y: 310, text: 'LAGUNA' },
  { x: 491, y: 322, text: 'DE BAY' },
];
const PROVINCES: Label[] = [
  { x: 77, y: 44, text: 'PAMPANGA' },
  { x: 396, y: 20, text: 'BULACAN' },
  { x: 447, y: 151, text: 'RIZAL' },
  { x: 180, y: 391, text: 'CAVITE' },
  { x: 509, y: 408, text: 'LAGUNA' },
];
const TOWNS: Label[] = [
  { x: 194, y: 99, text: 'Malolos' },
  { x: 270, y: 152, text: 'Meycauayan' },
  { x: 314, y: 114, text: 'San Jose del Monte' },
  { x: 297, y: 172, text: 'Quezon City', anchor: 'end' },
  { x: 296, y: 218, text: 'Manila' },
  { x: 317, y: 243, text: 'BGC' },
  { x: 363, y: 155, text: 'Rodriguez' },
  { x: 258, y: 350, text: 'Dasmariñas' },
  { x: 368, y: 413, text: 'Calamba' },
  { x: 278, y: 399, text: 'Silang' },
  { x: 311, y: 306, text: 'Alabang' },
];

/** One trip: the route out, the drop point at its end, and the round trip's length and offset (s). */
type Trip = { d: string; drop: [number, number]; dur: number; begin: number };

const TRIPS: Trip[] = [
  { d: 'M205 58 Q199 74 186 86', drop: [181.5, 81.5], dur: 9, begin: -1.4 },
  { d: 'M205 58 Q243 92 262 139', drop: [257.5, 134.5], dur: 12, begin: -4.2 },
  { d: 'M205 58 Q261 67 306 101', drop: [301.5, 96.5], dur: 10, begin: -6.9 },
  { d: 'M336 186 Q318 181 305 168', drop: [300.5, 163.5], dur: 10, begin: -4.7 },
  { d: 'M336 186 Q314 201 288 205', drop: [283.5, 200.5], dur: 13, begin: -7.4 },
  { d: 'M336 186 Q328 211 309 230', drop: [304.5, 225.5], dur: 11, begin: -10.1 },
  { d: 'M336 186 Q340 162 355 142', drop: [350.5, 137.5], dur: 9, begin: -12.8 },
  { d: 'M332 357 Q289 357 250 337', drop: [245.5, 332.5], dur: 11, begin: -8.9 },
  { d: 'M332 357 Q351 375 360 400', drop: [355.5, 395.5], dur: 9, begin: -11.6 },
  { d: 'M332 357 Q304 379 270 386', drop: [265.5, 381.5], dur: 12, begin: -14.3 },
  { d: 'M332 357 Q310 328 303 293', drop: [298.5, 288.5], dur: 10, begin: -17.0 },
];

/** The three real branches (the VRMS and VMMS seeds), with their label plates. */
const BRANCHES = [
  { cx: 205, cy: 58, plateWidth: 102, name: 'Pulilan', area: 'Bulacan branch' },
  { cx: 336, cy: 186, plateWidth: 134, name: 'Marikina', area: 'Metro Manila branch' },
  { cx: 332, cy: 357, plateWidth: 95, name: 'Sta. Rosa', area: 'Laguna branch' },
];

const FADE = 'radial-gradient(ellipse 50% 50% at 50% 50%, var(--black) 60%, transparent 100%)';

function Labels({ items, ...props }: { items: Label[] } & SVGProps<SVGTextElement>) {
  return items.map((item) => (
    <text key={`${item.text}${item.x}`} x={item.x} y={item.y} textAnchor={item.anchor ?? 'middle'} {...props}>
      {item.text}
    </text>
  ));
}

/** A small truck seen from above: white box, gold cab. Placed at 0,0 for `animateMotion`. */
function MapTruck() {
  return (
    <>
      <rect x="-6" y="-4" width="12" height="8" rx="2" fill="var(--livery-body)" stroke="var(--sidebar)" strokeWidth="1.2" />
      <rect x="3" y="-4" width="4" height="8" rx="1" fill="var(--highlight)" />
    </>
  );
}

export function BranchMap({ className }: { className?: string }) {
  // Reduced motion: the trucks wait at their drop points instead of driving
  const still = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 540 420"
      className={cn('block', className)}
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      <rect width="540" height="420" fill="var(--scene-water)" />
      {LAND.map((points) => (
        <polygon key={points.slice(0, 12)} points={points} fill="var(--scene-land)" stroke="var(--scene-coast)" strokeOpacity="0.25" />
      ))}
      <polygon points={ISLAND} fill="var(--scene-water)" />
      <path d={RIVER} fill="none" stroke="var(--scene-land)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {ROADS.map(([d, opacity, width]) => (
        <path key={d.slice(0, 14)} d={d} fill="none" stroke={WHITE} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      <g fontWeight="700">
        <Labels items={HIGHWAYS} fontSize="9.5" letterSpacing="1.5" fill={WHITE} fillOpacity="0.4" />
        <text x="129" y="205" textAnchor="middle" fontSize="10" letterSpacing="2" fontStyle="italic" fill="var(--scene-sea)" fillOpacity="0.45">
          MANILA BAY
        </text>
        <Labels items={SEAS} fontSize="9.5" letterSpacing="2" fontStyle="italic" fill="var(--scene-sea)" fillOpacity="0.5" />
        <Labels items={PROVINCES} fontSize="10" letterSpacing="1.5" fill={WHITE} fillOpacity="0.28" />
        <text x="28" y="195" fontSize="9" letterSpacing="1.5" fill={WHITE} fillOpacity="0.28">
          BATAAN
        </text>
      </g>
      <Labels items={TOWNS.map((t) => ({ ...t, anchor: t.anchor ?? 'start' }))} fontSize="9.5" fill={WHITE} fillOpacity="0.42" />

      <g stroke={WHITE} strokeOpacity="0.5" strokeWidth="2">
        <line x1="24" y1="400" x2="73" y2="400" />
        <line x1="24" y1="396" x2="24" y2="401" />
        <line x1="73" y1="396" x2="73" y2="401" />
      </g>
      <text x="80" y="404" fontSize="9.5" fill={WHITE} fillOpacity="0.5">
        10 km
      </text>
      <path d="M516 22 l6 16 -6 -4 -6 4z" fill={WHITE} fillOpacity="0.55" />
      <text x="516" y="52" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={WHITE} fillOpacity="0.55">
        N
      </text>

      {TRIPS.map((trip) => (
        <g key={trip.d}>
          <path d={trip.d} fill="none" stroke={WHITE} strokeOpacity="0.28" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
          <rect x={trip.drop[0]} y={trip.drop[1]} width="9" height="9" rx="2" fill="var(--scene-post)" />
          {still ? (
            <g transform={`translate(${trip.drop[0] + 4.5} ${trip.drop[1] - 6})`}>
              <MapTruck />
            </g>
          ) : (
            <g>
              <MapTruck />
              {/* Out, a short stop at the drop point, back, and a short stop at the branch */}
              <animateMotion
                dur={`${trip.dur}s`}
                begin={`${trip.begin}s`}
                repeatCount="indefinite"
                path={trip.d}
                keyPoints="0;1;1;0;0"
                keyTimes="0;.38;.5;.88;1"
                calcMode="linear"
              />
            </g>
          )}
        </g>
      ))}

      {BRANCHES.map((b) => (
        <g key={b.name}>
          <circle cx={b.cx} cy={b.cy} r="17" fill="var(--sidebar)" stroke={WHITE} strokeWidth="3" />
          <path
            d={`M${b.cx - 8} ${b.cy + 6} V${b.cy - 2} L${b.cx} ${b.cy - 8} L${b.cx + 8} ${b.cy - 2} V${b.cy + 6} Z M${b.cx - 4} ${b.cy + 6} V${b.cy + 1} H${b.cx + 4} V${b.cy + 6}`}
            fill="none"
            stroke="var(--highlight)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect x={b.cx + 20} y={b.cy - 17} width={b.plateWidth} height="38" rx="8" fill="var(--sidebar)" opacity="0.9" />
          <text x={b.cx + 26} y={b.cy - 1} fontSize="14" fontWeight="700" fill={WHITE}>
            {b.name}
          </text>
          <text x={b.cx + 26} y={b.cy + 15} fontSize="11.5" fill={WHITE} fillOpacity="0.6">
            {b.area}
          </text>
        </g>
      ))}
    </svg>
  );
}
