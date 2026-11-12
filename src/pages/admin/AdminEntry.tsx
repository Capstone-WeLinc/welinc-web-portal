import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fetchAdminMe, isAdmin } from '@/lib/admin';
import { cn } from '@/lib/utils';

/**
 * Suite spec 0013, AC-22: the launcher top bar's Admin entry, shown only when
 * `GET /auth/admin/me` says the signed in person is a suite admin or a system admin. Any failure
 * hides it: the launcher must work without it.
 */
export function AdminEntry() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAdminMe()
      .then((me) => !cancelled && setShow(isAdmin(me)))
      .catch(() => !cancelled && setShow(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;
  return (
    <Link to="/admin" className={cn(buttonVariants({ variant: 'ghost' }), 'min-h-11 gap-2')}>
      <ShieldCheck className="size-4" aria-hidden="true" />
      Admin
    </Link>
  );
}
