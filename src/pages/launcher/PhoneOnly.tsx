import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mobileSystemsOf, type LauncherAnswer, type MobileSystem } from '@/lib/auth';
import { appLine, firstName, greetingFor } from '@/lib/launcher';
import { CARD_GRID } from './Launcher';
import { LauncherShell } from './LauncherShell';
import { SignOutDialog } from './SignOutDialog';
import { RolePills } from './SystemCard';
import { SYSTEM_ICONS } from './systemIcons';

/** One phone only system: what it is and the person's roles, with no link (AC-7). */
function PhoneCard({ system }: { system: MobileSystem }) {
  const Icon = SYSTEM_ICONS[system.system] ?? Smartphone;
  return (
    <div className="flex h-full items-start gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-strong">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{system.system}</h2>
        <p className="text-sm font-medium text-foreground">{system.name}</p>
        <p className="text-sm text-muted-foreground">{system.description}</p>
        <RolePills roles={system.roles} />
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Smartphone className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {appLine(system)}
        </p>
      </div>
    </div>
  );
}

/**
 * Suite spec 0014, AC-7: a person whose roles open no system on the web, only a phone app (a
 * mechanic in VMMS, a driver in BMS). No open button, only Sign out.
 */
export default function PhoneOnly({ answer }: { answer: LauncherAnswer }) {
  const [signingOut, setSigningOut] = useState(false);
  const name = firstName(answer.user.name);
  return (
    <LauncherShell user={answer.user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {greetingFor(new Date().getHours())}
          {name && `, ${name}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your role doesn't use the web version.</p>
      </div>
      <ul className={CARD_GRID}>
        {mobileSystemsOf(answer).map((system) => (
          <li key={system.system}>
            <PhoneCard system={system} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button size="touch" variant="outline" onClick={() => setSigningOut(true)}>
          Sign out
        </Button>
      </div>
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} />
    </LauncherShell>
  );
}
