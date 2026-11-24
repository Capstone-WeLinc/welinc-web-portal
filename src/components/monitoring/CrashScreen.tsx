import { Copy, RotateCw, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { COPIED_MS, COPY_LABEL, copyText, type CopyState } from '@/lib/monitoring/copyText';
import { crashDetails, type CaughtCrash } from '@/lib/monitoring/crashDetails';
import { APP_NAME, crashViewerIsAdmin, RELEASE } from '@/lib/monitoring/standing';
import { cn } from '@/lib/utils';

interface CrashScreenProps {
  /** What the boundary stored when the page crashed. */
  crash: CaughtCrash;
  /** The first 8 characters of the Sentry event id; none when monitoring is off. */
  code?: string;
  /** `page` sits inside a shell; `full` fills the window (the shell itself crashed). */
  variant: 'page' | 'full';
}

/**
 * VRMS spec 0025, AC-7 and AC-7a: what a person sees instead of a blank page when a screen crashes.
 * Laid out like the portal's other error states (`AdminError`). Staff get a short line (with the
 * reference code when there is one); a suite or system admin gets the details and Copy details.
 * The standing is read once, on the first draw, and never upgrades later.
 */
export function CrashScreen({ crash, code, variant }: CrashScreenProps) {
  const [isAdmin] = useState(crashViewerIsAdmin);
  const [copy, setCopy] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Built on every draw, so the Code line joins when the code arrives and the time stays put
  const details = isAdmin
    ? crashDetails(crash.error, { path: crash.path, at: crash.at, app: APP_NAME, release: RELEASE, code })
    : '';

  const onCopy = () => {
    clearTimeout(timer.current);
    void copyText(details).then((result) => {
      setCopy(result);
      if (result === 'copied') timer.current = setTimeout(() => setCopy('idle'), COPIED_MS);
    });
  };

  const line = isAdmin
    ? 'Try reloading. Copy the details below into your bug report.'
    : code
      ? 'Try reloading. If it keeps happening, send this code to your admin.'
      : 'Try reloading. If it keeps happening, tell your admin what you were doing.';

  const backClass = buttonVariants({ variant: 'outline', size: 'touch' });
  return (
    <div className={cn(variant === 'full' && 'flex min-h-screen items-center justify-center bg-background px-4')}>
      <div
        className={cn(
          'mx-auto flex flex-col items-center gap-4 py-16 text-center',
          isAdmin ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        {/* Only the title and the line are announced; the details box sits outside the alert */}
        <div role="alert">
          <h1 className="text-subheading font-semibold text-foreground">Something went wrong on this page</h1>
          <p className="mt-1 text-body text-muted-foreground">{line}</p>
          {!isAdmin && code && (
            <p className="mt-2 text-body text-muted-foreground">
              Reference <span className="font-mono font-semibold text-foreground select-all">{code}</span>
            </p>
          )}
        </div>
        {isAdmin && (
          <pre
            aria-label="Crash details"
            className="w-full overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-left font-mono text-caption whitespace-pre-wrap break-words text-foreground select-all"
          >
            {details}
          </pre>
        )}
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
          {isAdmin && (
            <Button size="touch" variant="outline" onClick={onCopy}>
              <Copy aria-hidden="true" />
              {COPY_LABEL[copy]}
            </Button>
          )}
        </div>
        {isAdmin && (
          <span role="status" className="sr-only">
            {copy === 'idle' ? '' : COPY_LABEL[copy]}
          </span>
        )}
      </div>
    </div>
  );
}
