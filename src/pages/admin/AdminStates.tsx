import type { ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { ErrorTile } from '@/components/brand/scenes/ErrorTile';
import { LoadScene } from '@/components/brand/scenes/LoadScene';
import { ScenePanel } from '@/components/brand/scenes/ScenePanel';
import type { TileSubject } from '@/components/brand/scenes/tileSubjects';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import type { SystemCode } from '@/lib/admin';
import { cn } from '@/lib/utils';

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

type ViewErrorProps = {
  /** What failed; each call site's own words. */
  message: string;
  onRetry: () => void;
  title?: string;
  className?: string;
} & (
  | { kind: 'page' }
  | { kind: 'tile'; subject: TileSubject }
);

/**
 * VRMS spec 0028, AC-22: an Admin view or pane that didn't load. `page` when the failure empties the
 * view (the idling truck panel, under the view's own h1); `tile` when it fills one pane, list or
 * dialog (the subject's small drawing, announced as a quiet status).
 */
export function ViewError(props: ViewErrorProps) {
  const { message, onRetry, title = "We couldn't load this", className } = props;
  const retry = (
    <Button variant="outline" onClick={onRetry}>
      <RotateCw aria-hidden="true" />
      Retry
    </Button>
  );

  if (props.kind === 'tile') {
    return (
      <div className={cn('flex flex-col items-center px-4 py-6 text-center', className)}>
        <ErrorTile subject={props.subject} />
        <div role="status" className="flex flex-col items-center">
          <p className="mt-3 text-body font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-90 text-small text-muted-foreground">{message}</p>
        </div>
        <div className="mt-3">{retry}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ScenePanel scene={<LoadScene />} title={title} line={message} actions={retry}>
        <p className="mt-1 text-body text-muted-foreground">Nothing you saved is lost.</p>
      </ScenePanel>
    </div>
  );
}

export function ViewEmpty({
  icon,
  message,
  action,
  className,
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-8', className)}>
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">{icon}</div>
      <p className="text-body text-muted-foreground">{message}</p>
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
  // The suite SegmentedControl (spec 0016 AC-8). Option values may be non strings, so each item's
  // value is its index.
  const selected = String(options.findIndex((option) => option.value === value));
  return (
    <SegmentedControl aria-label={label} value={selected} onValueChange={(index) => onChange(options[Number(index)].value)}>
      {options.map((option, index) => (
        <SegmentedControlItem key={option.label} value={String(index)}>
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
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
    <p role="alert" className="py-8 text-body text-foreground">
      {asked
        ? `You aren't an admin of ${asked}. Pick one of your systems above.`
        : 'You are not an admin of any system.'}
    </p>
  );
}
