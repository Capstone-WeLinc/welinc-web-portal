import { AppWindow, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LauncherSystem } from '@/lib/auth';
import { SYSTEM_ICONS } from './systemIcons';


/** design.md's role pill colors, by role code across systems; a code it doesn't list is slate. */
const ROLE_PILLS: Record<string, string> = {
  ADMIN: 'bg-role-admin-bg text-role-admin-fg',
  CHIEF_MECHANIC: 'bg-role-chief-mechanic-bg text-role-chief-mechanic-fg',
  MECHANIC: 'bg-role-mechanic-bg text-role-mechanic-fg',
  OPERATIONS: 'bg-role-operations-bg text-role-operations-fg',
  CUSTOMER_SUPPORT: 'bg-role-customer-support-bg text-role-customer-support-fg',
  DRIVER: 'bg-role-driver-bg text-role-driver-fg',
};
const SLATE_PILL = 'bg-role-driver-bg text-role-driver-fg';

/** The person's roles in a system as design.md's pills; nothing when there are none. */
export function RolePills({ roles }: { roles: { code: string; name: string }[] }) {
  if (roles.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Your roles">
      {roles.map((role) => (
        <li
          key={role.code}
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium tracking-wide uppercase',
            ROLE_PILLS[role.code] ?? SLATE_PILL,
          )}
        >
          {role.name}
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
