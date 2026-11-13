import { Link } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { currentSystem, mobileSystemsOf, type LauncherAnswer, type Notice } from '@/lib/auth';
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
  const phoneOnly = mobileSystemsOf(answer);
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
      {answer.systems.length === 0 ? (
        // Suite spec 0013, AC-5: a suite admin holds no system role by design
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">You hold no role in any system.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              As a suite admin you manage accounts and roles from Admin.
            </p>
          </div>
          <Link to="/admin" className={buttonVariants({ size: 'touch' })}>
            Open Admin
          </Link>
        </div>
      ) : (
        <ul className={CARD_GRID}>
          {answer.systems.map((system) => (
            <li key={system.system}>
              <SystemCard system={system} here={here === system.system} />
            </li>
          ))}
        </ul>
      )}
      {answer.systems.length > 0 && phoneOnly.length > 0 && (
        // Suite spec 0014, AC-7: the systems held only on a phone, named quietly
        <p className="mt-6 text-sm text-muted-foreground">
          On the mobile app: {phoneOnly.map((s) => s.system).join(', ')}
        </p>
      )}
    </LauncherShell>
  );
}
