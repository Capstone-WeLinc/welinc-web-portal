import { Link } from 'react-router-dom';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { RoadScene } from '@/components/brand/scenes/RoadScene';
import { buttonVariants } from '@/components/ui/button';
import { pageTitle, useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

/**
 * Suite spec 0019, AC-26 (board `R34NotFound`): any address the portal doesn't know, an unknown
 * `/admin/<view>` included. A WeLinc truck waits at a road barrier; the way out goes Home. The road
 * is the scene kit's `RoadScene` (VRMS spec 0028, AC-21), shared with web-vrms.
 */
export default function NotFound() {
  useDocumentTitle(pageTitle('Page not found'));
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="bg-sidebar">
        <header className="mx-auto flex h-18 max-w-300 items-center px-6 sm:px-10">
          <Link to="/" aria-label="WeLinc Logistics, home" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-none">
            <BrandLockup />
          </Link>
        </header>
        <div className="mt-6 sm:mt-10">
          <RoadScene />
        </div>
      </div>
      <main className="flex flex-1 flex-col items-center px-6 pt-14 pb-16 text-center">
        <p className="text-small font-bold tracking-wider text-muted-foreground uppercase">Error 404</p>
        <h1 className="mt-2.5 text-display font-extrabold tracking-tight text-foreground">Wrong turn</h1>
        <p className="mt-3 max-w-115 text-group font-normal text-muted-strong">
          This page doesn't exist or has moved. Head back and pick another route.
        </p>
        <Link to="/" className={cn(buttonVariants({ size: 'touch' }), 'mt-7 w-55 rounded-xl bg-sidebar hover:bg-primary')}>
          Back to home
        </Link>
      </main>
    </div>
  );
}
