import { AlertCircle } from 'lucide-react';
import { currentSystem, type LauncherAnswer, type Notice } from '@/lib/auth';
import { firstName, greetingFor } from '@/lib/launcher';
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
 * The Quiet workspace launcher (spec 0007, AC-15, AC-16): a greeting, one line, and a card per
 * system in welinc-auth's order. Every address comes from that answer; nothing in the query
 * string decides where a card goes.
 */
export default function Launcher({ answer, params, banner }: LauncherProps) {
  const here = currentSystem(params, answer);
  const name = firstName(answer.user.name);
  return (
    <LauncherShell user={answer.user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {greetingFor(new Date().getHours())}
          {name && `, ${name}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick where you want to work today.</p>
      </div>
      {banner && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{banner.message}</p>
        </div>
      )}
      <ul className={CARD_GRID}>
        {answer.systems.map((system) => (
          <li key={system.system}>
            <SystemCard system={system} here={here === system.system} />
          </li>
        ))}
      </ul>
    </LauncherShell>
  );
}
