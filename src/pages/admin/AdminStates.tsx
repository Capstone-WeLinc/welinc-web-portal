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
        {/* The page's one h1: the Admin shell has no title of its own */}
        <h1 id="admin-view-title" className="text-title text-foreground">
          {title}
        </h1>
        {context && <p className="mt-1 text-small text-muted-foreground">{context}</p>}
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
 * One segmented control for every admin filter (design.md: the selected option is solid primary,
 * the rest sit on the card): the options touch inside one bordered group, so a filter reads as
 * one control, not a row of separate buttons.
 */
export function Segmented<T>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
    >
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
              'min-h-10 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:min-h-8',
              selected ? 'bg-primary text-primary-foreground' : 'text-muted-strong hover:bg-accent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * AC-23: the system switcher, the same on every view: "All systems" first for a suite admin on
 * the views that allow it, then each system. Hidden when there is nothing to pick (an admin of
 * one system).
 */
export function SystemSwitcher({
  value,
  choices,
  onChange,
  allowAll = false,
}: {
  value: SystemCode | null;
  choices: SystemCode[];
  onChange: (next: SystemCode | null) => void;
  /** Adds the suite wide choice (value null). */
  allowAll?: boolean;
}) {
  if (choices.length < 2 && !allowAll) return null;
  const options: { value: SystemCode | null; label: string }[] = [
    ...(allowAll ? [{ value: null, label: 'All systems' }] : []),
    ...choices.map((system) => ({ value: system, label: system })),
  ];
  return <Segmented label="System" value={value} options={options} onChange={onChange} />;
}

/** The row under a view header that holds its filters; nothing when every filter is hidden. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 empty:hidden md:flex-row md:flex-wrap md:items-center">{children}</div>;
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
