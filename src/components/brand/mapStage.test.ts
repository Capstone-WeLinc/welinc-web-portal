import { describe, expect, it } from 'vitest';
import mapSvg from './signin-map.svg?raw';
import { MAP_LABELS, coverScale, stageDrop, stagePlacement } from './mapStage';

// covers: suite spec 0019 AC-13 (the map's labels, trucks and credit source), AC-12 (trucks on animateMotion)

describe('sign in map', () => {
  it('names the three garages and the drop points only', () => {
    expect(MAP_LABELS.filter((l) => l.kind === 'garage').map((l) => l.text)).toEqual(['Pulilan', 'Marikina', 'Sta. Rosa']);
    const names = MAP_LABELS.map((l) => l.text);
    expect(names).not.toContain('Manila Bay');
    expect(names).not.toContain('Laguna de Bay');
    expect(MAP_LABELS.filter((l) => l.kind === 'drop')).toHaveLength(8);
  });

  it('drives twelve trucks on animateMotion and keeps the OpenStreetMap note', () => {
    expect(mapSvg.match(/<animateMotion /g)).toHaveLength(12);
    expect(mapSvg).toContain('OpenStreetMap contributors');
    expect(mapSvg).toContain('aria-hidden="true"');
  });

  it('scales the 1440 by 900 stage to cover the window', () => {
    expect(coverScale(1440, 900)).toBe(1);
    expect(coverScale(1280, 720)).toBeCloseTo(0.889, 3);
    expect(coverScale(1920, 1080)).toBeCloseTo(1.333, 3);
    expect(coverScale(375, 812)).toBeCloseTo(0.902, 3);
    expect(coverScale(0, 0)).toBe(1);
  });

  it('pins the stage top left and never shrinks it beside the copy column, so labels stay off the copy', () => {
    expect(stagePlacement(1440, 900)).toEqual({ scale: 1, pinned: true });
    expect(stagePlacement(1280, 720)).toEqual({ scale: 1, pinned: true });
    expect(stagePlacement(1024, 768)).toEqual({ scale: 1, pinned: true });
    expect(stagePlacement(1920, 1080).scale).toBeCloseTo((1920 - 430) / (1440 - 430), 3);
    expect(stagePlacement(1600, 1200).scale).toBeCloseTo((1200 - 415) / (900 - 415), 3);
    expect(stagePlacement(375, 812)).toEqual({ scale: coverScale(375, 812), pinned: false });
  });

  it('drops the pinned stage only as far as the copy runs past the board\'s copy', () => {
    expect(stageDrop(null)).toBe(0);
    expect(stageDrop(405)).toBe(0);
    expect(stageDrop(415)).toBe(10);
    expect(stageDrop(560)).toBe(155);
  });
});
