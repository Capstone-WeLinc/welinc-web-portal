import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Login from './auth/Login';
import { LoginLoading } from './auth/AuthSplit';
import Launcher from './launcher/Launcher';
import NoAccess from './launcher/NoAccess';
import PhoneOnly from './launcher/PhoneOnly';
import AppNotAllowed from './launcher/AppNotAllowed';
import { LauncherError, LauncherLoading } from './launcher/LauncherStates';
import {
  isSuiteAdmin,
  mobileSystemsOf,
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
import { SIGN_IN_TITLE, pageTitle, useDocumentTitle } from '../lib/title';
import { holdCutoffs, useSessionWatch } from '../lib/sessionWatch/watch';
import { ARRIVAL, SIGN_IN_GONE, ms } from './launcher/launchMotion';

/** Suite spec 0019, AC-8 (board `R66A3`): the sign in holds, then fades out over the next screen. */
const SIGN_IN_LEAVE = { '--arrive-at': ms(ARRIVAL.signInHold), '--arrive-for': ms(ARRIVAL.signInFade) } as CSSProperties;

/** The launcher asks /auth/sso again on focus at most this often (spec 0007, AC-18). */
export const RECHECK_MS = 10_000;

const SESSION_ENDED: Notice = { tone: 'warning', message: 'Your session ended. Sign in again.' };

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
  // AC-8: the sign in stays mounted (the same form, as typed) while it fades out over the launcher
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), SIGN_IN_GONE);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const show = useCallback(
    (next: Screen) => {
      // One system and no error: straight in, with no launcher drawn and no history entry
      if (next.kind === 'go') window.location.replace(next.url);
      // Suite spec 0019, AC-5: a suite admin with no system, into Suite management on People (not
      // spec 0013's Overview landing, which the Suite management tile keeps) with no history entry;
      // the screen, and with it any arrival flag, goes away
      else if (next.kind === 'admin') navigate('/admin/people', { replace: true });
      else setScreen(next);
    },
    [navigate],
  );

  // A `reason` (`/login?reason=logout`) forces the form without asking /auth/sso (AC-11). Once
  // someone signs in from it, rewrite this history entry to `/` without the reason, so Back from a
  // later page asks /auth/sso again instead of drawing the form over a live session. Done on the
  // browser history directly so the screen isn't remounted (and /auth/sso isn't asked twice); the
  // router's own entry state is kept, and the next navigation reads the new address.
  const forgetReason = useCallback(() => {
    if (!params.has('reason')) return;
    const rest = new URLSearchParams(params);
    rest.delete('reason');
    const search = rest.toString();
    window.history.replaceState(window.history.state, '', search ? `/?${search}` : '/');
  }, [params]);

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
    // Suite spec 0016, AC-12b: the login and code step answers carry the new session's cutoffs
    holdCutoffs(answer);
    if (start.kind === 'request') window.location.assign(resumeAddress(start.request));
    else {
      forgetReason();
      const next = screenForAnswer(params, answer);
      // Suite spec 0019, AC-8: the one moment Arrival A3 plays; any other screen drops the flag
      if (next.kind === 'launcher') {
        setLeaving(true);
        show({ ...next, arrive: true });
      } else if (next.kind === 'admin') {
        // A suite admin with no system: a plain fade, then Suite management (no arrival flag goes along)
        setLeaving(true);
        window.setTimeout(() => show(next), SIGN_IN_GONE);
      } else show(next);
    }
  };

  // Suite spec 0016, AC-12b: the signing out soon watch runs on the signed in screens only
  useSessionWatch(screen.kind === 'launcher' || screen.kind === 'phone-only' || screen.kind === 'app-not-allowed');

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
        if (result.kind === 'live') {
          const { answer } = result;
          // A role change may leave only phone apps (suite spec 0014, AC-5), or a suite admin with
          // no system left (suite spec 0019, AC-5)
          const phoneOnly = answer.systems.length === 0 && mobileSystemsOf(answer).length > 0;
          if (!phoneOnly && answer.systems.length === 0 && isSuiteAdmin(answer)) show({ kind: 'admin' });
          else setScreen({ kind: phoneOnly ? 'phone-only' : 'launcher', answer });
        }
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
  }, [onLauncher, show]);

  useDocumentTitle(titleFor(screen.kind, start.kind === 'request'));

  const signIn = screen.kind === 'form' || leaving;
  return (
    <>
      {screen.kind !== 'form' && screenFor(screen, start.kind === 'request', params, onRetry)}
      {/* One slot for the form, so its fade out keeps the same mounted form */}
      <div
        className={leaving ? 'signin-leave pointer-events-none fixed inset-0 z-50 overflow-hidden' : 'contents'}
        style={leaving ? SIGN_IN_LEAVE : undefined}
        inert={leaving}
        aria-hidden={leaving || undefined}
      >
        {signIn && <Login onSignedIn={onSignedIn} notice={ended ? SESSION_ENDED : null} />}
      </div>
    </>
  );
}

/** Every screen but the form, which `PortalScreen` keeps in its own slot. */
function screenFor(screen: Screen, appLogin: boolean, params: URLSearchParams, onRetry: () => void) {
  switch (screen.kind) {
    case 'launcher':
      return (
        <Launcher
          answer={screen.answer}
          arrive={screen.arrive === true}
          params={params}
          banner={params.has('error') ? noticeFor(params) : null}
        />
      );
    case 'phone-only':
      return <PhoneOnly answer={screen.answer} />;
    case 'app-not-allowed':
      return <AppNotAllowed answer={screen.answer} system={screen.system} />;
    case 'no-access':
      return <NoAccess email={screen.email} onRetry={onRetry} />;
    case 'error':
      return <LauncherError onRetry={onRetry} />;
    default:
      // An app initiated login most often ends on the form; a direct visit on the launcher
      return appLogin ? <LoginLoading /> : <LauncherLoading />;
  }
}

/** Suite spec 0019, AC-28: the tab title of each front door screen. */
function titleFor(kind: Screen['kind'], appLogin: boolean): string {
  switch (kind) {
    case 'form':
      return SIGN_IN_TITLE;
    case 'no-access':
      return pageTitle('No access');
    case 'error':
    case 'checking':
    case 'go':
    case 'admin':
      return appLogin ? SIGN_IN_TITLE : pageTitle();
    default:
      return pageTitle('Home');
  }
}
