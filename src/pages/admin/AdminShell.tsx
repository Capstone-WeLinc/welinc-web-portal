import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Check, ChevronRight, ChevronsUpDown, LayoutGrid, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { LogoBadge } from '@/components/brand/BrandLockup';
import { CrashBoundary } from '@/components/monitoring/CrashBoundary';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminMe } from '@/lib/admin';
import type { LauncherAnswer } from '@/lib/auth';
import { orderedSystems, signedInSystems } from '@/lib/launcher';
import { useHeldAnswer } from '@/lib/sessionWatch/watch';
import { SUITE_MANAGEMENT } from '@/lib/title';
import { cn } from '@/lib/utils';
import { AccountMenu } from '../launcher/LauncherShell';
import { SuiteSwitcher } from './SuiteSwitcher';
import {
  BOTTOM_BAR_MAX,
  viewHref,
  type AdminView,
  type AdminViewGroup,
  type AdminViewPath,
} from './adminViews';
import { useSidebarCollapsed } from './useSidebarCollapsed';

type Props = {
  me: AdminMe;
  views: AdminView[];
  current: AdminViewPath;
  /** Shown above the page, under the top bar (the temporary access band). */
  banner?: ReactNode;
  /** Shown in the top bar before the account menu (the temporary access pill). */
  status?: ReactNode;
  /** The view fills the content area edge to edge (People's list beside the person). */
  flush?: boolean;
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

/** Who this console is for, under the Suite management title: "Suite admin" or "VRMS admin" (AC-17). */
function standing(me: AdminMe): string {
  return me.suiteAdmin ? 'Suite admin' : `${me.adminOf.join(', ')} admin`;
}

/**
 * VRMS spec 0027, AC-12: a view's count bubble. Deletion requests counts the pending ones the
 * caller can act on (`pendingDeletionRequests`), hot (gold) for a suite admin; 0 shows nothing.
 */
function viewCount(view: AdminView, me: AdminMe): { count: number; hot: boolean } | null {
  if (view.path !== 'deletion-requests') return null;
  const count = me.pendingDeletionRequests ?? 0;
  return count > 0 ? { count, hot: me.suiteAdmin } : null;
}

const countText = (count: number) => (count > 99 ? '99+' : String(count));
const countName = (count: number) => `${count} waiting for a decision`;

type System = LauncherAnswer['systems'][number];

/*
  Suite spec 0016 AC-16 (design.md, Layout and navigation: Sidebar; board Sidebars8): idle items in
  sidebar-idle, hover sidebar-hover, the current one sidebar-current with white semibold text. No
  gold edge, no dot. Group labels never fold; a sidebar-line separates groups.
*/
const ITEM_CLASSES =
  'flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-body font-medium text-sidebar-idle transition-colors duration-(--duration-menu) outline-none hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring-on-dark motion-reduce:transition-none max-md:h-11';
const CURRENT_CLASSES = 'bg-sidebar-current font-semibold text-sidebar-foreground';
const ROW =
  'flex w-full items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark';

/** Width of the content's left edge from 768px up, so the floating banner centers on the content. */
const CONTENT_LEFT = { expanded: '15rem', collapsed: '4rem' } as const;

/**
 * The Suite management frame (design.md, Layout and navigation; suite spec 0019, AC-17 to AC-20,
 * board `Shell20`): a navy 240px sidebar from md up with the Suite management title and your role
 * at the top (the logo goes Home), the views grouped by task, and a darker footer strip with the
 * company and the collapse button. Collapsed it is a 64px icon strip with tooltips. The system
 * switcher and the account menu sit at the top right. On phones the sidebar becomes a bottom tab
 * bar for at most five views and a sheet menu past that.
 */
export function AdminShell({ me, views, current, banner, status, flush, children }: Props) {
  const { search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed(me.user.id);
  const bottomBar = views.length <= BOTTOM_BAR_MAX;
  const currentView = views.find((v) => v.path === current);
  const answer = useHeldAnswer();
  const systems = answer?.systems ?? [];
  // Suite spec 0019, AC-20: the switcher and Home show only when the held answer has a web system
  // (never decided by suiteAdmin). With none there is no launcher, so the logo goes to /admin.
  const switcher = systems.length > 0;
  const home = switcher ? '/' : '/admin';

  // design.md, Feedback: the banner sits top center of the content area (BannerHost reads this).
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--content-left', collapsed ? CONTENT_LEFT.collapsed : CONTENT_LEFT.expanded);
    return () => {
      root.removeProperty('--content-left');
    };
  }, [collapsed]);

  return (
    <TooltipProvider>
      <div className={cn('min-h-screen bg-background md:flex', bottomBar && 'has-tab-bar')}>
        <aside
          className={cn(
            'hidden bg-sidebar text-sidebar-foreground transition-all duration-(--duration-fold) ease-enter motion-reduce:transition-none md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:flex-col',
            collapsed ? 'md:w-16' : 'md:w-60',
          )}
        >
          <SidebarBody me={me} views={views} current={current} search={search} collapsed={collapsed} systems={systems}>
            <CollapsedTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} collapsed={collapsed}>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                className={cn(ITEM_CLASSES, collapsed && 'justify-center px-0')}
              >
                {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-4.5 shrink-0" /> : <PanelLeftClose aria-hidden="true" className="size-4.5 shrink-0" />}
                <span className={cn('truncate', collapsed && 'sr-only')}>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
              </button>
            </CollapsedTooltip>
          </SidebarBody>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:px-6 lg:px-8">
            {bottomBar ? (
              <Link
                to={home}
                aria-label={switcher ? 'Home' : SUITE_MANAGEMENT}
                className="flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
              >
                <LogoBadge />
              </Link>
            ) : (
              <button
                type="button"
                aria-label="Open the Suite management menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="-ml-2 flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            )}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-small">
                <li className="text-muted-foreground max-sm:hidden">{SUITE_MANAGEMENT}</li>
                <li aria-hidden="true" className="text-muted-foreground max-sm:hidden">
                  <ChevronRight className="size-4" />
                </li>
                <li aria-current="page" className="truncate font-medium text-foreground">
                  {currentView?.label}
                </li>
              </ol>
            </nav>
            {status}
            {/* Phones: the system switcher and your account menu stay top right. From 768px up they
                live at the top and bottom of the sidebar (VRMS spec 0027, AC-12). */}
            <div className="flex items-center gap-2 md:hidden">
              {switcher && <SuiteSwitcher systems={systems} />}
              <AccountMenu user={me.user} onDark={false} systems={answer ? signedInSystems(answer) : undefined} />
            </div>
          </header>

          {banner && <div className="px-4 pt-4 sm:px-6 lg:px-8">{banner}</div>}
          <main className={cn('flex-1', !flush && 'px-4 py-4 sm:px-6 sm:py-6 lg:px-8', bottomBar && 'max-md:pb-24')}>
            {/* VRMS spec 0025, AC-7: a view crash keeps the sidebar; another view clears it. Keyed by
                the view, so picking another person on People keeps the list mounted. */}
            <CrashBoundary key={current} variant="page">
              {children}
            </CrashBoundary>
          </main>
        </div>

        {bottomBar ? (
          <BottomBar me={me} views={views} current={current} search={search} />
        ) : (
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="left" className="bg-sidebar text-sidebar-foreground md:hidden">
              <SheetTitle className="sr-only">{SUITE_MANAGEMENT} menu</SheetTitle>
              <SheetDescription className="sr-only">The Suite management sections; the logo goes home.</SheetDescription>
              <SidebarBody
                me={me}
                views={views}
                current={current}
                search={search}
                systems={systems}
                onNavigate={() => setMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </TooltipProvider>
  );
}

/** Shows the label as a tooltip on the right while the sidebar is collapsed. */
function CollapsedTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The sidebar's brand row, grouped links and footer; also the phone sheet's content (never collapsed). */
function SidebarBody({
  me,
  views,
  current,
  search,
  collapsed = false,
  systems,
  onNavigate,
  children,
}: {
  me: AdminMe;
  views: AdminView[];
  current: AdminViewPath;
  search: string;
  collapsed?: boolean;
  /** The held launcher answer's web systems: none means no launcher, so the switcher is a label. */
  systems: readonly System[];
  onNavigate?: () => void;
  /** Above the account menu: the collapse toggle (desktop only). */
  children?: ReactNode;
}) {
  const pad = collapsed ? 'px-2' : 'px-3';
  return (
    <>
      <div className={cn('shrink-0 pt-3', pad)}>
        <AdminSwitcher systems={systems} collapsed={collapsed} onNavigate={onNavigate} />
        <hr aria-hidden="true" className="mx-0.5 mt-3.5 border-sidebar-line" />
      </div>

      <nav aria-label="Suite management sections" className={cn('flex-1 overflow-x-hidden overflow-y-auto py-3', pad)}>
        {grouped(views).map(({ group, views: items }, index) => (
          <div key={group ?? 'top'} className="flex flex-col gap-0.5">
            {index > 0 && <hr aria-hidden="true" className="mx-2.5 mt-2.5 border-sidebar-line" />}
            {group && !collapsed && (
              <h2 className={cn('px-2.5 pb-1.5 text-label text-sidebar-label', index > 0 ? 'pt-3' : 'pt-1')}>{group}</h2>
            )}
            {collapsed && index > 0 && <span aria-hidden="true" className="h-2" />}
            <ul className="flex flex-col gap-0.5">
              {items.map((view) => (
                <li key={view.path}>
                  <SideLink
                    view={view}
                    count={viewCount(view, me)}
                    active={view.path === current}
                    search={search}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* VRMS spec 0027, AC-12 (spec 0016): the collapse toggle above the account menu, as in VRMS */}
      <div className={cn('flex shrink-0 flex-col gap-1 border-t border-sidebar-line py-3', collapsed ? 'px-2' : 'px-3', !children && 'pb-safe')}>
        {children}
        <CollapsedTooltip label={me.user.name || me.user.email} collapsed={collapsed}>
          <div>
            <AccountMenu user={me.user} sidebar={{ standing: standing(me), collapsed }} />
          </div>
        </CollapsedTooltip>
      </div>
    </>
  );
}

function SideLink({
  view,
  count,
  active,
  search,
  collapsed,
  onNavigate,
}: {
  view: AdminView;
  count: { count: number; hot: boolean } | null;
  active: boolean;
  search: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = view.icon;
  return (
    <CollapsedTooltip label={count ? `${view.label}, ${countName(count.count)}` : view.label} collapsed={collapsed}>
      <NavLink
        to={viewHref(view.path, search)}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(ITEM_CLASSES, 'relative', collapsed && 'justify-center px-0', active && CURRENT_CLASSES)}
      >
        <Icon className="size-4.5 shrink-0" aria-hidden="true" />
        <span className={cn('truncate', collapsed && 'sr-only')}>{view.label}</span>
        {count &&
          (collapsed ? (
            <>
              <span
                aria-hidden="true"
                className={cn('absolute top-1.5 right-2.5 size-2 rounded-full', count.hot ? 'bg-highlight' : 'bg-sidebar-idle')}
              />
              <span className="sr-only">, {countName(count.count)}</span>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'ml-auto shrink-0 rounded-full px-1.5 font-mono text-caption',
                  count.hot ? 'bg-highlight text-highlight-foreground' : 'bg-sidebar-count text-sidebar-foreground',
                )}
              >
                {countText(count.count)}
              </span>
              <span className="sr-only">, {countName(count.count)}</span>
            </>
          ))}
      </NavLink>
    </CollapsedTooltip>
  );
}

/** design.md: phones get a bottom tab bar when there are at most five views. */
function BottomBar({ me, views, current, search }: { me: AdminMe; views: AdminView[]; current: AdminViewPath; search: string }) {
  return (
    <nav
      aria-label="Suite management sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-safe md:hidden"
    >
      <ul className="flex">
        {views.map((view) => {
          const Icon = view.icon;
          const active = view.path === current;
          const count = viewCount(view, me);
          return (
            <li key={view.path} className="min-w-0 flex-1">
              <NavLink
                to={viewHref(view.path, search)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-caption focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset',
                  active ? 'font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {count && (
                    <span
                      aria-hidden="true"
                      className={cn('absolute -top-0.5 -right-1 size-2.5 rounded-full ring-2 ring-card', count.hot ? 'bg-highlight' : 'bg-muted-foreground')}
                    />
                  )}
                </span>
                {count && <span className="sr-only">, {countName(count.count)}</span>}
                {/* The visible short text is the name (WCAG 2.5.3), so voice control can say what it sees. */}
                <span className="max-w-full truncate">
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

/**
 * VRMS spec 0027, AC-12: the switcher at the top of the Suite management sidebar, the same frame
 * as VRMS's. It shows the mark, "Admin" and "WeLinc portal"; its menu lists the Launcher and
 * your systems, each through the launcher's `open` (AC-13). With no launcher (no web system)
 * it is a plain label. Collapsed only the mark shows, and the menu still opens from it.
 */
function AdminSwitcher({
  systems,
  collapsed,
  onNavigate,
}: {
  systems: readonly System[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const body = (
    <>
      {/* Logo B: the mark alone on its gold square (suite spec 0019, AC-28) */}
      <LogoBadge />
      <span className={cn('flex min-w-0 flex-1 flex-col', collapsed && 'sr-only')}>
        <span className="truncate text-group font-bold">Admin</span>
        <span className="truncate text-caption font-normal text-sidebar-idle">WeLinc portal</span>
      </span>
      {systems.length > 0 && !collapsed && <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-sidebar-idle" />}
    </>
  );
  if (systems.length === 0) {
    return <div className={cn(ROW, 'px-2 py-1.5', collapsed && 'justify-center px-0')}>{body}</div>;
  }
  return (
    <DropdownMenu>
      <CollapsedTooltip label="Switch system" collapsed={collapsed}>
        <DropdownMenuTrigger
          aria-label={collapsed ? 'Admin, switch system' : 'Admin, WeLinc portal, switch system'}
          className={cn(ROW, 'min-h-11 bg-sidebar-hover px-2 py-1.5 hover:bg-sidebar-current', collapsed && 'justify-center px-0')}
        >
          {body}
        </DropdownMenuTrigger>
      </CollapsedTooltip>
      <DropdownMenuContent side="bottom" align="start" className="w-60">
        <DropdownMenuItem disabled className="justify-between data-disabled:opacity-100">
          <span className="font-semibold text-foreground">Admin</span>
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            <Check aria-hidden="true" />
            You&rsquo;re here
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/" onClick={onNavigate}>
            <LayoutGrid aria-hidden="true" />
            Launcher
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">Your systems</DropdownMenuLabel>
        {orderedSystems(systems).map((system) => (
          <DropdownMenuItem key={system.system} asChild>
            <Link to={`/?open=${encodeURIComponent(system.system)}`} onClick={onNavigate}>
              <span className="font-semibold">{system.system}</span>
              <span className="truncate text-caption text-muted-foreground">{system.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
