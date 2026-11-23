import type { ReactNode } from 'react';
import type { SystemCode } from '@/lib/admin';
import { cn } from '@/lib/utils';
import type { PillTone } from './peopleRules';

const PILL_TONES: Record<PillTone, string> = {
  error: 'bg-error-bg text-error',
  warning: 'bg-warning-bg text-warning',
  muted: 'bg-muted text-muted-strong',
  navy: 'bg-info-bg text-primary',
  success: 'bg-success-bg text-success',
};

/** Suite spec 0017, AC-7 (board `People8`): the one status pill in the person header. */
export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-semibold', PILL_TONES[tone])}>
      {label}
    </span>
  );
}

/**
 * AC-6, AC-10: a system's mono code. Filled where the viewer admins the system, outlined where
 * someone else does. The code is read as text, so screen readers hear "VRMS".
 */
export function SystemChip({ system, filled = true, className }: { system: SystemCode; filled?: boolean; className?: string }) {
  return (
    <span
      data-filled={filled || undefined}
      className={cn(
        'inline-flex h-5 shrink-0 items-center justify-center rounded-sm px-1.5 font-mono text-caption',
        filled ? 'border border-transparent bg-info-bg text-primary' : 'border border-border bg-card text-muted-strong',
        className,
      )}
    >
      {system}
    </span>
  );
}

/** A card of the person pane (board `People8`): a heading row with one quiet action, then rows. */
export function PaneCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-2xl bg-card shadow-card', className)}>
      <header className="flex min-h-13 items-center justify-between gap-3 border-b border-divider px-5 py-2">
        <h3 className="text-group text-foreground">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** The quiet navy text button in a card's heading row ("Change", "See all"). */
export function CardAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mr-2 inline-flex h-9 items-center rounded-md px-2 text-small font-semibold text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11"
    >
      {children}
    </button>
  );
}
