import { Wifi, WifiOff } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { useConnection } from '@/lib/connection/connection';

/**
 * Suite spec 0016 AC-12: the portal's one floating banner, top center, above the toasts. It shows
 * offline first, then "Back online" for 4 seconds. The portal holds no session expiry and its
 * Admin views send you to their landing view on their own, so signing out soon and the no access
 * note are VRMS only for now.
 */
export function BannerHost() {
  const { offline, backOnlineUntil } = useConnection();
  let banner = null;
  if (offline) {
    banner = (
      <Banner kind="warning" icon={WifiOff} title="You're offline">
        Changes won't save until the connection is back. We keep trying.
      </Banner>
    );
  } else if (backOnlineUntil !== null) {
    banner = <Banner kind="success" icon={Wifi} title="Back online" />;
  }
  return (
    // Top center of the content area: AdminShell sets --content-left to its sidebar's width
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-2 pt-4 md:left-(--content-left) md:px-4"
    >
      {banner}
    </div>
  );
}
