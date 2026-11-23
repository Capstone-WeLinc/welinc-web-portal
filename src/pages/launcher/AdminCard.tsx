import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, type LucideIcon } from 'lucide-react';
import { isAdmin, type AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { adminView, type AdminViewPath } from '../admin/adminViews';
import { useAdminMe } from '../admin/useAdminMe';

type Shortcut = { label: string; hint: string; to: string; icon: LucideIcon };

const HINTS: Partial<Record<AdminViewPath, string>> = {
  overview: 'Who holds admin, what needs a look',
  people: 'Accounts, roles, locks',
  'deletion-requests': 'Approve or decline',
  activity: 'Sign ins and changes',
  // How a suite admin, who holds no system role, steps into a system
  'temporary-access': 'Step into a system for a while',
};

/** The tasks an admin most often comes for; suite only views only for a suite admin. */
function shortcutsFor(suiteAdmin: boolean): Shortcut[] {
  const paths: AdminViewPath[] = suiteAdmin
    ? ['overview', 'people', 'deletion-requests', 'temporary-access']
    : ['people', 'deletion-requests', 'activity'];
  return paths.map((path) => {
    const view = adminView(path);
    return { label: view.label, hint: HINTS[path] ?? '', to: `/admin/${path}`, icon: view.icon };
  });
}

function scopeLine(me: Pick<AdminMe, 'suiteAdmin' | 'adminOf'>): string {
  return me.suiteAdmin
    ? 'Accounts, roles and access across the suite.'
    : `Accounts and roles in ${me.adminOf.join(', ')}.`;
}

/**
 * The launcher's Admin card, in the system card's look. The title is a stretched link so the whole
 * card opens `/admin`, while the shortcuts stay their own links above it (links can't nest).
 * `wide` (a suite admin with no systems, the card alone on the page) adds the shortcuts, in a grid
 * with a hint each; beside system cards it is the compact card instead.
 */
export function AdminCard({ me, wide = false }: { me: Pick<AdminMe, 'suiteAdmin' | 'adminOf'>; wide?: boolean }) {
  if (!wide) return <CompactAdminCard me={me} />;
  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-transparent bg-card shadow-card transition-colors duration-150 has-[a[data-card-link]:hover]:border-primary/40 motion-reduce:transition-none">
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-highlight">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-subheading font-semibold text-foreground">
            <Link
              to="/admin"
              data-card-link
              className="rounded-lg after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
            >
              Admin
            </Link>
          </h3>
          <p className="text-body text-muted-foreground">{scopeLine(me)}</p>
        </div>
        <ChevronRight
          className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-has-[a[data-card-link]:hover]:translate-x-1 group-has-[a[data-card-link]:focus-visible]:translate-x-1 motion-reduce:transition-none motion-reduce:group-has-[a[data-card-link]:hover]:translate-x-0"
          aria-hidden="true"
        />
      </div>
      <ul
        aria-label="Go straight to"
        className={cn(
          'relative mt-auto overflow-hidden rounded-b-2xl border-t border-border',
          // One pixel gaps over a border colored list draw the dividers in any column count
          wide ? 'grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4' : 'divide-y divide-border',
        )}
      >
        {shortcutsFor(me.suiteAdmin).map(({ label, hint, to, icon: Icon }) => (
          <li key={to} className="bg-card">
            <Link
              to={to}
              className="group/shortcut flex min-h-11 items-center gap-3 px-4 py-2 text-body hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset sm:px-5"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground group-hover/shortcut:text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{label}</span>
                {wide && <span className="block text-caption text-muted-foreground">{hint}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Beside the system cards: the same anatomy and height as a system card (icon, title, a name line,
 * one line of scope), one link to `/admin`. Its navy square marks it as the brand item.
 */
function CompactAdminCard({ me }: { me: Pick<AdminMe, 'suiteAdmin' | 'adminOf'> }) {
  return (
    <Link
      to="/admin"
      className="group flex h-full items-start gap-4 rounded-2xl border border-transparent bg-card p-4 shadow-card transition-colors duration-150 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden motion-reduce:transition-none sm:p-5"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-highlight">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-subheading font-semibold text-foreground">Admin</h3>
        <p className="text-body font-medium text-foreground">
          {me.suiteAdmin ? 'Suite administration' : `${me.adminOf.join(', ')} administration`}
        </p>
        <p className="text-body text-muted-foreground">{scopeLine(me)}</p>
      </div>
      <ChevronRight
        className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-focus-visible:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}

/** For a person who holds systems: the card shows once `/auth/admin/me` says they administer something. */
export function AdminCardIfAdmin({ children }: { children: (me: AdminMe) => ReactNode }) {
  const me = useAdminMe();
  return me && isAdmin(me) ? children(me) : null;
}
