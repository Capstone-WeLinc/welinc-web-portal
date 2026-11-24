import { Link } from 'react-router-dom';
import { Grip, House, ShieldCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { LauncherAnswer } from '@/lib/auth';
import { roleTag } from '@/lib/launcher';
import { SUITE_MANAGEMENT } from '@/lib/title';
import { cn } from '@/lib/utils';
import { SYSTEM_ICONS, SYSTEM_LINES } from '../launcher/systemIcons';

type System = LauncherAnswer['systems'][number];

const CARD = 'flex items-center gap-3 rounded-2xl px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring';
const TILE = 'flex size-10 shrink-0 items-center justify-center rounded-xl';
const TAG = 'shrink-0 rounded-md px-2 py-0.5 text-caption font-semibold whitespace-nowrap';

/**
 * Suite spec 0019, AC-20 (board `Switcher16`): the grid button at the top right. Wide cards, one
 * per row: Suite management first and ticked, then the systems you hold a role in (from the held
 * launcher answer), each with your role and its own address. A Home pill sits in the title.
 * `systems` empty for a suite admin with no system roles: the caller shows no switcher at all.
 */
export function SuiteSwitcher({ systems }: { systems: readonly System[] }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Switch system"
        className="flex size-10 items-center justify-center rounded-full text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent max-sm:size-11"
      >
        <Grip aria-hidden="true" className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 max-w-(--radix-popover-content-available-width) rounded-2xl p-0">
        <nav aria-label="Switch system" className="flex flex-col">
          <div className="flex items-center px-4 pt-3.5 pb-2.5">
            <span className="flex-1 text-small font-semibold text-muted-strong">Switch to</span>
            <Link
              to="/"
              className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-small font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <House aria-hidden="true" className="size-3.5" />
              Home
            </Link>
          </div>
          <ul className="flex flex-col gap-2 px-3 pb-3">
            <li>
              <Link
                to="/admin"
                aria-current="page"
                className={cn(CARD, 'bg-accent ring-2 ring-primary ring-inset')}
              >
                <span aria-hidden="true" className={cn(TILE, 'bg-primary text-highlight')}>
                  <ShieldCheck className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-semibold text-foreground">{SUITE_MANAGEMENT}</span>
                  <span className="truncate text-caption font-normal text-muted-foreground">Users and permissions</span>
                </span>
                <span className={cn(TAG, 'bg-primary text-primary-foreground')}>You are here</span>
              </Link>
            </li>
            {systems.map((system) => {
              const Icon = SYSTEM_ICONS[system.system] ?? ShieldCheck;
              return (
                <li key={system.system}>
                  <a href={system.url} className={cn(CARD, 'border border-border hover:bg-accent')}>
                    <span aria-hidden="true" className={cn(TILE, 'bg-info-bg text-primary')}>
                      <Icon className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-semibold text-foreground">{system.system}</span>
                      <span className="truncate text-caption font-normal text-muted-foreground">
                        {SYSTEM_LINES[system.system] ?? system.name}
                      </span>
                    </span>
                    <span className={cn(TAG, 'bg-info-bg text-primary')}>{roleTag(system)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
