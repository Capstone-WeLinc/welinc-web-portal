import { describe, expect, it } from 'vitest';
import mapSvg from './signin-map.svg?raw';
import { FIT, MAP_LABELS, NETWORK, coverScale, fitStage } from './mapStage';

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

  it('places the network as the board does at 1440 by 900, 40px further left', () => {
    // The board's copy ends at 405 and its panel starts at 840
    const at = fitStage({ left: 64, bottom: 405, panelLeft: 840 }, 900);
    expect(at.scale).toBeCloseTo(1, 1);
    expect(at.x).toBeGreaterThan(-55);
    expect(at.x).toBeLessThan(-20);
    expect(Math.abs(at.y)).toBeLessThan(20);
  });

  it('keeps the whole network under the copy and inside the window when there is room', () => {
    for (const [copy, height] of [[{ left: 64, bottom: 415, panelLeft: 1094 }, 908], [{ left: 64, bottom: 415, panelLeft: 1240 }, 1080]] as const) {
      const { scale, x, y } = fitStage(copy, height);
      const top = y + NETWORK.y * scale;
      expect(top).toBeGreaterThanOrEqual(copy.bottom + FIT.gap - 1);
      expect(y + (NETWORK.y + NETWORK.height) * scale).toBeLessThanOrEqual(height - FIT.bottom + 1);
      expect(x + NETWORK.x * scale).toBeGreaterThanOrEqual(copy.left);
    }
  });

  it('never shrinks below 0.85 or grows past 1.3; a short window crops the south, the top stays under the copy', () => {
    const short = fitStage({ left: 64, bottom: 415, panelLeft: 680 }, 720);
    expect(short.scale).toBe(FIT.min);
    expect(short.y + NETWORK.y * short.scale).toBeCloseTo(415 + FIT.gap, 0);
    expect(fitStage({ left: 64, bottom: 415, panelLeft: 2000 }, 2000).scale).toBe(FIT.max);
  });
});
