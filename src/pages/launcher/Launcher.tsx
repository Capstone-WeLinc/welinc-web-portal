import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { currentSystem, mobileSystemsOf, type LauncherAnswer, type Notice } from '@/lib/auth';
import { firstName, greetingFor } from '@/lib/launcher';
import { AdminCard, AdminCardIfAdmin } from './AdminCard';
import { LauncherShell } from './LauncherShell';
import { SystemCard } from './SystemCard';

type LauncherProps = {
  answer: LauncherAnswer;
  params: URLSearchParams;
  /** The `error` notice from the address, shown above the cards (AC-13). */
  banner: Notice | null;
};

/** One column at 375px, two from 640px, three from 1024px (AC-20). */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/**
 * With one or two systems the Admin card joins their row (three columns from 1024px), so the page
 * isn't one card wide with an empty canvas beside it. Static class names, for Tailwind's scanner.
 */
const ROW = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
const SYSTEMS_IN_ROW: Record<number, { section: string; list: string }> = {
  1: { section: '', list: 'grid grid-cols-1 gap-4' },
  2: { section: 'sm:col-span-2', list: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
};

/**
 * The Admin card's own section, apart from the systems like a suite's admin app. Its heading shows
 * only when the card sits in a row of its own below three or more systems; beside the systems, or
 * as the page's only section (a suite admin), the card's navy icon marks it and the heading is for
 * screen readers.
 */
function ManageSection({
  layout,
  children,
}: {
  layout: 'only' | 'in-row' | 'below';
  children: ReactNode;
}) {
  if (layout === 'in-row') {
    return (
      <section aria-labelledby="launcher-manage">
        <h2 id="launcher-manage" className="sr-only">
          Manage
        </h2>
        {children}
      </section>
    );
  }
  const only = layout === 'only';
  return (
    <section aria-labelledby="launcher-manage" className={only ? undefined : 'mt-10'}>
      <h2
        id="launcher-manage"
        className={only ? 'sr-only' : 'mb-3 text-xs font-medium tracking-wide text-muted-strong uppercase'}
      >
        Manage
      </h2>
      <ul className={CARD_GRID}>
        <li className={only ? 'sm:col-span-2 lg:col-span-3' : undefined}>{children}</li>
      </ul>
    </section>
  );
}

/**
 * The Quiet workspace launcher (spec 0007, AC-15, AC-16): a greeting, one line, and a card per
 * system in welinc-auth's order, then the Admin card for admins. Every address comes from that
 * answer; nothing in the query string decides where a card goes.
 */
export default function Launcher({ answer, params, banner }: LauncherProps) {
  const here = currentSystem(params, answer);
  const name = firstName(answer.user.name);
  const phoneOnly = mobileSystemsOf(answer);
  const suiteAdminOnly = answer.systems.length === 0;
  const inRow = SYSTEMS_IN_ROW[answer.systems.length];
  return (
    <LauncherShell
      user={answer.user}
      adminEntry={false}
      hero={
        <>
          <p className="text-xs font-medium tracking-wide text-highlight uppercase">
            {suiteAdminOnly ? 'Suite admin' : 'Your workspace'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greetingFor(new Date().getHours())}
            {name && `, ${name}`}
          </h1>
          <p className="mt-2 text-sm text-white/70 sm:text-base">
            {suiteAdminOnly ? 'You manage accounts and roles across the suite.' : 'Pick where you want to work today.'}
          </p>
        </>
      }
    >
      {banner && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{banner.message}</p>
        </div>
      )}
      {suiteAdminOnly ? (
        // Suite spec 0013, AC-5: a suite admin holds no system role by design. welinc-auth answers an
        // empty list only to a suite admin; anyone else with no role gets 403 NO_SYSTEM_ACCESS.
        <ManageSection layout="only">
          <AdminCard me={{ suiteAdmin: true, adminOf: [] }} wide />
        </ManageSection>
      ) : (
        <>
          <div className={inRow ? ROW : undefined}>
            <section aria-labelledby="launcher-systems" className={inRow?.section}>
              <h2 id="launcher-systems" className="sr-only">
                Systems
              </h2>
              <ul className={inRow?.list ?? CARD_GRID}>
                {answer.systems.map((system) => (
                  <li key={system.system}>
                    <SystemCard system={system} here={here === system.system} />
                  </li>
                ))}
              </ul>
            </section>
            {inRow && (
              <AdminCardIfAdmin>
                {(me) => (
                  <ManageSection layout="in-row">
                    <AdminCard me={me} />
                  </ManageSection>
                )}
              </AdminCardIfAdmin>
            )}
          </div>
          {phoneOnly.length > 0 && (
            // Suite spec 0014, AC-7: the systems held only on a phone, named quietly
            <p className="mt-6 text-sm text-muted-foreground">
              On the mobile app: {phoneOnly.map((s) => s.system).join(', ')}
            </p>
          )}
          {!inRow && (
            <AdminCardIfAdmin>
              {(me) => (
                <ManageSection layout="below">
                  <AdminCard me={me} />
                </ManageSection>
              )}
            </AdminCardIfAdmin>
          )}
        </>
      )}
    </LauncherShell>
  );
}
