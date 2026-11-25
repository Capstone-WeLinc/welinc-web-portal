import type { CSSProperties } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** One navy window, 24 by 34. */
const WINDOW = 'relative flex h-8.5 w-6 items-center justify-center overflow-hidden rounded-sm bg-odometer text-heading font-bold text-white tabular-nums';

/**
 * Suite spec 0019, AC-3 (the odometer kept from Round 23): a count in navy digit windows. Each
 * digit rolls up to its value only when the count is above 0; a 0 shows plain. `null` (loading,
 * a timeout or a failure) shows a dash. Screen readers get the number from the tile's own label,
 * so this is `aria-hidden`. `delay` staggers the tiles' rolls (seconds).
 */
export function Odometer({ value, delay = 0 }: { value: number | null; delay?: number }) {
  if (value === null || value === 0) {
    return (
      <span aria-hidden="true" className="inline-flex">
        <span className={WINDOW}>{value === null ? '–' : '0'}</span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5">
      {String(value)
        .split('')
        .map((digit, i) => (
          <span key={i} className={WINDOW}>
            <span
              className="absolute inset-x-0 top-0 flex odometer-reel flex-col"
              style={{ '--n': digit, animationDelay: `${delay + i * 0.08}s` } as CSSProperties}
            >
              {DIGITS.map((d) => (
                <span key={d} className="flex h-8.5 items-center justify-center">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ))}
    </span>
  );
}
