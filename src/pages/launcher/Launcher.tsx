import { ChevronRight } from 'lucide-react';
import { currentSystem, type LauncherAnswer, type Notice } from '../../lib/auth';
import SignOutButton from './SignOutButton';

type LauncherProps = {
  answer: LauncherAnswer;
  params: URLSearchParams;
  /** The `error` notice from the address, shown above the cards (AC-13). */
  banner: Notice | null;
};

/**
 * The systems you hold, one card each (spec 0007, AC-15, AC-16). Every address comes from
 * welinc-auth's answer; nothing in the query string decides where a card goes.
 */
export default function Launcher({ answer, params, banner }: LauncherProps) {
  const here = currentSystem(params, answer);
  return (
    <main className="min-h-screen bg-brand-darker p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Hello, {answer.user.name.split(' ')[0]}</h1>
            <p className="text-white/60">Pick where you want to work today.</p>
          </div>
          <SignOutButton />
        </div>
        {banner && (
          <div role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
            {banner.message}
          </div>
        )}
        <ul className="space-y-3">
          {answer.systems.map((s) => (
            <li key={s.system}>
              <a
                href={s.url}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.08]"
              >
                <div className="flex-1">
                  <p className="font-black">
                    {s.system} {here === s.system && <span className="ml-2 text-xs text-brand-gold">You're here</span>}
                  </p>
                  <p className="text-sm text-white/70">{s.name}</p>
                  <p className="text-sm text-white/50">{s.description}</p>
                  <p className="mt-1 text-xs text-white/60">{s.roles.map((r) => r.name).join(', ')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
