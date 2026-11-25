import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { LauncherAnswer } from '@/lib/auth';
import { initialsOf, pictureUrl } from '@/lib/launcher';
import { PROFILE_PATH } from '@/lib/routes';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { CrashBoundary } from '@/components/monitoring/CrashBoundary';
import { cn } from '@/lib/utils';
import { AdminEntry } from '../admin/AdminEntry';
import { SignOutDialog } from './SignOutDialog';

type User = LauncherAnswer['user'];

/** The picture from welinc-auth, or the initials when there is none or it fails (AC-17). */
export function UserAvatar({
  user,
  className,
  onDark = false,
}: {
  user: User;
  className?: string;
  /** Quiet white initials on a translucent chip for the navy band, where navy ones would vanish (gold stays for the logo). */
  onDark?: boolean;
}) {
  const src = pictureUrl(user.picture);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className={cn(
          'text-caption font-semibold',
          onDark ? 'bg-white/12 text-white ring-1 ring-white/20 ring-inset' : 'bg-primary text-primary-foreground',
        )}
      >
        {initialsOf(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The account menu (spec 0007, AC-17; suite spec 0019, AC-19): your avatar at the top right, on
 * the launcher and in Suite management alike. It holds Your profile (once S23 builds the page,
 * `PROFILE_PATH`) and Sign out, nothing else. `onDark` for the navy band.
 */
export function AccountMenu({
  user,
  onDark = true,
  systems,
  showName = false,
}: {
  user: User;
  onDark?: boolean;
  systems?: readonly string[];
  /** The launcher band shows the name and a chevron beside the avatar from 768px up (board `R37LineArt`). */
  showName?: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex items-center justify-center outline-none focus-visible:ring-2 max-sm:size-11',
            showName ? 'h-11 gap-2.5 rounded-xl px-2 hover:bg-white/8 max-md:rounded-full max-md:px-0' : 'size-10 rounded-full',
            onDark ? 'focus-visible:ring-ring-on-dark' : 'focus-visible:ring-ring',
          )}
          aria-label={`Account menu for ${user.name}`}
        >
          <UserAvatar user={user} onDark={onDark} className={showName ? 'size-8.5' : 'size-10'} />
          {showName && (
            <>
              <span className="max-w-48 truncate text-body font-medium text-white max-md:hidden">{user.name}</span>
              <ChevronDown className="size-4 text-white/70 max-md:hidden" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 font-normal">
            <UserAvatar user={user} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-foreground">{user.name}</p>
              <p className="truncate text-caption text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {PROFILE_PATH && (
              <DropdownMenuItem asChild>
                <Link to={PROFILE_PATH}>
                  <UserRound aria-hidden="true" />
                  Your profile
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setSigningOut(true)}>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} systems={systems} />
    </>
  );
}

/**
 * The portal's frame (AC-15): a navy brand band (design.md, Brand surfaces) with the top bar (logo
 * mark, wordmark, Admin entry, account menu), then the page column. With `hero` the band grows to
 * hold it (the launcher's greeting) and the page's first cards overlap its bottom edge. `signedIn`
 * shows the Admin entry without an account menu (the no access screen); `adminEntry={false}` hides
 * it where the page has its own way into Admin (the launcher's card, the Admin pages).
 */
export function LauncherShell({
  user,
  signedIn = Boolean(user),
  adminEntry = true,
  homeLink = false,
  hero,
  overlap = true,
  systems,
  children,
}: {
  user?: User;
  signedIn?: boolean;
  adminEntry?: boolean;
  /** The logo links back to the launcher (pages away from it, such as Admin). */
  homeLink?: boolean;
  /** Content inside the navy band, under the top bar. */
  hero?: ReactNode;
  /** The first cards overlap the band's bottom edge (the launcher); off for working pages (Admin). */
  overlap?: boolean;
  /** The person's own systems, named in the Sign out dialog (`signedInSystems`). */
  systems?: readonly string[];
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-sidebar text-white">
        <div aria-hidden="true" className="brand-grid pointer-events-none absolute inset-0" />
        <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {homeLink ? (
            <Link
              to="/"
              aria-label="WeLinc home"
              className="rounded-lg focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-hidden"
            >
              <BrandLockup />
            </Link>
          ) : (
            <BrandLockup />
          )}
          <div className="flex items-center gap-2">
            {signedIn && adminEntry && <AdminEntry />}
            {user && <AccountMenu user={user} systems={systems} />}
          </div>
        </header>
        {hero && (
          <div
            className={cn(
              'relative mx-auto max-w-6xl px-4 sm:px-6',
              overlap ? 'pt-6 pb-20 sm:pt-10 sm:pb-24' : 'pt-2 pb-8 sm:pt-4 sm:pb-10',
            )}
          >
            {hero}
          </div>
        )}
      </div>
      <main
        className={cn(
          'relative mx-auto max-w-6xl px-4 sm:px-6',
          hero && overlap ? '-mt-12 pb-10 sm:-mt-14' : 'py-6 sm:py-8',
        )}
      >
        {/* VRMS spec 0025, AC-7: a page crash keeps the brand band; another page clears it */}
        <CrashBoundary key={pathname} variant="page">
          {children}
        </CrashBoundary>
      </main>
    </div>
  );
}
