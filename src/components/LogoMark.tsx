import { cn } from '@/lib/utils';

/**
 * The WeLinc mark alone (two slanted bars and the slanted L), redrawn from `welinc-logo.jpg`, which
 * carries its own navy square and wordmark and turns to mush at icon size. Filled with
 * `currentColor`, so the caller picks the color with a text token (gold on navy, navy on gold).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 330 185"
      className={cn('h-6 w-auto', className)}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <polygon points="82,0 144,0 66,183 4,183" />
      <polygon points="177,0 240,0 162,183 100,183" />
      <polygon points="265,0 328,0 268,140 328,140 328,183 187,183" />
    </svg>
  );
}
