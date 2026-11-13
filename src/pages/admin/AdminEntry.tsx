import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fetchAdminMe, isAdmin } from '@/lib/admin';
import { cn } from '@/lib/utils';

/**
 * Suite spec 0013, AC-22: the launcher top bar's Admin entry, shown only when
 * `GET /auth/admin/me` says the signed in person is a suite admin or a system admin. A failure
 * hides it, so the launcher works without it, and the check runs again when the tab comes back
 * into focus, so a passing network error doesn't leave an admin without the link.
 */
export function AdminEntry() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let checking = false;
    const check = () => {
      if (settled || checking) return;
      checking = true;
      fetchAdminMe()
        .then((me) => {
          settled = true;
          if (!cancelled) setShow(isAdmin(me));
        })
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    };
    check();
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
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
