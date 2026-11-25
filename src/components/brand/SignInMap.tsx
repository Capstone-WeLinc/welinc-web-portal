import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import mapSvg from './signin-map.svg?raw';
import { GROW_FROM, MAP_LABELS, stageDrop, stagePlacement } from './mapStage';

/** The `signin-stage` variables that pin it top left and grow it around `GROW_FROM` (see `stagePlacement`). */
const PINNED = { '--stage-at': '0px', '--stage-shift': '0px', '--stage-origin': `${GROW_FROM.x}px ${GROW_FROM.y}px` };

const SIDE = { start: '-translate-y-1/2', end: '-translate-x-full -translate-y-1/2', center: '-translate-x-1/2 -translate-y-1/2' };

/**
 * Suite spec 0019, AC-13 (board `R47Quiet`, S27d Quiet): the drawn map of the WeLinc area under
 * the whole sign in page. The roads, shores and city dots are dimmed, the twelve trip runs and the
 * drops lit, and the trucks drive the runs on SVG `animateMotion` (the board's own timing, in
 * `signin-map.svg`). The trucks stand still under reduced motion and while the tab is hidden. Only
 * the three garages and the drop points are named; below 768px only the garages. Decoration only.
 * `clearOf` is the copy beside the map: from 1024px the stage drops below it (`stageDrop`).
 */
export function SignInMap({ className, clearOf }: { className?: string; clearOf?: RefObject<HTMLElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ scale: 1, pinned: false, drop: 0 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const { top, width, height } = box.getBoundingClientRect();
      const place = stagePlacement(width, height);
      const copy = clearOf?.current?.getBoundingClientRect();
      const drop = place.pinned && copy && copy.height > 0 ? stageDrop(copy.bottom - top) : 0;
      setStage((now) => (now.scale === place.scale && now.pinned === place.pinned && now.drop === drop ? now : { ...place, drop }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (clearOf?.current) observer.observe(clearOf.current);
    return () => observer.disconnect();
  }, [clearOf]);

  useEffect(() => {
    const svg = mapRef.current?.querySelector('svg');
    if (!svg || typeof svg.pauseAnimations !== 'function') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (document.visibilityState === 'hidden' || reduce?.matches) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };
    update();
    document.addEventListener('visibilitychange', update);
    reduce?.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      reduce?.removeEventListener('change', update);
    };
  }, []);

  return (
    <div ref={boxRef} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-sidebar', className)}>
      <div className="signin-stage" style={{ ...(stage.pinned ? PINNED : {}), '--stage-scale': stage.scale, '--stage-drop': `${stage.drop}px` } as CSSProperties}>
        {/* A static drawing bundled with the app, never data from a request */}
        <div ref={mapRef} className="signin-map-tilt" dangerouslySetInnerHTML={{ __html: mapSvg }} />
        <div className="signin-map-fade absolute inset-0" />
        {MAP_LABELS.map((label) => (
          <span
            key={label.text}
            className={cn(
              'absolute whitespace-nowrap',
              SIDE[label.side],
              label.kind === 'garage' ? 'signin-label-garage' : 'signin-label-drop max-md:hidden',
            )}
            style={{ left: label.x, top: label.y, fontSize: label.size }}
          >
            {label.text}
          </span>
        ))}
      </div>
    </div>
  );
}
