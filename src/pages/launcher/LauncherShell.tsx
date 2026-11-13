import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
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
import { LogoMark } from '@/components/LogoMark';
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
  /** Gold initials for the navy band, where navy ones would vanish. */
  onDark?: boolean;
}) {
  const src = pictureUrl(user.picture);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className={cn(
          'text-xs font-semibold',
          onDark ? 'bg-highlight text-highlight-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {initialsOf(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** The account menu: who is signed in, and Sign out everywhere (AC-17). `onDark` for the navy band. */
export function AccountMenu({ user, onDark = true }: { user: User; onDark?: boolean }) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden',
            onDark
              ? 'text-white hover:bg-white/10 focus-visible:ring-highlight'
              : 'text-foreground hover:bg-accent focus-visible:ring-ring',
          )}
          aria-label={`Account menu for ${user.name}`}
        >
          <UserAvatar user={user} onDark={onDark} />
          <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
          <ChevronDown className={cn('size-4', onDark ? 'text-white/60' : 'text-muted-foreground')} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 font-normal">
            <UserAvatar user={user} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setSigningOut(true)}>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={signingOut} onOpenChange={setSigningOut} />
    </>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="h-5 text-highlight" />
      <span className="text-lg font-semibold tracking-tight text-white">WeLinc</span>
    </div>
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
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-hero text-white">
        <div aria-hidden="true" className="brand-grid pointer-events-none absolute inset-0" />
        <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {homeLink ? (
            <Link
              to="/"
              aria-label="WeLinc home"
              className="rounded-lg focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-hero focus-visible:outline-hidden"
            >
              <Brand />
            </Link>
          ) : (
            <Brand />
          )}
          <div className="flex items-center gap-2">
            {signedIn && adminEntry && <AdminEntry />}
            {user && <AccountMenu user={user} />}
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
        {children}
      </main>
    </div>
  );
}
