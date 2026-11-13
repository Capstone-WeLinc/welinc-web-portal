import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { House } from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import type { AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { AccountMenu } from '../launcher/LauncherShell';
import { viewHref, type AdminView, type AdminViewGroup, type AdminViewPath } from './adminViews';

type Props = {
  me: AdminMe;
  views: AdminView[];
  current: AdminViewPath;
  /** Shown above the page, under the top bar (the temporary access band). */
  banner?: ReactNode;
  children: ReactNode;
};

/** The views in sidebar order, under their group labels; the ungrouped one (Overview) first. */
function grouped(views: AdminView[]): { group: AdminViewGroup | null; views: AdminView[] }[] {
  const out: { group: AdminViewGroup | null; views: AdminView[] }[] = [];
  for (const view of views) {
    const last = out[out.length - 1];
    if (last && last.group === view.group) last.views.push(view);
    else out.push({ group: view.group, views: [view] });
  }
  return out;
}

function scopeLine(me: AdminMe): string {
  return me.suiteAdmin
    ? 'Suite admin: every account and every system'
    : `Admin of ${me.adminOf.join(' and ')}: your system's people only`;
}

/**
 * The Admin console's frame (design.md, Layout and navigation): a full height navy sidebar from md
 * up, with the views grouped by task, the active one marked with a gold bar, and Back to home at
 * the bottom. The page fills the rest of the screen. Phones get a top bar and one scrolling strip
 * of the same views instead.
 */
export function AdminShell({ me, views, current, banner, children }: Props) {
  const { search } = useLocation();
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden bg-hero text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <Link
          to="/"
          aria-label="WeLinc home"
          className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5 focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden focus-visible:ring-inset"
        >
          <LogoMark className="h-5 text-highlight" />
          <span className="text-lg font-semibold tracking-tight">WeLinc</span>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">Admin</span>
        </Link>
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
          {grouped(views).map(({ group, views: items }) => (
            <div key={group ?? 'top'} className="mb-4 last:mb-0">
              {group && (
                <p className="mb-1 px-3 text-xs font-medium tracking-wide text-white/50 uppercase">{group}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((view) => (
                  <li key={view.path}>
                    <SideLink view={view} active={view.path === current} search={search} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
          >
            <House className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="WeLinc home"
            className="flex size-9 items-center justify-center rounded-lg bg-hero focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:hidden"
          >
            <LogoMark className="h-3.5 text-highlight" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{scopeLine(me)}</p>
          <AccountMenu user={me.user} onDark={false} />
        </header>
        {banner && <div className="px-4 pt-4 sm:px-6 lg:px-8">{banner}</div>}
        {/* Phones: the views as one scrolling strip of tabs */}
        <nav aria-label="Admin sections" className="md:hidden">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4 pt-4">
            {views.map((view) => (
              <li key={view.path} className="shrink-0">
                <StripLink view={view} active={view.path === current} search={search} />
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SideLink({ view, active, search }: { view: AdminView; active: boolean; search: string }) {
  const Icon = view.icon;
  return (
    <NavLink
      to={viewHref(view.path, search)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // design.md: the active item gets a gold left bar plus white text
        'flex min-h-10 items-center gap-3 rounded-lg border-l-2 px-3 text-sm focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden',
        active
          ? 'border-highlight bg-white/10 font-medium text-white'
          : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-highlight' : 'text-white/60')} aria-hidden="true" />
      {view.label}
    </NavLink>
  );
}

function StripLink({ view, active, search }: { view: AdminView; active: boolean; search: string }) {
  const Icon = view.icon;
  return (
    <NavLink
      to={viewHref(view.path, search)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
        active
          ? 'bg-primary font-medium text-primary-foreground'
          : 'border border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {view.label}
    </NavLink>
  );
}
