/*
  Suite spec 0019, AC-8, AC-9, AC-12: the launcher's motion, copied from board `R37LineArt` (the
  newest board that plays the road), not chosen anew. Time 0 is the moment the launcher shows.
  Distances are the scene's units (1440 wide, as `DepotScene`); at 1440 px
  one unit is one pixel.
*/

/** The boards' card curve (`cubic-bezier(.2,.8,.2,1)`, design.md's --ease-enter). */
export const EASE_ENTER = [0.2, 0.8, 0.2, 1] as const;

/** Greeting: rises 8 units and fades in as the scene starts. */
export const GREETING = { at: 0, duration: 0.36, rise: 8 } as const;

/*
  Arrival 1, faster (Round 30, your pick on 2026-11-25 in place of Arrival 2): the branches appear,
  their routes come in, then the cards slide in from the left with `R30Launcher`'s own card rule
  (`.arrive`: 0.5 s, 36 units, the cards 0.08 s apart, the strip 0.25 s after the first card).
  The branch and route timing lives with the map (`BranchMap`, `arrive`), as CSS.
*/
export const CARD = { at: 0.6, step: 0.08, duration: 0.5, slide: -36 } as const;
export const STRIP = { after: 0.25, duration: 0.5, slide: -36 } as const;

/** When the card at `index` starts sliding in. */
export function cardAt(index: number): number {
  return CARD.at + CARD.step * index;
}

/** When the strip starts: 0.25 s after the first card (or in the first card's slot when there are none). */
export function stripAt(cards: number): number {
  return cards === 0 ? CARD.at : CARD.at + STRIP.after;
}

/** The road: trucks run from just off its left end to just off its right end. */
export const ROAD = { from: -160, to: 1640, lane: 112 } as const;
/** The loop's cruising speed, units a second (AC-9, about 150 px/s). */
export const CRUISE = 150;

/**
 * The loop (board `amt`): the 10 ft van, then the L300 half a lap behind. A lap is 12 s at 1440
 * wide; the van sets off first.
 */
export const LOOP = { vanAt: 4.34, trucks: 2 } as const;

/**
 * The loop truck `slot` (0 the van, 1 the L300) at time `t`. `margin` is how far the band shows
 * past each side of the 1440 unit drawing (a window wider than the scene), so trucks start and
 * end out of sight there too; the lap grows with it and the speed stays the cruise.
 */
export function loopX(t: number, slot: number, margin = 0): number {
  const from = ROAD.from - margin;
  const lap = (ROAD.to - ROAD.from + 2 * margin) / CRUISE;
  const start = LOOP.vanAt - margin / CRUISE + (slot * lap) / LOOP.trucks;
  if (t < start) return from;
  return from + CRUISE * ((t - start) % lap);
}

/** The loop's clock starts as the van sets off. */
export const LOOP_START = LOOP.vanAt;

/** Launch 3 (board `R31LaunchRoute`, cut to AC-10's 900 ms): fade in, then the route draws as the truck drives. */
export const LAUNCH = {
  fade: 0.2,
  driveAt: 0.1,
  drive: 0.7,
  distance: 538,
  ease: [0.45, 0, 0.2, 1],
} as const;
/** If the system never answers (a stopped load), the launcher comes back after this long. */
export const LAUNCH_GIVE_UP_MS = 10_000;
