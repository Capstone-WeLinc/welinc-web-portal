import { useEffect, useState } from 'react';

/**
 * Suite spec 0019, AC-12: the launcher's motion (Motion, `motion/react`) is its own chunk. The sign
 * in form starts fetching it and the launcher asks for it, so it never rides with the Admin
 * chunk or the first paint. A failed fetch leaves the launcher still: cards in place, parked
 * trucks, every card a working link.
 */
export type LauncherMotionModule = typeof import('./LauncherMotion');

let loaded: LauncherMotionModule | null = null;
let pending: Promise<LauncherMotionModule | null> | null = null;

export function preloadLauncherMotion(): Promise<LauncherMotionModule | null> {
  pending ??= import('./LauncherMotion').then(
    (mod) => (loaded = mod),
    () => {
      // Try again on the next ask (a flaky network on the sign in page)
      pending = null;
      return null;
    },
  );
  return pending;
}

/** The motion chunk once it is here (at once when the sign in already fetched it), else null. */
export function useLauncherMotion(wanted: boolean): LauncherMotionModule | null {
  const [mod, setMod] = useState(loaded);
  useEffect(() => {
    if (!wanted || mod) return;
    let live = true;
    void preloadLauncherMotion().then((next) => {
      if (live && next) setMod(next);
    });
    return () => {
      live = false;
    };
  }, [wanted, mod]);
  return mod;
}
