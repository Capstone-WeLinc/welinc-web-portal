/*
  Suite spec 0019, AC-8, AC-10 to AC-12: every timing the portal's motion uses, copied from the
  boards, not chosen anew. The keyframes they drive are CSS, in `src/index.css` (the `arrive-*`,
  `signin-leave` and `launch-*` blocks); this module sets their durations and delays and keeps the
  JavaScript timers in step with them. All times are milliseconds.
*/

/** The boards' tile curve (`cubic-bezier(.2,.8,.2,1)`, design.md's --ease-enter). */
export const EASE_ENTER = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Arrival A3 (board `R66A3`). Time 0 is the sign in's success: the form holds for 300 ms, then
 * fades out over 250 ms; the heading fades in at 500 ms; the tiles slide in 40 px from the left,
 * 450 ms each, 90 ms apart from 550 ms; the bottom fades in at 900 ms.
 */
export const ARRIVAL = {
  signInHold: 300,
  signInFade: 250,
  headingAt: 500,
  headingFade: 300,
  tileAt: 550,
  tileStep: 90,
  tile: 450,
  slide: 40,
  footerAt: 900,
  footerFade: 400,
} as const;

/** AC-11: under reduced motion (and on phones) a part fades this long, with no movement. */
export const REDUCED_FADE = 200;

/** When the sign in layer has finished fading out and can go. */
export const SIGN_IN_GONE = ARRIVAL.signInHold + ARRIVAL.signInFade;

/** When tile `index` starts sliding in. */
export function tileAt(index: number): number {
  return ARRIVAL.tileAt + ARRIVAL.tileStep * index;
}

/** When the last of `tiles` tiles has landed: keys wait until then (AC-8). */
export function arrivalDone(tiles: number): number {
  return tileAt(Math.max(tiles, 1) - 1) + ARRIVAL.tile;
}

/** When every arriving part, the bottom included, has finished. */
export function arrivalSettled(tiles: number): number {
  return Math.max(arrivalDone(tiles), ARRIVAL.footerAt + ARRIVAL.footerFade);
}

/**
 * The launches (AC-10). Each scene's keyframes are cut from its board's 9 s demo loop (the cover is
 * up from 43 % to 88 % of it, about 4 s) down to 900 ms, keeping the moment the board builds to:
 * Launch 2 the shutter rolls up and the truck pulls away (`R29LaunchDock`), Launch 3 the route
 * draws as the truck drives to the pin (`R31LaunchRoute`), Launch 4 three cartons go in, the doors
 * close and the van pulls away (`L28MLoad`). The cover fades in over 150 ms; under reduced motion
 * it is a 200 ms fade with the scene still (AC-11).
 */
export const LAUNCH = { total: 900, fadeIn: 150, reducedFade: REDUCED_FADE } as const;

export const LAUNCH_SCENES = [2, 3, 4] as const;
export type LaunchScene = (typeof LAUNCH_SCENES)[number];

/** AC-10: one of Launches 2, 3 and 4 at random, never the one that played last. */
export function pickLaunch(last: LaunchScene | null, random: () => number = Math.random): LaunchScene {
  const choices = LAUNCH_SCENES.filter((scene) => scene !== last);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

/*
  The page unloads after every launch, so the last scene's id lives in sessionStorage (the one
  stored value, spec 0019's key invariants: it says nothing about the person or session). A
  refused storage (private mode, a blocked site) falls back to this module, and never stops a
  system from opening.
*/
export const LAST_LAUNCH_KEY = 'welinc.portal.lastLaunch';
let lastInMemory: LaunchScene | null = null;

function asScene(value: string | null): LaunchScene | null {
  const n = Number(value);
  return (LAUNCH_SCENES as readonly number[]).includes(n) ? (n as LaunchScene) : null;
}

export function readLastLaunch(): LaunchScene | null {
  try {
    return asScene(window.sessionStorage.getItem(LAST_LAUNCH_KEY)) ?? lastInMemory;
  } catch {
    return lastInMemory;
  }
}

export function writeLastLaunch(scene: LaunchScene): void {
  lastInMemory = scene;
  try {
    window.sessionStorage.setItem(LAST_LAUNCH_KEY, String(scene));
  } catch {
    // The module copy above is enough until the next page load
  }
}

/** The next launch: picked against the last one, and remembered as the last. */
export function nextLaunch(random: () => number = Math.random): LaunchScene {
  const scene = pickLaunch(readLastLaunch(), random);
  writeLastLaunch(scene);
  return scene;
}

/** Turns a timing into a CSS time for an inline custom property. */
export function ms(value: number): string {
  return `${value}ms`;
}
