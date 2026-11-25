import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import stillSvg from './signin-map-still.svg?raw';
import trucksSvg from './signin-map-trucks.svg?raw';
import { MAP_LABELS, PIN_FROM, coverScale, fitStage } from './mapStage';

const SIDE = { start: '-translate-y-1/2', end: '-translate-x-full -translate-y-1/2', center: '-translate-x-1/2 -translate-y-1/2' };

/**
 * Suite spec 0019, AC-13 (board `R47Quiet`, S27d Quiet): the drawn map of the WeLinc area under
 * the whole sign in page. The roads, shores and city dots are dimmed, the twelve trip runs and the
 * drops lit, and the trucks drive the runs on SVG `animateMotion` (the board's own timing). The
 * trucks stand still under reduced motion and while the tab is hidden. Only the three garages and
 * the drop points are named; below 768px only the garages. Decoration only.
 *
 * `clearOf` is the copy's text block: from 1024px the map's network is fitted into the free area
 * beside it (`fitStage`); on phones the stage is centred and covers the page.
 *
 * Paint cost (the sweep, 2026-11-26): three layers on the same stage. The still drawing, garages
 * included (`signin-map-still.svg`), paints once. The twelve trucks (`signin-map-trucks.svg`) move
 * on a layer of their own, which fades out at the glass panel's left edge, so the panel's blur
 * never has to be worked out again behind a moving truck. On phones the panel covers the map, so
 * the trucks aren't drawn at all. The fades and labels sit on top of both.
 */
export function SignInMap({ className, clearOf }: { className?: string; clearOf?: RefObject<HTMLElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const trucksRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>({ scale: 1, at: null, panelLeft: null });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const page = box.getBoundingClientRect();
      const text = clearOf?.current?.getBoundingClientRect();
      const column = clearOf?.current?.parentElement?.getBoundingClientRect();
      let next: Stage = { scale: coverScale(page.width, page.height), at: null, panelLeft: null };
      if (page.width >= PIN_FROM && text && column && text.height > 0) {
        const panelLeft = Math.round(column.right - page.left);
        const fit = fitStage({ left: text.left - page.left, bottom: text.bottom - page.top, panelLeft }, page.height);
        next = { scale: fit.scale, at: { x: fit.x, y: fit.y }, panelLeft };
      }
      setStage((now) => (sameStage(now, next) ? now : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (clearOf?.current) observer.observe(clearOf.current);
    return () => observer.disconnect();
  }, [clearOf]);

  const drivesTrucks = stage.panelLeft !== null;

  useEffect(() => {
    const svg = trucksRef.current?.querySelector('svg');
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
  }, [drivesTrucks]);

  const style = stageStyle(stage);
  return (
    <div ref={boxRef} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-sidebar', className)}>
      {/* Static drawings bundled with the app, never data from a request */}
      <div className="signin-stage" style={style}>
        <div className="signin-map-tilt" dangerouslySetInnerHTML={{ __html: stillSvg }} />
      </div>
      {drivesTrucks && (
        <div className="signin-trucks-clip absolute inset-y-0 left-0 overflow-hidden" style={{ width: stage.panelLeft ?? 0 }}>
          <div className="signin-stage" style={style}>
            <div ref={trucksRef} className="signin-map-tilt will-change-transform" dangerouslySetInnerHTML={{ __html: trucksSvg }} />
          </div>
        </div>
      )}
      <div className="signin-stage" style={style}>
        <div className="signin-map-fade absolute inset-x-0 top-0" />
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

/**
 * The stage's scale; its top left corner once it is fitted beside the copy (null: centred); and the
 * glass panel's left edge, where the trucks stop (null on phones, where the panel covers the map).
 */
type Stage = { scale: number; at: { x: number; y: number } | null; panelLeft: number | null };

const sameStage = (a: Stage, b: Stage) => a.scale === b.scale && a.at?.x === b.at?.x && a.at?.y === b.at?.y && a.panelLeft === b.panelLeft;

/** The `signin-stage` variables: centred by default, or placed at `at` and scaled from its corner. */
function stageStyle({ scale, at }: Stage): CSSProperties {
  const vars: Record<string, string | number> = { '--stage-scale': scale };
  if (at) Object.assign(vars, { '--stage-at': '0px', '--stage-x': `${at.x}px`, '--stage-y': `${at.y}px`, '--stage-origin': '0 0' });
  return vars as CSSProperties;
}
