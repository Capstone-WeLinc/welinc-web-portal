import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * design.md tables for the admin lists, from one markup: a real table from md up (light header,
 * uppercase `text-xs` `muted-strong`, divided rows), and below md each row stacks into a block
 * (design.md: tables turn into stacked cards on phones), with the header kept for screen readers.
 */
export function DataTable({ columns, children }: { columns: Column[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm max-md:block">
        <thead className="bg-muted max-md:sr-only">
          <tr>
            {columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-left text-xs font-medium tracking-wide text-muted-strong uppercase',
                  column.align === 'end' && 'text-right',
                  column.className,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border max-md:block">{children}</tbody>
      </table>
    </div>
  );
}

export type Column = {
  /** The header text; an action column gets a screen reader only label. */
  label: ReactNode;
  align?: 'end';
  className?: string;
};

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('max-md:block max-md:px-4 max-md:py-3', className)}>{children}</tr>;
}

export function Cell({
  children,
  align,
  className,
}: {
  children: ReactNode;
  align?: 'end';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle max-md:block max-md:px-0 max-md:py-0.5',
        align === 'end' && 'text-right max-md:pt-2 max-md:text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A person's name over their email, the first cell of most admin rows. */
export function PersonCell({ name, email, extra }: { name: ReactNode; email?: string | null; extra?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 font-medium break-words text-foreground">
        {name}
        {extra}
      </div>
      {email && <p className="text-xs break-all text-muted-foreground">{email}</p>}
    </div>
  );
}

/** Text that is secondary in a row: dates, who did it. */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{children}</span>;
}
