import type { ReactNode } from 'react';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SystemCode } from '@/lib/admin';

/** The view title row: title, one line of context, the primary action on the right. */
export function ViewHeader({ title, context, action }: { title: string; context?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 id="admin-view-title" className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {context && <p className="mt-1 text-sm text-muted-foreground">{context}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ViewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-8">
      <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm text-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

export function ViewEmpty({ icon, message, action }: { icon: ReactNode; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

/**
 * AC-23: the system switcher, shown when the admin holds two or more systems, or (suite admins)
 * with an "All" choice first. One selected style everywhere (design.md): solid primary for the
 * chosen one, a card outline for the rest.
 */
export function SystemSwitcher({
  value,
  choices,
  onChange,
  allLabel,
}: {
  value: SystemCode | null;
  choices: SystemCode[];
  onChange: (next: SystemCode | null) => void;
  /** Adds a suite wide choice (value null) with this label. */
  allLabel?: string;
}) {
  if (choices.length < 2 && !allLabel) return null;
  const options: { value: SystemCode | null; label: string }[] = [
    ...(allLabel ? [{ value: null, label: allLabel }] : []),
    ...choices.map((system) => ({ value: system, label: system })),
  ];
  return (
    <div role="radiogroup" aria-label="System" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:min-h-9',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A deep link for a system the admin doesn't run. */
export function NoSystemScope({ asked }: { asked?: SystemCode }) {
  return (
    <p role="alert" className="py-8 text-sm text-foreground">
      {asked
        ? `You aren't an admin of ${asked}. Pick one of your systems above.`
        : 'You are not an admin of any system.'}
    </p>
  );
}
