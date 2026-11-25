import type { ReactNode } from 'react';
import { AppWindow } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
  Suite spec 0019, AC-2 and AC-3 (boards `R69Victor` to `R69Armando`): the launcher's drawn icons,
  J1 for the systems (BMS a booking ticket, VMMS a gauge, VRMS a wrench) and S5 for Suite
  management (a team tree). Navy and gold on white, drawn on a 64 unit square; decoration only.
*/

const MARKS: Record<string, ReactNode> = {
  BMS: (
    <>
      <path
        d="M12 19h40a3 3 0 0 1 3 3v6a4 4 0 0 0 0 8v6a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3v-6a4 4 0 0 0 0-8v-6a3 3 0 0 1 3-3z"
        className="fill-sidebar"
      />
      <path d="M21 37c7 0 8-10 21-10" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 5" className="stroke-highlight" />
      <circle cx="20" cy="37" r="4" className="fill-white" />
      <circle cx="44" cy="27" r="4.5" className="fill-highlight" />
    </>
  ),
  VMMS: (
    <>
      <path d="M13 43a19 19 0 0 1 38 0" fill="none" strokeWidth="5.5" strokeLinecap="round" className="stroke-sidebar" />
      <path d="M44.4 29.6A19 19 0 0 1 51 43" fill="none" strokeWidth="5.5" strokeLinecap="round" className="stroke-highlight" />
      <path d="M32 43 41 30" strokeWidth="3.5" strokeLinecap="round" className="stroke-highlight" />
      <circle cx="32" cy="43" r="5" className="fill-sidebar" />
      <circle cx="32" cy="43" r="2" className="fill-white" />
      <path d="M24 52h16" strokeWidth="3.5" strokeLinecap="round" opacity=".45" className="stroke-sidebar" />
    </>
  ),
  VRMS: (
    <>
      <path
        transform="translate(9.5 9.5) scale(1.9)"
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        className="stroke-sidebar"
      />
      <path d="M46 39.5l6 3.5v7l-6 3.5-6-3.5v-7z" className="fill-highlight" />
      <circle cx="46" cy="46.5" r="2.4" className="fill-white" />
    </>
  ),
};

/** S5: a navy node over three, the middle one gold. */
const SUITE: ReactNode = (
  <>
    <path d="M32 20v8M14 28h36M14 28v8M32 28v8M50 28v8" strokeWidth="3" fill="none" strokeLinecap="round" className="stroke-sidebar" />
    <rect x="23" y="7" width="18" height="14" rx="3.5" className="fill-sidebar" />
    <rect x="5" y="36" width="18" height="14" rx="3.5" className="fill-sidebar" />
    <rect x="23" y="36" width="18" height="14" rx="3.5" className="fill-highlight" />
    <rect x="41" y="36" width="18" height="14" rx="3.5" className="fill-sidebar" />
  </>
);

function Mark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-13 shrink-0', className)}>
      {children}
    </svg>
  );
}

/** The system's drawn icon; a system with none (a fourth some day) gets AppWindow (spec 0007, AC-15). */
export function SystemMark({ system, className }: { system: string; className?: string }) {
  const mark = MARKS[system];
  if (!mark) return <AppWindow aria-hidden="true" className={cn('size-13 shrink-0 p-1 text-sidebar', className)} />;
  return <Mark className={className}>{mark}</Mark>;
}

export function SuiteMark({ className }: { className?: string }) {
  return <Mark className={className}>{SUITE}</Mark>;
}
