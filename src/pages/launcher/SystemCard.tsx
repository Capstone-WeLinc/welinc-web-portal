import type { MouseEvent } from 'react';
import { AppWindow, ArrowRight } from 'lucide-react';
import { RoleChip } from '@/components/ui/role-chip';
import type { LauncherSystem } from '@/lib/auth';
import { roleTag } from '@/lib/launcher';
import { cn } from '@/lib/utils';
import { SYSTEM_ICONS, SYSTEM_LINES } from './systemIcons';

/** The person's roles in a system as neutral RoleChips (suite spec 0016 AC-15); nothing when there are none. */
export function RolePills({ roles }: { roles: { code: string; name: string }[] }) {
  if (roles.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Your roles">
      {roles.map((role) => (
        <li key={role.code}>
          <RoleChip>{role.name}</RoleChip>
        </li>
      ))}
    </ul>
  );
}

const CARD =
  'group flex flex-1 rounded-3xl bg-card shadow-card transition duration-200 ease-enter hover:-translate-y-0.75 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * One system (suite spec 0019, AC-2; boards `R30Launcher`, `R37LineArt`): the icon, the code with
 * one role chip, the full name, the one line, and "Open VRMS". The whole card is one link, same
 * tab (spec 0007, AC-15, AC-16). `wide` is the single card a one system person sees.
 */
export function SystemCard({
  system,
  here,
  wide = false,
  onLaunch,
}: {
  system: LauncherSystem;
  here: boolean;
  wide?: boolean;
  /** Suite spec 0019, AC-10: a plain left click starts Launch 3; the link still navigates on its own. */
  onLaunch?: (system: LauncherSystem) => void;
}) {
  // Never preventDefault: the browser fetches the system while the launch plays. A click someone
  // already handled, a modifier (new tab or window) or another button keeps the launcher still.
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onLaunch?.(system);
  };
  // Anything without a fixed icon gets AppWindow (AC-15)
  const Icon = SYSTEM_ICONS[system.system] ?? AppWindow;
  const tag = roleTag(system);
  const line = SYSTEM_LINES[system.system] ?? system.description;
  const heading = (
    <span className="flex min-w-0 flex-wrap items-center gap-2.5">
      <span className={cn('font-bold tracking-tight text-foreground', wide ? 'text-title' : 'text-heading')}>{system.system}</span>
      {tag && <RoleChip className="rounded-full px-2.5">{tag}</RoleChip>}
      {here && (
        <span className="rounded-full bg-highlight px-2 py-0.5 text-caption font-medium text-highlight-foreground">You're here</span>
      )}
    </span>
  );
  const tile = (size: string, icon: string) => (
    <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-info-bg text-primary', size)} aria-hidden="true">
      <Icon className={icon} />
    </span>
  );

  if (wide) {
    return (
      <a href={system.url} onClick={onClick} className={cn(CARD, 'flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-7')}>
        {tile('size-16', 'size-7')}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {heading}
          <span className="text-body font-medium text-foreground">{system.name}</span>
          <span className="text-small text-muted-foreground">{line}</span>
        </span>
        <span className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-sidebar px-5.5 text-group font-bold text-white transition-colors group-hover:bg-primary">
          Open {system.system}
          <ArrowRight className="size-4.5" aria-hidden="true" />
        </span>
      </a>
    );
  }

  return (
    <a href={system.url} onClick={onClick} className={cn(CARD, 'h-full min-h-46 flex-col px-6 pt-5.5 pb-4.5')}>
      <span className="flex items-center gap-3.5">
        {tile('size-12', 'size-5.5')}
        {heading}
      </span>
      {/* The full name leads; the one line under it is the quieter description */}
      <span className="mt-3 text-body font-medium text-foreground">{system.name}</span>
      <span className="mt-1 text-small text-muted-foreground">{line}</span>
      <span className="min-h-3 flex-1" />
      <span className="flex items-center justify-between border-t border-divider pt-3 text-body font-semibold text-primary">
        Open {system.system}
        <ArrowRight
          className="size-4.5 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}
