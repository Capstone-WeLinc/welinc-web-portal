import { AppWindow, ChevronRight } from 'lucide-react';
import { RoleChip } from '@/components/ui/role-chip';
import type { LauncherSystem } from '@/lib/auth';
import { SYSTEM_ICONS } from './systemIcons';


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

/** One system, the whole card one link, same tab (AC-15, AC-16). */
export function SystemCard({ system, here }: { system: LauncherSystem; here: boolean }) {
  // Anything without a fixed icon gets AppWindow (AC-15)
  const Icon = SYSTEM_ICONS[system.system] ?? AppWindow;
  return (
    <a
      href={system.url}
      className="group flex h-full items-start gap-4 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors duration-150 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden motion-reduce:transition-none sm:p-5"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{system.system}</h2>
          {here && (
            <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
              You're here
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{system.name}</p>
        <p className="text-sm text-muted-foreground">{system.description}</p>
        <RolePills roles={system.roles} />
      </div>
      <ChevronRight
        className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-focus-visible:translate-x-0"
        aria-hidden="true"
      />
    </a>
  );
}
