import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD_GRID } from './Launcher';
import { LauncherShell } from './LauncherShell';

/** While `/auth/sso` runs: three skeleton cards shaped like real ones (AC-20). */
export function LauncherLoading() {
  return (
    <LauncherShell>
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your systems</span>
        <div className="mb-6 flex flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <ul className={CARD_GRID}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-transparent bg-card shadow-card p-4 sm:p-5">
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="mt-2 h-5 w-24 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LauncherShell>
  );
}

/** `/auth/sso` failed with 429, 5xx or no network (AC-20). */
export function LauncherError({ onRetry }: { onRetry: () => void }) {
  return (
    <LauncherShell>
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-subheading font-semibold text-foreground">We couldn't load your systems.</h1>
          <p className="mt-1 text-body text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button size="touch" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </LauncherShell>
  );
}
