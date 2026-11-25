import { AlertCircle } from 'lucide-react';
import { currentSystem, mobileSystemsOf, type LauncherAnswer, type Notice } from '@/lib/auth';
import { firstName, greetingFor, orderedSystems, signedInSystems, suiteEntryFor, todayLabel } from '@/lib/launcher';
import { cn } from '@/lib/utils';
import { Greeting, LauncherFrame } from './LauncherFrame';
import { SuiteEntry } from './SuiteEntry';
import { SystemCard } from './SystemCard';

type LauncherProps = {
  answer: LauncherAnswer;
  params: URLSearchParams;
  /** The `error` notice from the address, shown above the cards (AC-13). */
  banner: Notice | null;
};

/** One column on phones, two from 640px, three from 1024px (the phone only and loading states use it too). */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/** Suite spec 0019, AC-2: three or two systems sit in one row; one system is one wide card. */
const ROW: Record<number, string> = {
  2: 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6',
  3: 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3',
};

/**
 * The launcher (spec 0007, AC-15, AC-16; suite spec 0019, AC-1 to AC-4): the navy band with the
 * greeting, a card per system in BMS, VMMS, VRMS order, then Suite management for anyone who
 * administers something. Every address comes from welinc-auth's answer; nothing in the query
 * string decides where a card goes.
 */
export default function Launcher({ answer, params, banner }: LauncherProps) {
  const here = currentSystem(params, answer);
  const name = firstName(answer.user.name);
  const systems = orderedSystems(answer.systems);
  const phoneOnly = mobileSystemsOf(answer);
  const entry = suiteEntryFor(answer);
  const now = new Date();
  return (
    <LauncherFrame
      user={answer.user}
      systems={signedInSystems(answer)}
      greeting={
        <Greeting
          date={todayLabel(now)}
          title={`${greetingFor(now.getHours())}${name ? `, ${name}` : ''}`}
          line={systems.length === 0 ? 'You manage people and access across the suite.' : 'Pick where you want to work today.'}
        />
      }
    >
      {banner && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-card p-4 text-body text-foreground shadow-card">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{banner.message}</p>
        </div>
      )}
      {systems.length > 0 && (
        <section aria-labelledby="launcher-systems">
          <h2 id="launcher-systems" className="sr-only">
            Your systems
          </h2>
          <ul className={cn(ROW[systems.length] ?? 'grid')}>
            {systems.map((system) => (
              <li key={system.system} className="flex">
                <SystemCard system={system} here={here === system.system} wide={systems.length === 1} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {phoneOnly.length > 0 && (
        // Suite spec 0014, AC-7: the systems held only on a phone, named quietly
        <p className="text-body text-muted-foreground">On the mobile app: {phoneOnly.map((s) => s.system).join(', ')}</p>
      )}
      {entry.kind !== 'none' && <SuiteEntry entry={entry} />}
    </LauncherFrame>
  );
}
