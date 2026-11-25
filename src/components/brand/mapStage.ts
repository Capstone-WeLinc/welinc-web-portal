/*
  Suite spec 0019, AC-13: the labels on the sign in map, placed on its 1440 by 900 stage as board
  `R47Quiet` places them (the three garages and the drop points; no town, water or road names).
  Taken from the board with the map (`signin-map.svg`); positions are stage pixels.
*/
export type MapLabel = { text: string; kind: 'garage' | 'drop'; x: number; y: number; size: number; side: 'start' | 'end' | 'center' };

export const MAP_LABELS: readonly MapLabel[] = [
  { text: "Port Area", kind: 'drop', x: 567, y: 612, size: 13.9, side: 'end' },
  { text: "Malolos", kind: 'drop', x: 372, y: 460, size: 12.5, side: 'end' },
  { text: "Tanay", kind: 'drop', x: 943, y: 618, size: 14.1, side: 'start' },
  { text: "Rodriguez", kind: 'drop', x: 727, y: 484, size: 12.7, side: 'start' },
  { text: "Taguig", kind: 'drop', x: 715, y: 629, size: 14.2, side: 'start' },
  { text: "Sampaloc", kind: 'drop', x: 591, y: 574, size: 13.8, side: 'end' },
  { text: "Pasay", kind: 'drop', x: 605, y: 628, size: 14.2, side: 'end' },
  { text: "Dasmariñas", kind: 'drop', x: 594, y: 820, size: 16.2, side: 'end' },
  { text: "Pulilan", kind: 'garage', x: 430, y: 431, size: 20.7, side: 'start' },
  { text: "Marikina", kind: 'garage', x: 721, y: 560, size: 23.0, side: 'start' },
  { text: "Sta. Rosa", kind: 'garage', x: 843, y: 808, size: 27.4, side: 'start' },
];

/** The board's page, the stage the map and labels are drawn on. */
export const STAGE = { width: 1440, height: 900 } as const;

/** The stage's scale so it covers a box `width` by `height`, as the board's page covers its frame. */
export function coverScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.max(width / STAGE.width, height / STAGE.height);
}

/** From this width the copy column sits over the map, pinned top left at the board's sizes. */
export const PIN_FROM = 1024;

/**
 * Where the stage goes. From `PIN_FROM` up it is pinned top left like the copy and never shrinks,
 * so the labels keep the board's distance from the copy (a centred cover moved Pulilan onto the
 * copy line at 1280 by 720); a smaller window crops the map's bottom and right instead. Phones,
 * with no copy column beside the map, keep the centred cover.
 */
export function stagePlacement(width: number, height: number): { scale: number; pinned: boolean } {
  const cover = coverScale(width, height);
  return width >= PIN_FROM ? { scale: Math.max(1, cover), pinned: true } : { scale: cover, pinned: false };
}

/** On board `R47Quiet` the copy ends 10px above the top of the highest label under it (Pulilan). */
export const LABELS_TOP = 415;
export const COPY_GAP = 10;

/**
 * How far to push the pinned stage down so its labels stay clear of the copy, whose bottom is
 * `copyBottom` px from the page top: nothing while the copy ends where the board's does; more when
 * it runs longer (a narrow column wraps the title and the copy onto more lines).
 */
export function stageDrop(copyBottom: number | null, scale: number): number {
  if (copyBottom === null) return 0;
  return Math.max(0, Math.round(copyBottom + COPY_GAP - LABELS_TOP * scale));
}
