/*
  Suite spec 0019, AC-13: the labels on the sign in map, placed on its 1440 by 900 stage as board
  `R47Quiet` places them (the three garages and the drop points; no town, water or road names).
  Taken from the board with the map (`signin-map-still.svg`, `signin-map-trucks.svg`); positions are stage pixels.
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

/** From this width the copy column sits beside the map, so the map is fitted around it (`fitStage`). */
export const PIN_FROM = 1024;

/** The labelled network on the stage, Malolos to Tanay and Pulilan to Sta. Rosa (board `R47Quiet`). */
export const NETWORK = { x: 250, y: 415, width: 750, height: 455 } as const;

/**
 * The free area the network is fitted into: from 10px under the copy to 24px above the window's
 * bottom, and from the copy's left edge to 266px past the panel's left edge (Tanay sits under the
 * glass). Board `R47Quiet` reaches 346px past it; you moved the map 40px left of that (2026-11-26). The scale stays between 0.85
 * (smaller labels get hard to read; a short window crops the south instead) and 1.3.
 */
export const FIT = { gap: 10, bottom: 24, pastPanel: 266, min: 0.85, max: 1.3 } as const;

/** Where the copy column is, in px from the page's top left: its text block and the panel's left edge. */
export type CopyBox = { left: number; bottom: number; panelLeft: number };

/**
 * The stage's scale and top left corner so the network sits centred in the free area beside the
 * copy, at any window size from `PIN_FROM` up: the whole network shows, never under the copy. When
 * the area is shorter than the network at the smallest scale, the network starts at the top of the
 * area and the south is cropped.
 */
export function fitStage(copy: CopyBox, windowHeight: number): { scale: number; x: number; y: number } {
  const top = copy.bottom + FIT.gap;
  const width = copy.panelLeft + FIT.pastPanel - copy.left;
  const height = windowHeight - FIT.bottom - top;
  const fit = Math.min(width / NETWORK.width, height / NETWORK.height);
  const scale = Math.min(FIT.max, Math.max(FIT.min, fit));
  const x = copy.left + (width - NETWORK.width * scale) / 2 - NETWORK.x * scale;
  const y = top + Math.max(0, (height - NETWORK.height * scale) / 2) - NETWORK.y * scale;
  return { scale: round(scale, 3), x: Math.round(x), y: Math.round(y) };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
