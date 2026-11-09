import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Login from './auth/Login';
import { LoginLoading } from './auth/AuthHero';
import Launcher from './launcher/Launcher';
import NoAccess from './launcher/NoAccess';
import { LauncherError, LauncherLoading } from './launcher/LauncherStates';
import {
  noticeFor,
  resumeAddress,
  screenForAnswer,
  screenForSso,
  startFor,
  type LauncherAnswer,
  type Notice,
  type Screen,
} from '../lib/auth';
import { checkSso } from '../lib/session';

/** The launcher asks /auth/sso again on focus at most this often (spec 0007, AC-18). */
export const RECHECK_MS = 10_000;

const SESSION_ENDED: Notice = { tone: 'info', message: 'Your session ended. Sign in again.' };

/**
 * The portal's front door at `/` and `/login` (spec 0007, AC-11 to AC-14). The screen is a pure
 * function of the address and welinc-auth's answer; a new address starts over.
 */
export default function Portal() {
  const [params] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const query = params.toString();
  return (
    <PortalScreen
      key={`${query}#${attempt}`}
      params={params}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function PortalScreen({ params, onRetry }: { params: URLSearchParams; onRetry: () => void }) {
  const [start] = useState(() => startFor(params));
  const [screen, setScreen] = useState<Screen>(() =>
    start.kind === 'form' ? { kind: 'form' } : { kind: 'checking' },
  );
  const [ended, setEnded] = useState(false);

  const show = useCallback((next: Screen) => {
    // One system and no error: straight in, with no launcher drawn and no history entry
    if (next.kind === 'go') window.location.replace(next.url);
    else setScreen(next);
  }, []);

  useEffect(() => {
    if (start.kind === 'form') return;
    let cancelled = false;
    void checkSso().then((result) => {
      if (cancelled) return;
      if (start.kind === 'request') {
        // An app initiated login never shows the launcher (AC-10, AC-12)
        if (result.kind === 'live') window.location.assign(resumeAddress(start.request));
        else setScreen({ kind: 'form' });
        return;
      }
      show(screenForSso(params, result));
    });
    return () => {
      cancelled = true;
    };
  }, [start, params, show]);

  const onSignedIn = (answer: LauncherAnswer) => {
    if (start.kind === 'request') window.location.assign(resumeAddress(start.request));
    else show(screenForAnswer(params, answer));
  };

  // AC-18: a tab coming back asks again, at most once every 10 seconds
  const lastCheck = useRef(0);
  const onLauncher = screen.kind === 'launcher';
  useEffect(() => {
    if (!onLauncher) return;
    lastCheck.current = Date.now();
    let cancelled = false;
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      void checkSso().then((result) => {
        if (cancelled) return;
        if (result.kind === 'live') setScreen({ kind: 'launcher', answer: result.answer });
        else if (result.kind === 'ended') {
          setEnded(true);
          setScreen({ kind: 'form' });
        } else if (result.kind === 'no-access') setScreen(result);
        // A failed check keeps the cards; the next focus tries again
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [onLauncher]);

  switch (screen.kind) {
    case 'form':
      return <Login onSignedIn={onSignedIn} notice={ended ? SESSION_ENDED : null} />;
    case 'launcher':
      return (
        <Launcher
          answer={screen.answer}
          params={params}
          banner={params.has('error') ? noticeFor(params) : null}
        />
      );
    case 'no-access':
      return <NoAccess email={screen.email} />;
    case 'error':
      return <LauncherError onRetry={onRetry} />;
    default:
      // An app initiated login most often ends on the form; a direct visit on the launcher
      return start.kind === 'request' ? <LoginLoading /> : <LauncherLoading />;
  }
}
