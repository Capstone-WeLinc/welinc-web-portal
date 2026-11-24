import { useEffect, useRef, useState } from 'react';
import { Toast } from '@/components/ui/toast';
import { dismissSessionToast, showSessionToast } from '@/lib/notify';
import { ANNOUNCE_AGAIN_MS, countdown, spokenTimeLeft } from '@/lib/sessionWatch/timing';
import { clockGap, serverNow, staySignedIn, useSigningOut, type SigningOut } from '@/lib/sessionWatch/watch';

/**
 * Suite spec 0019, AC-25: shows the session warning toast while the session watch says signing
 * out is near, and takes it away when the watch closes it (Stay signed in worked, a check found the
 * cutoff moved, or the tab left). The timing is suite spec 0016 AC-12, AC-12a and AC-12b, unchanged.
 */
export function SessionToastHost() {
  const open = useSigningOut() !== null;
  useEffect(() => {
    if (!open) return;
    showSessionToast(() => <SessionToast />);
    return dismissSessionToast;
  }, [open]);
  return null;
}

/** The toast itself; it reads the store, so it redraws on its own as the state changes. */
export function SessionToast() {
  const state = useSigningOut();
  if (!state) return null;
  return <SessionToastBody state={state} />;
}

/**
 * Idle: "Still there?" with a live countdown and Stay signed in. The 12 hour end (or when Stay
 * signed in found the cutoff didn't move): the time it ends, no action. It never takes focus,
 * keeps the ticking time hidden from screen readers, and speaks once on open and again at 30 s.
 */
function SessionToastBody({ state }: { state: SigningOut }) {
  const left = useServerTimeLeft(state.cutoff);
  const spoken = useSpokenTimeLeft(left);
  const time = <span aria-hidden="true" className="font-mono font-medium text-foreground">{countdown(left)}</span>;
  const speech = (
    <span role="status" className="sr-only">
      {spoken}
    </span>
  );

  if (state.cannotExtend) {
    return (
      <Toast
        kind="warning"
        persistent
        announce={false}
        title={`Your session ends at ${endsAt(state.cutoff)}`}
        body={
          <>
            This is the 12 hour limit. Sign in again to keep working.
            {speech}
          </>
        }
        onClose={() => undefined}
      />
    );
  }
  return (
    <Toast
      kind="warning"
      persistent
      announce={false}
      title="Still there?"
      body={
        <>
          You'll be signed out in {time} for inactivity.
          {speech}
        </>
      }
      action={{ label: 'Stay signed in', onClick: () => void staySignedIn(), loading: state.busy, keepOpen: true }}
      onClose={() => undefined}
    />
  );
}

/** "2:30 PM": the cutoff (on welinc-auth's clock) as this browser's local time, time only. */
function endsAt(cutoff: number): string {
  return new Date(cutoff - clockGap()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
