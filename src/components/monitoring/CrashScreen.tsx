import { RotateCw, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CrashScreenProps {
  /** The first 8 characters of the Sentry event id; none when monitoring is off. */
  code?: string;
  /** `page` sits inside a shell; `full` fills the window (the shell itself crashed). */
  variant: 'page' | 'full';
}

/**
 * VRMS spec 0025, AC-7: what a person sees instead of a blank page when a screen crashes. Laid out
 * like the portal's other error states (`AdminError`).
 */
export function CrashScreen({ code, variant }: CrashScreenProps) {
  const backClass = buttonVariants({ variant: 'outline', size: 'touch' });
  return (
    <div className={cn(variant === 'full' && 'flex min-h-screen items-center justify-center bg-background px-4')}>
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-subheading font-semibold text-foreground">Something went wrong on this page</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Try reloading. If it keeps happening, send this code to your admin.
          </p>
          {code && (
            <p className="mt-2 text-body text-muted-foreground">
              Reference <span className="font-mono font-semibold text-foreground select-all">{code}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="touch" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden="true" />
            Reload
          </Button>
          {variant === 'page' ? (
            <Link to="/" className={backClass}>
              Back to apps
            </Link>
          ) : (
            // Outside the router a full load is the safe way home
            <a href="/" className={backClass}>
              Back to apps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
