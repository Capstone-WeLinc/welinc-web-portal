import { useState, type ReactNode } from 'react';
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
import { LOGO_URL } from '../auth/AuthHero';
import { SignOutDialog } from './SignOutDialog';

type User = LauncherAnswer['user'];

/** The picture from welinc-auth, or the initials when there is none or it fails (AC-17). */
export function UserAvatar({ user, className }: { user: User; className?: string }) {
  const src = pictureUrl(user.picture);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
        {initialsOf(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** The account menu: who is signed in, and Sign out everywhere (AC-17). */
function AccountMenu({ user }: { user: User }) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
          aria-label={`Account menu for ${user.name}`}
        >
          <UserAvatar user={user} />
          <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
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

/** The launcher's frame: the top bar (logo, wordmark, account menu) and the page column (AC-15). */
export function LauncherShell({ user, children }: { user?: User; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-highlight">
              <img src={LOGO_URL} alt="" crossOrigin="anonymous" className="h-6 w-auto" />
            </div>
            <span className="text-lg font-semibold text-foreground">WeLinc</span>
          </div>
          {user && <AccountMenu user={user} />}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
