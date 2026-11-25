import type { ReactNode } from 'react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { DepotScene } from '@/components/brand/DepotScene';
import { CrashBoundary } from '@/components/monitoring/CrashBoundary';
import type { LauncherAnswer } from '@/lib/auth';
import { AccountMenu } from './LauncherShell';

/**
 * The launcher's page (suite spec 0019, AC-1, AC-4; boards `R30Launcher`, `R37LineArt`): a navy
 * band with logo A, the account menu, the greeting and the line drawing over a road, then the
 * cards overlapping the band's bottom edge, then the footer. The band is 500px tall, 400px on
 * screens under 820px tall (the `short` variant, so 1280 by 720 fits with no page scroll) and
 * 440px on phones, where the page may scroll.
 */
export function LauncherFrame({
  user,
  systems,
  greeting,
  children,
}: {
  user?: LauncherAnswer['user'];
  /** The person's own systems, named in the Sign out dialog. */
  systems?: readonly string[];
  greeting: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="relative h-110 shrink-0 overflow-hidden bg-sidebar text-white md:h-125 md:short:h-100">
        <header className="relative z-10 mx-auto flex h-18 max-w-300 items-center gap-3 px-6 md:px-10">
          {/* You are already Home here, so the logo is not a link */}
          <BrandLockup />
          <span className="flex-1" />
          {user && <AccountMenu user={user} systems={systems} showName />}
        </header>
        <div className="relative z-10 mx-auto max-w-300 px-6 pt-8 md:px-10 md:pt-16 md:short:pt-8">{greeting}</div>
        <DepotScene className="pointer-events-none absolute bottom-8 left-1/2 h-95 w-360 max-w-none -translate-x-1/2 md:short:bottom-6 md:short:h-76 md:short:w-288" />
      </div>
      <main className="relative z-10 mx-auto -mt-12 flex w-full max-w-300 flex-col gap-5 px-6 md:px-10">
        {/* VRMS spec 0025, AC-7: a crash here keeps the band */}
        <CrashBoundary variant="page">{children}</CrashBoundary>
      </main>
      <footer className="mx-auto mt-auto flex w-full max-w-300 px-6 pt-8 pb-5.5 text-small text-muted-foreground md:px-10">
        WeLinc Logistics · Since 2018
      </footer>
    </div>
  );
}

/** The greeting block on the band: today's date in gold, the greeting, one line under it. */
export function Greeting({ date, title, line }: { date: string; title: string; line: string }) {
  return (
    <>
      <p className="text-small font-semibold text-highlight">{date}</p>
      <h1 className="mt-2.5 text-display font-extrabold tracking-tight md:text-5xl md:leading-none">{title}</h1>
      <p className="mt-3 max-w-110 text-group leading-normal font-normal text-white/70">{line}</p>
    </>
  );
}
