import { Clock } from 'lucide-react';
import { untilLabel } from './peopleRules';

/** "Until [date]": temporary access that ends by itself (suite spec 0017, AC-10, AC-12). */
export function TemporaryTag({ until }: { until: string }) {
  return (
    <span
      title="Temporary access ends by itself"
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-caption text-warning tabular-nums"
    >
      <Clock className="size-3" aria-hidden="true" />
      {untilLabel(until)}
    </span>
  );
}
