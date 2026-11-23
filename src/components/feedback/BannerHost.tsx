import { useEffect, useRef, useState } from 'react';
import { Clock, Wifi, WifiOff } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { useConnection } from '@/lib/connection/connection';
import { clockGap, serverNow, staySignedIn, useSigningOut, type SigningOut } from '@/lib/sessionWatch/watch';
import { ANNOUNCE_AGAIN_MS, countdown, spokenTimeLeft } from '@/lib/sessionWatch/timing';

/**
 * Suite spec 0016 AC-12: the portal's one floating banner, top center, above the toasts. Offline
 * shows on top; signing out soon (AC-12b, only while the signed in launcher or Admin runs the
 * session watch) shows under it, never hidden by it; "Back online" shows for 4 seconds when
 * neither is up. The no access note is VRMS
 * only: the portal's Admin views send you to their landing view on their own.
 */
export function BannerHost() {
  const { offline, backOnlineUntil } = useConnection();
  const signingOut = useSigningOut();
  const offlineBanner = offline ? (
    <Banner kind="warning" icon={WifiOff} title="You're offline">
      Changes won't save until the connection is back. We keep trying.
    </Banner>
  ) : null;
  // AC-12b: the signing out card never hides behind the offline banner; it shows under it
  const signingOutBanner = signingOut ? <SigningOutBanner state={signingOut} /> : null;
  const backOnline = !offline && !signingOut && backOnlineUntil !== null
    ? <Banner kind="success" icon={Wifi} title="Back online" />
    : null;
  return (
    // Top center of the content area: AdminShell sets --content-left to its sidebar's width. The
    // signing out banner speaks through its own line, so its ticking time stays silent.
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-2 pt-4 md:left-(--content-left) md:px-4">
      <div aria-live="polite" className="flex justify-center">
        {offlineBanner}
        {backOnline}
      </div>
      <div aria-live="off" className="flex justify-center">
        {signingOutBanner}
      </div>
    </div>
  );
}

/**
 * Signing out soon (suite spec 0016, AC-12, AC-12b). It never takes focus. **Stay signed in** is
 * its only control; at the 12 hour end (or when Stay signed in finds the cutoff didn't move) the
 * text says it can't be extended, shows the time, and has no action. Screen readers hear the
 * minutes left once and again at 30 seconds; the ticking time is hidden from them, and the switch
 * to the 12 hour text is not announced again. Counted on welinc-auth's clock.
 */
function SigningOutBanner({ state }: { state: SigningOut }) {
  const left = useServerTimeLeft(state.cutoff);
  const spoken = useSpokenTimeLeft(left);
  // The cutoff is on the server's clock; shown as this browser's local time
  const endsAt = new Date(state.cutoff - clockGap()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <Banner
      kind="warning"
      icon={Clock}
      announce={false}
      title={state.cannotExtend ? `Signing out at ${endsAt}` : 'Signing out soon'}
      action={state.cannotExtend ? undefined : { label: 'Stay signed in', onClick: () => void staySignedIn(), loading: state.busy }}
    >
      {state.cannotExtend
        ? "This session reached its 12 hour limit and can't be extended. Save your work, then sign in again. "
        : "You haven't done anything for a while. "}
      <span aria-hidden="true" className="font-mono font-medium text-foreground">
        {countdown(left)}
      </span>
      <span role="status" className="sr-only">
        {spoken}
      </span>
    </Banner>
  );
}

/** Milliseconds left to a cutoff on the server's clock, updated once a second. */
function useServerTimeLeft(cutoff: number): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(tick);
  }, []);
  return cutoff - now;
}

/**
 * The line a screen reader hears: empty on the first render, then set, so the live region exists
 * before its text arrives and the text is read; set again once at 30 seconds.
 */
function useSpokenTimeLeft(left: number): string {
  const [spoken, setSpoken] = useState('');
  const saidAgain = useRef(false);
  const first = useRef(left);
  useEffect(() => {
    setSpoken(spokenTimeLeft(first.current));
  }, []);
  useEffect(() => {
    if (saidAgain.current || first.current <= ANNOUNCE_AGAIN_MS || left > ANNOUNCE_AGAIN_MS) return;
    saidAgain.current = true;
    setSpoken(spokenTimeLeft(ANNOUNCE_AGAIN_MS));
  }, [left]);
  return spoken;
}
