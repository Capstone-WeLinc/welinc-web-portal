import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, House, Menu } from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { AccountMenu } from '../launcher/LauncherShell';
import {
  BOTTOM_BAR_MAX,
  viewHref,
  type AdminView,
  type AdminViewGroup,
  type AdminViewPath,
} from './adminViews';

type Props = {
  me: AdminMe;
  views: AdminView[];
  current: AdminViewPath;
  /** Shown above the page, under the top bar (the temporary access band). */
  banner?: ReactNode;
  /** Shown in the top bar before the account menu (the temporary access pill). */
  status?: ReactNode;
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

/** Who this console is for, in the sidebar's badge: "Suite admin" or "VRMS admin". */
function standing(me: AdminMe): string {
  return me.suiteAdmin ? 'Suite admin' : `${me.adminOf.join(', ')} admin`;
}

/**
 * The Admin console's frame (design.md, Layout and navigation): a full height navy sidebar from md
 * up, with the views grouped by task, the active one marked with a gold bar, and Back to home at
 * the bottom. On phones the sidebar becomes a bottom tab bar for at most five views and a sheet
 * menu past that (a suite admin has seven).
 */
export function AdminShell({ me, views, current, banner, status, children }: Props) {
  const { search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomBar = views.length <= BOTTOM_BAR_MAX;
  const currentView = views.find((v) => v.path === current);

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden bg-hero text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <SidebarBody me={me} views={views} current={current} search={search} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:px-6 lg:px-8">
          {bottomBar ? (
            <Link
              to="/"
              aria-label="WeLinc home"
              className="flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-hero">
                <LogoMark className="h-3.5 text-highlight" />
              </span>
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Open the admin menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="-ml-2 flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          )}
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="text-muted-foreground max-sm:hidden">Admin</li>
              <li aria-hidden="true" className="text-muted-foreground max-sm:hidden">
                <ChevronRight className="size-4" />
              </li>
              <li aria-current="page" className="truncate font-medium text-foreground">
                {currentView?.label}
              </li>
            </ol>
          </nav>
          {status}
          <AccountMenu user={me.user} onDark={false} />
        </header>

        {banner && <div className="px-4 pt-4 sm:px-6 lg:px-8">{banner}</div>}
        <main className={cn('flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8', bottomBar && 'max-md:pb-24')}>{children}</main>
      </div>

      {bottomBar ? (
        <BottomBar views={views} current={current} search={search} />
      ) : (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="bg-hero text-white md:hidden">
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SheetDescription className="sr-only">The Admin sections, and the way back home.</SheetDescription>
            <SidebarBody
              me={me}
              views={views}
              current={current}
              search={search}
              onNavigate={() => setMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/** The sidebar's brand row, grouped links and Back to home; also the phone sheet's content. */
function SidebarBody({
  me,
  views,
  current,
  search,
  onNavigate,
}: {
  me: AdminMe;
  views: AdminView[];
  current: AdminViewPath;
  search: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <Link
          to="/"
          aria-label="WeLinc home"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
        >
          <LogoMark className="h-5 text-highlight" />
          <span className="text-lg font-semibold tracking-tight">WeLinc</span>
        </Link>
        {/* In the sheet the Close button sits at the right edge, so the badge moves under the logo row */}
        <span
          className={cn(
            'ml-auto truncate rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80',
            onNavigate && 'hidden',
          )}
        >
          {standing(me)}
        </span>
      </div>
      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
        {onNavigate && <p className="mb-4 px-3 text-xs font-medium text-white/70">{standing(me)}</p>}
        {grouped(views).map(({ group, views: items }) => (
          <div key={group ?? 'top'} className="mb-4 last:mb-0">
            {group && <p className="mb-1 px-3 text-xs font-medium tracking-wide text-white/50 uppercase">{group}</p>}
            <ul className="flex flex-col gap-0.5">
              {items.map((view) => (
                <li key={view.path}>
                  <SideLink view={view} active={view.path === current} search={search} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden"
        >
          <House className="size-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </>
  );
}

function SideLink({
  view,
  active,
  search,
  onNavigate,
}: {
  view: AdminView;
  active: boolean;
  search: string;
  onNavigate?: () => void;
}) {
  const Icon = view.icon;
  return (
    <NavLink
      to={viewHref(view.path, search)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // design.md: the active item gets a gold left bar plus white text; 44px rows in the phone sheet
        'flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 text-sm focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-hidden md:min-h-10',
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

/** design.md: phones get a bottom tab bar when there are at most five views. */
function BottomBar({ views, current, search }: { views: AdminView[]; current: AdminViewPath; search: string }) {
  return (
    <nav
      aria-label="Admin sections"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card pb-safe md:hidden"
    >
      <ul className="flex">
        {views.map((view) => {
          const Icon = view.icon;
          const active = view.path === current;
          return (
            <li key={view.path} className="min-w-0 flex-1">
              <NavLink
                to={viewHref(view.path, search)}
                aria-current={active ? 'page' : undefined}
                aria-label={view.label}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset',
                  active ? 'font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate" aria-hidden="true">
                  {view.short}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
