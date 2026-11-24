import { Wifi, WifiOff } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { useConnection } from '@/lib/connection/connection';

/**
 * Suite spec 0016 AC-12: the portal's one floating banner, top center, above the toasts: offline,
 * then "Back online" for 4 seconds. The signing out soon banner became the session warning toast
 * (suite spec 0019, AC-25, `SessionToast.tsx`), which shows alongside this one. The no access note
 * is VRMS only: the portal's Admin views send you to their landing view on their own.
 */
export function BannerHost() {
  const { offline, backOnlineUntil } = useConnection();
  return (
    // Top center of the content area: AdminShell sets --content-left to its sidebar's width
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-2 pt-4 md:left-(--content-left) md:px-4">
      <div aria-live="polite" className="flex justify-center">
        {offline ? (
          <Banner kind="warning" icon={WifiOff} title="You're offline">
            Changes won't save until the connection is back. We keep trying.
          </Banner>
        ) : backOnlineUntil !== null ? (
          <Banner kind="success" icon={Wifi} title="Back online" />
        ) : null}
      </div>
    </div>
  );
}
