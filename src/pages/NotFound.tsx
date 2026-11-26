import { Link } from 'react-router-dom';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { LiveryTruck } from '@/components/brand/LiveryTruck';
import { buttonVariants } from '@/components/ui/button';
import { pageTitle, useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';

/**
 * Suite spec 0019, AC-26 (board `R34NotFound`): any address the portal doesn't know, an unknown
 * `/admin/<view>` included. A WeLinc truck waits at a road barrier; the way out goes Home.
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
        <RoadBlock />
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

/** The road with the truck stopped at a barrier (decoration only, so screen readers skip it). */
function RoadBlock() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 260"
      preserveAspectRatio="xMidYMax slice"
      className="mt-6 block h-40 w-full sm:mt-10 sm:h-65"
    >
      <path d="M0 150 L160 120 L330 140 L520 104 L700 132 L880 110 L1060 136 L1240 108 L1440 128 V190 H0z" fill="var(--scene-hills)" />
      <rect x="0" y="190" width="1440" height="70" fill="var(--scene-road)" />
      <line x1="0" y1="192" x2="1440" y2="192" stroke="var(--white)" strokeOpacity="0.22" strokeWidth="2" />
      <line x1="0" y1="228" x2="980" y2="228" stroke="var(--white)" strokeOpacity="0.25" strokeWidth="3" strokeDasharray="34 26" />
      <rect x="1010" y="150" width="6" height="64" fill="var(--scene-post)" />
      <rect x="1150" y="150" width="6" height="64" fill="var(--scene-post)" />
      <rect x="996" y="150" width="174" height="22" rx="3" fill="var(--highlight)" />
      {[1006, 1036, 1066, 1096, 1126, 1156].map((x) => (
        <path key={x} d={`M${x} 150 h14 l-12 22 h-14 z`} fill="var(--sidebar)" />
      ))}
      <circle className="scene-blink" cx="1013" cy="142" r="6" fill="var(--livery-orange)" />
      <circle className="scene-blink" style={{ animationDelay: '0.55s' }} cx="1153" cy="142" r="6" fill="var(--livery-orange)" />
      <g transform="translate(820 160)">
        <LiveryTruck blink />
      </g>
    </svg>
  );
}
