import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { isAdmin } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { useAdminMe } from './useAdminMe';

/**
 * Suite spec 0013, AC-22: the top bar's Admin entry, shown only when `GET /auth/admin/me` says
 * the signed in person is a suite admin or a system admin. A failure hides it. The launcher shows
 * the Admin card instead, so this entry is for the other screens that use the shell.
 */
export function AdminEntry() {
  const me = useAdminMe();
  if (!isAdmin(me)) return null;
  return (
    <Link
      to="/admin"
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'min-h-11 gap-2 text-white hover:bg-white/10 hover:text-white focus-visible:ring-highlight',
      )}
    >
      <ShieldCheck className="size-4" aria-hidden="true" />
      Admin
    </Link>
  );
}
