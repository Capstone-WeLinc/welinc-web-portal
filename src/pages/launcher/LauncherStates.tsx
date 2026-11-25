import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LauncherFrame } from './LauncherFrame';

/** While `/auth/sso` runs: the band and three skeleton tiles shaped like real ones (AC-20). */
export function LauncherLoading() {
  return (
    <LauncherFrame>
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your systems</span>
        <Skeleton className="mb-4 h-5 w-32" />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-4 rounded-3xl bg-card p-4 ring-1 ring-border md:h-53 md:flex-col md:gap-0 md:p-5.5">
              <Skeleton className="size-11 rounded-xl md:size-13" />
              <div className="flex flex-1 flex-col gap-2 md:mt-4.5 md:gap-2.5">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
                <Skeleton className="h-4 w-24 md:mt-auto" />
              </div>
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
    <LauncherFrame>
      <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl bg-card px-6 py-10 text-center ring-1 ring-border">
        <div className="flex size-12 items-center justify-center rounded-lg bg-error-bg text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-heading font-bold text-foreground">We couldn't load your systems.</h1>
        <p className="text-body text-muted-foreground">Check your connection, then try again.</p>
        <Button size="touch" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </LauncherFrame>
  );
}
