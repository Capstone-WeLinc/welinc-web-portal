import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD_GRID } from './Launcher';
import { LauncherFrame } from './LauncherFrame';

/** While `/auth/sso` runs: the band and three skeleton cards shaped like real ones (AC-20). */
export function LauncherLoading() {
  return (
    <LauncherFrame
      greeting={
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40 bg-white/10" />
          <Skeleton className="h-11 w-96 max-w-full bg-white/10" />
          <Skeleton className="h-5 w-64 max-w-full bg-white/10" />
        </div>
      }
    >
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your systems</span>
        <ul className={CARD_GRID}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex min-h-46 flex-col gap-3 rounded-3xl bg-card px-6 pt-5.5 pb-4.5 shadow-card">
              <div className="flex items-center gap-3.5">
                <Skeleton className="size-12 rounded-2xl" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="mt-auto h-5 w-24" />
            </li>
          ))}
        </ul>
      </div>
    </LauncherFrame>
  );
}

/** `/auth/sso` failed with 429, 5xx or no network (AC-20). */
export function LauncherError({ onRetry }: { onRetry: () => void }) {
  return (
    <LauncherFrame
      greeting={<h1 className="text-display font-extrabold tracking-tight">We couldn't load your systems.</h1>}
    >
      <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl bg-card px-6 py-10 text-center shadow-card">
        <div className="flex size-12 items-center justify-center rounded-lg bg-error-bg text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <p className="text-body text-muted-foreground">Check your connection, then try again.</p>
        <Button size="touch" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </LauncherFrame>
  );
}
