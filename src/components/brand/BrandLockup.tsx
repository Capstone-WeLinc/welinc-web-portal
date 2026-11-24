import { LogoMark } from '@/components/LogoMark';
import { cn } from '@/lib/utils';

/**
 * Logo A (suite spec 0019, AC-28; board `R35LogoPlaces`): the gold ///L mark beside "WeLinc
 * Logistics" in white italic, for navy surfaces only (the sign in side, the launcher band, the
 * 404 header). White surfaces use logo F, a mark alone at small sizes logo B (`LogoBadge`).
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="h-5 text-highlight" />
      <span className="text-group font-extrabold tracking-tight text-white italic">WeLinc Logistics</span>
    </span>
  );
}

/** Logo B: the navy mark on a gold rounded square, where the mark stands alone at small sizes. */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-highlight', className)}
    >
      <LogoMark className="h-3.5 text-highlight-foreground" />
    </span>
  );
}

/** Logo F: the navy mark in a thin navy outlined square, for small marks on white (footers). */
export function LogoOutline({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sm border border-sidebar',
        className,
      )}
    >
      <LogoMark className="h-2 text-sidebar" />
    </span>
  );
}
