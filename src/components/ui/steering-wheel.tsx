import { cn } from '@/lib/utils';

/**
 * Suite spec 0019, AC-24: the wait inside a busy button or a small loading spot, a steering wheel
 * that swings left and right (board `R29SpinSteer`, picked on Round 33). The ring and spokes take
 * the text color, the hub is gold. Decoration only: the caller carries `aria-busy` and the label.
 */
export function SteeringWheel({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-slot="steering-wheel"
      className={cn('size-4 shrink-0', className)}
    >
      <g className="wheel-turn">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <circle cx="12" cy="12" r="2.6" className="fill-highlight" />
        <path
          d="M3 11.5 H9.5 M14.5 11.5 H21 M12 14.6 V21"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** A small loading spot for a list that reloads or loads more; a first load keeps its skeletons. */
export function LoadingSpot({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('flex items-center justify-center gap-2 py-3 text-small text-muted-foreground', className)}>
      <SteeringWheel className="text-primary" />
      {label}…
    </span>
  );
}
