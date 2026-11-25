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
